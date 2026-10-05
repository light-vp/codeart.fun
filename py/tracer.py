"""
CodeArt Blocks tracer.

Runs a user's Python program under sys.settrace and records one "step" per
executed line. Each step is a full snapshot of the call stack and of every heap
object reachable from it, so the front end can replay (and rewind) the run as
an animation without ever re-executing Python.

The same file powers:
  * the browser (loaded into Pyodide by js/runtime.js), and
  * the level validator (tools/validate-levels.mjs runs it with CPython).

Public entry points (both return JSON strings):
  trace_program(source, max_steps=1500)
  run_tests(source, spec_json)
"""

import ast
import copy
import io
import json
import math
import sys
import types
from collections import deque

USER_FILE = "<main.py>"
MAX_ITEMS = 60          # elements shown per container before truncating
MAX_HEAP = 120          # heap objects per snapshot
STR_PROMOTE_MAX = 40    # strings held by variables become char strips up to this length
TEST_LINE_BUDGET = 300000
OPCODE_BUDGET = 3000000  # catches one-line infinite loops that never emit new line events


class StepLimit(Exception):
    pass


# --------------------------------------------------------------------------
# Static analysis: which names act as indexes into which containers, and
# which `for` loops walk over a named sequence. The front end uses these to
# draw pointer arrows (i, j, left, mid...) and the loop cursor.
# --------------------------------------------------------------------------

def _names_in(node):
    return {n.id for n in ast.walk(node) if isinstance(n, ast.Name)}


def analyze(tree):
    pointers = set()
    loops = []
    branches = {}

    for node in ast.walk(tree):
        if isinstance(node, ast.Subscript) and isinstance(node.value, ast.Name):
            for name in _names_in(node.slice):
                if name != node.value.id:
                    pointers.add((node.value.id, name))

        if isinstance(node, (ast.If, ast.While, ast.For)):
            body_start = node.body[0].lineno
            body_end = max(getattr(s, "end_lineno", s.lineno) for s in node.body)
            branches[node.lineno] = {
                "kind": type(node).__name__.lower(),
                "body": [body_start, body_end],
                "end": node.end_lineno,
            }

        if isinstance(node, ast.For):
            it, target = node.iter, node.target
            loop = {"line": node.lineno, "end": node.end_lineno, "seq": None, "target": None}
            if isinstance(it, ast.Name):
                loop["seq"] = it.id
                loop["target"] = ast.unparse(target)
            elif (isinstance(it, ast.Call) and isinstance(it.func, ast.Name)
                  and it.func.id == "enumerate" and it.args and isinstance(it.args[0], ast.Name)):
                loop["seq"] = it.args[0].id
                loop["target"] = ast.unparse(target)
                if isinstance(target, ast.Tuple) and target.elts and isinstance(target.elts[0], ast.Name):
                    pointers.add((it.args[0].id, target.elts[0].id))
            elif (isinstance(it, ast.Call) and isinstance(it.func, ast.Name)
                  and it.func.id == "range" and isinstance(target, ast.Name)):
                for sub in ast.walk(it):
                    if (isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name)
                            and sub.func.id == "len" and sub.args and isinstance(sub.args[0], ast.Name)):
                        pointers.add((sub.args[0].id, target.id))
            if loop["seq"]:
                loops.append(loop)

    return sorted(pointers), loops, branches


# --------------------------------------------------------------------------
# Value encoding
# --------------------------------------------------------------------------

def _prim(value):
    t = type(value).__name__
    if isinstance(value, bool) or value is None:
        return {"k": "p", "t": "bool" if isinstance(value, bool) else "None", "r": repr(value)}
    if isinstance(value, int):
        return {"k": "p", "t": "int", "r": repr(value)}
    if isinstance(value, float):
        return {"k": "p", "t": "float", "r": repr(value) if math.isfinite(value) else str(value)}
    if isinstance(value, str):
        return {"k": "p", "t": "str", "r": value if len(value) <= 80 else value[:77] + "..."}
    if isinstance(value, complex):
        return {"k": "p", "t": "complex", "r": repr(value)}
    if isinstance(value, types.FunctionType):
        return {"k": "p", "t": "function", "r": value.__name__ + "()"}
    if isinstance(value, type):
        return {"k": "p", "t": "class", "r": "class " + value.__name__}
    if isinstance(value, (types.BuiltinFunctionType, types.MethodType, types.ModuleType)):
        return {"k": "p", "t": "builtin", "r": getattr(value, "__name__", t)}
    return None


