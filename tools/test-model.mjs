// Smoke test for js/model.js: traces sample programs with CPython and checks
// every step lays out without NaNs and decodes to at least one operation.
// Usage: node visualizer/tools/test-model.mjs [--verbose]
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layoutStep, decodeStep, TokenBook } from '../js/model.js';

const here = dirname(fileURLToPath(import.meta.url));
const verbose = process.argv.includes('--verbose');

export function trace(source, maxSteps = 1500) {
  const out = execFileSync('python3', [join(here, 'trace-cli.py'), 'trace'], { input: JSON.stringify({ source, maxSteps }), maxBuffer: 256 * 1024 * 1024 });
  return JSON.parse(out.toString());
}

export function checkTrace(name, source, trace) {
  const lines = source.split('\n');
  const ctx = { tokens: new TokenBook(), pointers: trace.pointers };
  let prev = null;
  const problems = [];
  trace.steps.forEach((step, i) => {
    const spec = layoutStep(step, ctx);
    const ops = decodeStep(step, prev, lines);
    const bad = JSON.stringify(spec).match(/null,|NaN/) && JSON.stringify(spec, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? 'NaN!' : v)).includes('NaN!');
    if (bad) problems.push(`step ${i}: non-finite number in layout`);
    const keys = new Set();
    for (const group of ['frames', 'slots', 'values', 'cells', 'objects', 'arrows', 'markers', 'cursors']) {
      for (const e of spec[group]) {
        if (keys.has(e.key)) problems.push(`step ${i}: duplicate key ${e.key}`);
        keys.add(e.key);
      }
    }
    if (!ops.length) problems.push(`step ${i}: no decode ops`);
    if (verbose) console.log(`${String(step.line).padStart(3)} ${step.event.padEnd(6)} ${ops.map(o => `${o.op} ${o.text}`).join(' | ')}  [m:${spec.markers.map(m => m.label).join(',')} c:${spec.cursors.map(c => c.label).join(',')}]`);
    prev = step;
  });
  return problems;
}

const samples = {
  twoSum: `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        need = target - n
        if need in seen:
            return [seen[need], i]
        seen[n] = i
    return []

print(two_sum([2, 7, 11, 15], 9))
`,
  bubble: `arr = [5, 1, 4, 2]
n = len(arr)
for i in range(n):
    for j in range(n - 1 - i):
        if arr[j] > arr[j + 1]:
            arr[j], arr[j + 1] = arr[j + 1], arr[j]
print(arr)
`,
  linked: `class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next

def reverse(head):
    prev = None
    while head:
        nxt = head.next
        head.next = prev
        prev = head
        head = nxt
    return prev

head = ListNode(1, ListNode(2, ListNode(3)))
head = reverse(head)
`,
  matrix: `grid = [[1, 2], [3, 4]]
row = grid[1]
row.append(5)
stack = []
stack.append("(")
stack.pop()
words = {"a": 1}
words["b"] = 2
del words["a"]
`,
  recursion: `def fact(n):
    if n <= 1:
        return 1
    return n * fact(n - 1)
print(fact(4))
`,
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let failed = 0;
  for (const [name, src] of Object.entries(samples)) {
    if (verbose) console.log(`\n== ${name}`);
    const t = trace(src);
    const problems = checkTrace(name, src, t);
    if (!t.ok) problems.push(`trace failed: ${JSON.stringify(t.error)}`);
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${name} (${t.steps.length} steps)`);
    problems.slice(0, 5).forEach(p => console.log('     ' + p));
    failed += problems.length ? 1 : 0;
  }
  process.exit(failed ? 1 : 0);
}