def _is_container(value):
    return isinstance(value, (list, tuple, dict, set, frozenset, deque))


def _is_user_object(value):
    cls = type(value)
    return hasattr(value, "__dict__") and getattr(cls, "__module__", None) == "__main__" and not isinstance(value, type)


class Snapshotter:
    def __init__(self):
        self.keep = []          # hold references so ids are never reused mid-run
        self.kept_ids = set()

    def _hold(self, value):
        if id(value) not in self.kept_ids:
            self.kept_ids.add(id(value))
            self.keep.append(value)

    def encode(self, value, heap, queue, promote_str=False):
        if promote_str and isinstance(value, str) and 2 <= len(value) <= STR_PROMOTE_MAX:
            return self._ref(value, heap, queue)
        p = _prim(value)
        if p is not None:
            return p
        if _is_container(value) or _is_user_object(value):
            return self._ref(value, heap, queue)
        text = repr(value)
        return {"k": "p", "t": type(value).__name__, "r": text if len(text) <= 40 else text[:37] + "..."}

    def _ref(self, value, heap, queue):
        oid = str(id(value))
        self._hold(value)
        if oid not in heap and len(heap) < MAX_HEAP:
            heap[oid] = None          # reserve; filled when dequeued
            queue.append(value)
        return {"k": "ref", "id": oid}

    def describe(self, value, heap, queue):
        enc = lambda v: self.encode(v, heap, queue)
        if isinstance(value, str):
            return {"type": "str", "items": [{"k": "p", "t": "str", "r": c} for c in value]}
        if isinstance(value, dict):
            entries = list(value.items())
            return {"type": "dict", "entries": [[enc(k), enc(v)] for k, v in entries[:MAX_ITEMS]],
                    "more": max(0, len(entries) - MAX_ITEMS)}
        if isinstance(value, (list, tuple, deque, set, frozenset)):
            items = list(value)
            if isinstance(value, (set, frozenset)):
                try:
                    items = sorted(items)
                except TypeError:
                    pass
            kind = {list: "list", tuple: "tuple", deque: "deque", set: "set", frozenset: "set"}.get(type(value), "list")
            return {"type": kind, "items": [enc(v) for v in items[:MAX_ITEMS]],
                    "more": max(0, len(items) - MAX_ITEMS)}
        if _is_user_object(value):
            fields = [[k, enc(v)] for k, v in vars(value).items()]
            return {"type": "obj", "cls": type(value).__name__, "fields": fields}
        return {"type": "other", "r": repr(value)[:60]}

    def drain(self, heap, queue):
        while queue:
            value = queue.popleft()
            heap[str(id(value))] = self.describe(value, heap, queue)
        for k in [k for k, v in heap.items() if v is None]:
            del heap[k]


# --------------------------------------------------------------------------
# Tracer
# --------------------------------------------------------------------------

class Tracer:
    def __init__(self, source, max_steps):
        self.source = source
        self.max_steps = max_steps
        self.steps = []
        self.snap = Snapshotter()
        self.pending = {}       # frame -> line waiting to be reported as executed
        self.last_exec = {}     # frame -> last executed line
        self.frame_ids = {}     # id(frame) -> stable uid
        self.frames_kept = []
        self.loop_counts = {}   # (uid, loop_line) -> iterations started
        self.out = io.StringIO()
        self.out_pos = 0
        self.module_globals = None
        self.ops = OPCODE_BUDGET
        tree = ast.parse(source, USER_FILE)
        self.pointers, self.loops, self.branches = analyze(tree)
        self.loops_by_line = {l["line"]: l for l in self.loops}

    # -- frame helpers ------------------------------------------------------
    def uid(self, frame):
        key = id(frame)
        if key not in self.frame_ids:
            self.frame_ids[key] = "f%d" % len(self.frame_ids)
            self.frames_kept.append(frame)
        return self.frame_ids[key]

    def user_stack(self, frame):
        stack = []
        f = frame
        while f is not None:
            code = f.f_code
            if code.co_filename == USER_FILE and (code.co_name == "<module>" or
                                                  (not code.co_name.startswith("<") and code.co_flags & 0x1)):
                stack.append(f)
            f = f.f_back
        stack.reverse()
        return stack

    def frame_vars(self, f):
        if f.f_code.co_name == "<module>":
            return [(k, v) for k, v in f.f_globals.items()
                    if not (k.startswith("__") and k.endswith("__"))
                    and not isinstance(v, types.ModuleType)]
        local = f.f_locals
        order = list(f.f_code.co_varnames) + [k for k in local if k not in f.f_code.co_varnames]
        return [(k, local[k]) for k in order if k in local]

    # -- snapshot -----------------------------------------------------------
    def emit(self, frame, line, event, extra=None):
        if len(self.steps) >= self.max_steps:
            raise StepLimit()
        heap = {}
        queue = deque()
        frames = []
        stack = self.user_stack(frame)
        for f in stack:
            uid = self.uid(f)
            vars_out = []
            for name, value in self.frame_vars(f):
                vars_out.append([name, self.snap.encode(value, heap, queue, promote_str=True)])
            frames.append({"fid": uid, "name": "global" if f.f_code.co_name == "<module>" else f.f_code.co_name,
                           "line": line if f is frame else self.last_exec.get(f, f.f_lineno),
                           "vars": vars_out})
        ret = None
        if extra and "ret" in extra:
            ret = self.snap.encode(extra["ret"], heap, queue, promote_str=True)
        self.snap.drain(heap, queue)

        cursors = []
        for f in stack:
            uid = self.uid(f)
            cur = line if f is frame else self.last_exec.get(f)
            for loop in self.loops:
                key = (uid, loop["line"])
                if key in self.loop_counts and cur is not None and loop["line"] <= cur <= loop["end"]:
                    cursors.append({"fid": uid, "seq": loop["seq"], "target": loop["target"],
                                    "idx": self.loop_counts[key] - 1, "line": loop["line"]})

        text = self.out.getvalue()
        out_delta = text[self.out_pos:]
        self.out_pos = len(text)

        step = {"line": line, "event": event, "fid": self.uid(frame), "frames": frames,
                "heap": heap, "cursors": cursors}
        if out_delta:
            step["out"] = out_delta
        if ret is not None:
            step["ret"] = ret
        if extra:
            for k, v in extra.items():
                if k != "ret":
                    step[k] = v
        self.steps.append(step)

    def executed(self, frame, line, next_line, event="line", extra=None):
        uid = self.uid(frame)
        extra = dict(extra or {})
        info = self.branches.get(line)
        if info:
            lo, hi = info["body"]
            taken = next_line is not None and lo <= next_line <= hi
            extra["branch"] = {"kind": info["kind"], "taken": taken}
        loop = self.loops_by_line.get(line)
        if loop:
            key = (uid, line)
            prev = self.last_exec.get(frame)
            if prev is not None and loop["line"] < prev <= loop["end"] and key in self.loop_counts:
                self.loop_counts[key] += 1
            else:
                self.loop_counts[key] = 1
        self.last_exec[frame] = line
        self.emit(frame, line, event, extra)

    def trace(self, frame, event, arg):
        code = frame.f_code
        if code.co_filename != USER_FILE:
            return None
        if event == "opcode":
            self.ops -= 1
            if self.ops < 0:
                raise StepLimit()
            return self.trace
        if event == "call":
            frame.f_trace_opcodes = True
            if code.co_name == "<module>":
                return self.trace
            if code.co_name.startswith("<"):
                return None     # comprehensions / genexprs: traced as part of their line
            if not (code.co_flags & 0x1):   # CO_OPTIMIZED unset -> class body
                return None
            self.emit(frame, code.co_firstlineno, "call")
            return self.trace
        if event == "line":
            prev = self.pending.get(frame)
            if prev is not None:
                self.executed(frame, prev, frame.f_lineno)
            self.pending[frame] = frame.f_lineno
        elif event == "return":
            prev = self.pending.pop(frame, None)
            if code.co_name == "<module>":
                if prev is not None:
                    self.executed(frame, prev, None)
            else:
                self.executed(frame, prev if prev is not None else frame.f_lineno, None,
                              event="return", extra={"ret": arg})
        elif event == "exception":
            exc_type, exc, _tb = arg
            self.last_exception = (exc_type.__name__, str(exc), frame.f_lineno)
        return self.trace

    def run(self):
        code = compile(self.source, USER_FILE, "exec")
        g = {"__name__": "__main__", "__builtins__": __builtins__}
        self.module_globals = g
        error = None
        truncated = False
        old_out = sys.stdout
        sys.stdout = self.out
        sys.settrace(self.trace)
        try:
            exec(code, g)
        except StepLimit:
            truncated = True
        except Exception as exc:   # user error: report it as the final step
            line = None
            tb = exc.__traceback__
            while tb is not None:
                if tb.tb_frame.f_code.co_filename == USER_FILE:
                    line = tb.tb_lineno
                tb = tb.tb_next
            error = {"type": type(exc).__name__, "message": str(exc), "line": line}
        finally:
            sys.settrace(None)
            sys.stdout = old_out
        tail = self.out.getvalue()[self.out_pos:]
        if error and self.steps:
            last = dict(self.steps[-1])
            last.update({"event": "error", "line": error["line"] or last["line"], "error": error})
            last.pop("ret", None)
            last.pop("branch", None)
            if tail:
                last["out"] = tail
            self.steps.append(last)
        elif tail and self.steps:
            self.steps[-1]["out"] = self.steps[-1].get("out", "") + tail
        return {"ok": error is None and not truncated, "steps": self.steps, "error": error,
                "truncated": truncated, "pointers": self.pointers, "loops": self.loops}


def trace_program(source, max_steps=1500):
    try:
        tracer = Tracer(source, int(max_steps))
    except SyntaxError as exc:
        return json.dumps({"ok": False, "steps": [], "pointers": [], "loops": [], "truncated": False,
                           "error": {"type": "SyntaxError", "message": exc.msg, "line": exc.lineno}})
    return json.dumps(tracer.run())


# --------------------------------------------------------------------------
# Test runner for levels
# --------------------------------------------------------------------------

class _Budget:
    def __init__(self, limit):
        self.left = limit
        self.ops = OPCODE_BUDGET

    def __call__(self, frame, event, arg):
        if frame.f_code.co_filename != USER_FILE:
            return None
        if event == "call":
            frame.f_trace_opcodes = True
        elif event == "opcode":
            self.ops -= 1
            if self.ops < 0:
                raise TimeoutError("Took too many steps - is there an infinite loop?")
        elif event == "line":
            self.left -= 1
            if self.left < 0:
                raise TimeoutError("Took too many steps - is there an infinite loop?")
        return self


def _build_linked(values, ns):
    cls = ns.get("ListNode")
    head = None
    for v in reversed(values or []):
        head = cls(v, head)
    return head


def _build_tree(values, ns):
    cls = ns.get("TreeNode")
    if not values or values[0] is None:
        return None
    root = cls(values[0])
    queue = deque([root])
    i = 1
    while queue and i < len(values):
        node = queue.popleft()
        if i < len(values) and values[i] is not None:
            node.left = cls(values[i])
            queue.append(node.left)
        i += 1
        if i < len(values) and values[i] is not None:
            node.right = cls(values[i])
            queue.append(node.right)
        i += 1
    return root


def normalize(value, seen=None):
    """Turn results into plain JSON-like data (tuples -> lists, nodes -> lists)."""
    if seen is None:
        seen = set()
    if isinstance(value, (list, tuple)):
        return [normalize(v, seen) for v in value]
    if isinstance(value, dict):
        return {normalize(k, seen) if not isinstance(k, (list, dict)) else str(k): normalize(v, seen) for k, v in value.items()}
    if isinstance(value, (set, frozenset)):
        return sorted(normalize(v, seen) for v in value)
    if _is_user_object(value):
        if id(value) in seen:
            return "<cycle>"
        seen.add(id(value))
        d = vars(value)
        if "next" in d:                      # linked list -> python list
            out, node, guard = [], value, 0
            while node is not None and guard < 10000:
                out.append(normalize(getattr(node, "val", None), seen))
                node = getattr(node, "next", None)
                guard += 1
            return out
        if "left" in d or "right" in d:      # tree -> level-order list
            out, queue = [], deque([value])
            while queue:
                node = queue.popleft()
                if node is None:
                    out.append(None)
                    continue
                out.append(normalize(getattr(node, "val", None), seen))
                queue.append(getattr(node, "left", None))
                queue.append(getattr(node, "right", None))
            while out and out[-1] is None:
                out.pop()
            return out
        return {k: normalize(v, seen) for k, v in d.items()}
    return value


def _sort_key(v):
    return json.dumps(v, sort_keys=True)


def _compare(got, expected, mode):
    if mode == "unordered":
        return sorted(got, key=_sort_key) == sorted(expected, key=_sort_key)
    if mode == "unordered_nested":
        g = sorted((sorted(x, key=_sort_key) for x in got), key=_sort_key)
        e = sorted((sorted(x, key=_sort_key) for x in expected), key=_sort_key)
        return g == e
    if mode == "float":
        return abs(got - expected) < 1e-6
    return got == expected


def run_tests(source, spec_json):
    """spec: {fn, tests:[{args, expected}], compare, inplace, pure, argTypes}"""
    spec = json.loads(spec_json)
    results = []
    ns = {"__name__": "__main__", "__builtins__": __builtins__}
    sink = io.StringIO()
    old_out = sys.stdout
    sys.stdout = sink
    try:
        sys.settrace(_Budget(TEST_LINE_BUDGET))
        try:
            exec(compile(source, USER_FILE, "exec"), ns)
        finally:
            sys.settrace(None)
    except Exception as exc:
        sys.stdout = old_out
        return json.dumps({"passed": 0, "total": len(spec["tests"]), "results": [],
                           "error": "%s: %s" % (type(exc).__name__, exc)})
    finally:
        sys.stdout = old_out

    fn = ns.get(spec["fn"])
    if not callable(fn):
        return json.dumps({"passed": 0, "total": len(spec["tests"]), "results": [],
                           "error": "Define a function called %s()" % spec["fn"]})

    arg_types = spec.get("argTypes") or []
    for test in spec["tests"]:
        raw_args = copy.deepcopy(test["args"])
        args = []
        for i, a in enumerate(raw_args):
            kind = arg_types[i] if i < len(arg_types) else None
            if kind == "linked":
                args.append(_build_linked(a, ns))
            elif kind == "tree":
                args.append(_build_tree(a, ns))
            else:
                args.append(a)
        before = copy.deepcopy(raw_args)
        entry = {"args": test["args"], "expected": test["expected"]}
        sys.stdout = sink
        try:
            sys.settrace(_Budget(TEST_LINE_BUDGET))
            try:
                got = fn(*args)
            finally:
                sys.settrace(None)
            if spec.get("inplace") is not None:
                got = args[spec["inplace"]]
            got = normalize(got)
            if got is None and spec.get("returnType") in ("linked", "tree"):
                got = []
            ok = _compare(got, test["expected"], spec.get("compare", "exact"))
            if ok and spec.get("pure") and normalize(args) != before:
                ok = False
                entry["note"] = "The input was modified - make a copy instead."
            entry.update({"got": got, "ok": bool(ok)})
        except Exception as exc:
            entry.update({"got": None, "ok": False, "error": "%s: %s" % (type(exc).__name__, exc)})
        finally:
            sys.stdout = old_out
        results.append(entry)
    passed = sum(1 for r in results if r["ok"])
    return json.dumps({"passed": passed, "total": len(results), "results": results, "error": None},
                      default=repr)
