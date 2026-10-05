// Pure data layer: turns tracer steps into (1) a scene description the 3D
// renderer can reconcile and (2) human-readable FETCH / DECODE text.
// No DOM or Three.js here, so it can be unit-tested in Node.

export const U = {
  STEP: 1.2,        // distance between neighbouring cells
  ROW: 1.25,        // distance between rows (variables, dict entries, fields)
  FRAME_W: 9,
  LABEL_W: 2.7,
  HEAP_X: 12.5,
  HGAP: 2.4,
  VGAP: 1.0,
  TITLE: 1.25,
};

const SEQ_TYPES = new Set(['list', 'tuple', 'str', 'deque', 'set']);

// ---------------------------------------------------------------- values

export function displayText(v, { inString = false } = {}) {
  if (!v) return '';
  if (v.k === 'ref') return '•';
  if (v.t === 'str') {
    if (inString) return v.r === ' ' ? '␣' : v.r;
    const s = v.r.length > 18 ? v.r.slice(0, 17) + '…' : v.r;
    return `'${s}'`;
  }
  return v.r.length > 18 ? v.r.slice(0, 17) + '…' : v.r;
}

export function cubeWidth(text) {
  const n = [...text].length;
  return n <= 3 ? 1 : Math.min(4.4, 0.5 + 0.18 * n);
}

export function sig(v) {
  return v.k === 'ref' ? `ref:${v.id}` : `${v.t}:${v.r}`;
}

// Short description of a value for the DECODE panel.
export function brief(v, heap) {
  if (!v) return '?';
  if (v.k !== 'ref') return v.t === 'str' ? `'${v.r}'` : v.r;
  const o = heap[v.id];
  if (!o) return 'object';
  if (o.type === 'str') return `'${o.items.map(i => i.r).join('')}'`;
  if (o.type === 'dict') {
    const inner = o.entries.slice(0, 3).map(([k, val]) => `${brief(k, heap)}: ${brief(val, heap)}`).join(', ');
    return `{${inner}${o.entries.length > 3 ? ', …' : ''}}`;
  }
  if (o.type === 'obj') {
    const f = o.fields.find(([, fv]) => fv.k !== 'ref');
    return f ? `${o.cls}(${f[0]}=${brief(f[1], heap)})` : `${o.cls}(…)`;
  }
  if (o.items) {
    const inner = o.items.slice(0, 5).map(i => brief(i, heap)).join(', ');
    const [l, r] = o.type === 'tuple' ? ['(', ')'] : o.type === 'set' ? ['{', '}'] : ['[', ']'];
    return `${l}${inner}${o.items.length > 5 ? ', …' : ''}${r}`;
  }
  return o.r || 'object';
}

// --------------------------------------------------------- element tokens
// Stable identities for elements inside containers, so that a swap animates
// as two cubes trading places rather than two cubes changing labels.

export class TokenBook {
  constructor() { this.prev = new Map(); this.n = 0; }

  assign(objId, sigs) {
    const old = this.prev.get(objId) || { sigs: [], toks: [] };
    const toks = new Array(sigs.length).fill(null);
    const used = new Set();
    sigs.forEach((s, j) => {
      if (j < old.sigs.length && old.sigs[j] === s) { toks[j] = old.toks[j]; used.add(j); }
    });
    sigs.forEach((s, j) => {
      if (toks[j] !== null) return;
      let best = -1;
      for (let i = 0; i < old.sigs.length; i++) {
        if (used.has(i) || old.sigs[i] !== s) continue;
        if (best < 0 || Math.abs(i - j) < Math.abs(best - j)) best = i;
      }
      if (best >= 0) { toks[j] = old.toks[best]; used.add(best); }
    });
    for (let j = 0; j < toks.length; j++) if (toks[j] === null) toks[j] = `t${this.n++}`;
    return toks;
  }

  commit(objId, sigs, toks) { this.prev.set(objId, { sigs, toks }); }
}

// ------------------------------------------------------------- layout

function isMatrix(o, heap, placed) {
  if (o.type !== 'list' || o.items.length === 0) return false;
  const ids = new Set();
  return o.items.every(it => {
    if (it.k !== 'ref' || placed.has(it.id) || ids.has(it.id)) return false;
    ids.add(it.id);
    const inner = heap[it.id];
    return inner && inner.type === 'list' && inner.items.every(x => x.k !== 'ref');
  });
}

function valueSpec(key, v, x, y, extra = {}) {
  const text = displayText(v, extra);
  const w = v.k === 'ref' ? 0.55 : cubeWidth(text);
  return { key, x, y, w, text, t: v.k === 'ref' ? 'ref' : v.t, sig: sig(v), refId: v.k === 'ref' ? v.id : null };
}

/**
 * Build the scene description for one step.
 * ctx: { tokens: TokenBook, pointers: [[container, index]], loops }
 */
export function layoutStep(step, ctx) {
  const spec = { frames: [], slots: [], values: [], cells: [], objects: [], arrows: [], markers: [], cursors: [], bounds: null };
  const heap = step.heap;
  const anchors = new Map();   // heap id -> {key, x, y} where arrows land
  const cellPos = new Map();   // heap id -> [{x, y}] centre of each cell
  const entryPos = new Map();  // heap id -> Map(keySig -> {x, y})
  const sockets = [];          // {key, x, y, refId}

  // ---- stack frames: global grows down from y=0, calls stack upwards
  const frames = step.frames;
  let upY = 0.5;
  frames.forEach((f, i) => {
    const vars = [...f.vars];
    if (i === frames.length - 1 && step.ret && f.fid === step.fid) vars.push(['return', step.ret]);
    const h = U.TITLE + Math.max(1, vars.length) * U.ROW + 0.35;
    let top;
    if (i === 0) top = 0; else { top = upY + h; upY = top + 0.5; }
    const active = f.fid === step.fid;
    spec.frames.push({ key: `frame:${f.fid}`, title: f.name === 'global' ? 'global frame' : `${f.name}()`, x: U.FRAME_W / 2, y: top - h / 2, w: U.FRAME_W, h, active, top });
    vars.forEach(([name, v], r) => {
      const y = top - U.TITLE - r * U.ROW - U.ROW / 2 + 0.1;
      const isRet = name === 'return' && step.ret && r === vars.length - 1 && i === frames.length - 1;
      spec.slots.push({ key: `slot:${f.fid}:${name}`, label: isRet ? '↩ return' : name, x: 0.35 + U.LABEL_W / 2, y, w: U.LABEL_W, ret: isRet });
      const key = `var:${f.fid}:${name}`;
      const vs = valueSpec(key, v, 0, y);
      vs.x = 0.35 + U.LABEL_W + 0.45 + vs.w / 2;
      spec.values.push(vs);
      if (v.k === 'ref') sockets.push({ key, x: vs.x, y, refId: v.id });
    });
  });

  // ---- heap: right-down tree layout starting from frame references
  const roots = [];
  frames.forEach(f => f.vars.forEach(([, v]) => { if (v.k === 'ref') roots.push(v.id); }));
  if (step.ret && step.ret.k === 'ref') roots.push(step.ret.id);
  const placed = new Set();
  const embedded = new Map(); // inner list id -> {parent, row}

  const childRefs = (o) => {
    const out = [];
    const push = (v) => { if (v && v.k === 'ref' && heap[v.id]) out.push(v.id); };
    if (o.items) o.items.forEach(push);
    if (o.entries) o.entries.forEach(([k, v]) => { push(k); push(v); });
    if (o.fields) o.fields.forEach(([, v]) => push(v));
    return out;
  };

  const sizeOf = (id) => {
    const o = heap[id];
    if (SEQ_TYPES.has(o.type)) {
      if (isMatrix(o, heap, placed)) {
        const rows = o.items.map(it => heap[it.id]);
        const cols = Math.max(1, ...rows.map(r => r.items.length));
        return { w: cols * U.STEP + 0.6, h: U.TITLE + rows.length * U.STEP + 0.3, matrix: true };
      }
      const cw = cellWidth(o);
      return { w: Math.max(1, o.items.length) * (cw + 0.2) + 0.4, h: U.TITLE + U.STEP + 0.7, cw };
    }
    if (o.type === 'dict') {
      const kw = Math.max(1, ...o.entries.map(([k]) => cubeWidth(displayText(k))));
      const vw = Math.max(1, ...o.entries.map(([, v]) => v.k === 'ref' ? 0.55 : cubeWidth(displayText(v))));
      return { w: kw + vw + 1.4, h: U.TITLE + Math.max(1, o.entries.length) * U.ROW + 0.3, kw, vw };
    }
    if (o.type === 'obj') {
      const vw = Math.max(1, ...o.fields.map(([, v]) => v.k === 'ref' ? 0.55 : cubeWidth(displayText(v))));
      return { w: 2.2 + vw + 0.6, h: U.TITLE + Math.max(1, o.fields.length) * U.ROW + 0.3, vw };
    }
    return { w: Math.max(2, cubeWidth(o.r || '') + 0.6), h: U.TITLE + U.STEP };
  };

  const placeObject = (id, left, top) => {
    const o = heap[id];
    const s = sizeOf(id);
    const title = o.type === 'obj' ? o.cls : o.type === 'list' && s.matrix ? 'list (grid)' : o.type;
    const cx = left + s.w / 2, cy = top - s.h / 2;
    spec.objects.push({ key: `obj:${id}`, x: cx, y: cy, w: s.w, h: s.h, title, type: o.type, more: o.more || 0 });
    anchors.set(id, { key: `obj:${id}`, x: left, y: top - U.TITLE + 0.15 });

    if (SEQ_TYPES.has(o.type) && s.matrix) {
      const rowY = (r) => top - U.TITLE - r * U.STEP - U.STEP / 2;
      o.items.forEach((it, r) => {
        const inner = heap[it.id];
        embedded.set(it.id, { parent: id, row: r });
        anchors.set(it.id, { key: `obj:${id}`, x: left, y: rowY(r) });
        const sigs = inner.items.map(sig);
        const toks = ctx.tokens.assign(it.id, sigs);
        ctx.tokens.commit(it.id, sigs, toks);
        const cells = [];
        inner.items.forEach((v, c) => {
          const x = left + 0.3 + c * U.STEP + U.STEP / 2;
          spec.cells.push({ key: `cell:${it.id}:${c}`, x, y: rowY(r), w: 1.05, label: r === 0 ? String(c) : null });
          spec.values.push(valueSpec(`el:${it.id}:${toks[c]}`, v, x, rowY(r)));
          cells.push({ x, y: rowY(r) });
        });
        cellPos.set(it.id, cells);
        placed.add(it.id);
      });
      return s;
    }

    if (SEQ_TYPES.has(o.type)) {
      const y = top - U.TITLE - U.STEP / 2 + 0.05;
      const sigs = o.items.map(sig);
      const toks = ctx.tokens.assign(id, sigs);
      ctx.tokens.commit(id, sigs, toks);
      const cells = [];
      o.items.forEach((v, c) => {
        const x = left + 0.3 + c * (s.cw + 0.2) + (s.cw + 0.2) / 2;
        spec.cells.push({ key: `cell:${id}:${c}`, x, y, w: s.cw + 0.05, label: o.type === 'set' ? null : String(c) });
        const vs = valueSpec(`el:${id}:${toks[c]}`, v, x, y, { inString: o.type === 'str' });
        spec.values.push(vs);
        if (v.k === 'ref') sockets.push({ key: vs.key, x, y, refId: v.id });
        cells.push({ x, y, w: s.cw });
      });
      if (o.items.length === 0) spec.cells.push({ key: `cell:${id}:empty`, x: left + 0.3 + 0.6, y, w: 1.05, label: 'empty', ghost: true });
      cellPos.set(id, cells);
      return s;
    }

    if (o.type === 'dict') {
      const map = new Map();
      o.entries.forEach(([k, v], r) => {
        const y = top - U.TITLE - r * U.ROW - U.ROW / 2 + 0.1;
        const ks = sig(k);
        const kx = left + 0.3 + s.kw / 2;
        const keyVs = valueSpec(`dk:${id}:${ks}`, k, kx, y);
        keyVs.isKey = true;
        spec.values.push(keyVs);
        const vv = valueSpec(`dv:${id}:${ks}`, v, 0, y);
        vv.x = left + 0.3 + s.kw + 0.8 + vv.w / 2;
        spec.values.push(vv);
        spec.cells.push({ key: `cell:${id}:${ks}`, x: left + s.w / 2, y, w: s.w - 0.3, row: true });
        if (v.k === 'ref') sockets.push({ key: vv.key, x: vv.x, y, refId: v.id });
        if (k.k === 'ref') sockets.push({ key: keyVs.key, x: kx, y, refId: k.id });
        map.set(ks, { x: kx, y, w: s.kw });
      });
      entryPos.set(id, map);
      if (o.entries.length === 0) spec.cells.push({ key: `cell:${id}:empty`, x: left + s.w / 2, y: top - U.TITLE - 0.55, w: s.w - 0.3, label: 'empty', ghost: true, row: true });
      return s;
    }

    if (o.type === 'obj') {
      o.fields.forEach(([name, v], r) => {
        const y = top - U.TITLE - r * U.ROW - U.ROW / 2 + 0.1;
        spec.slots.push({ key: `field:${id}:${name}`, label: '.' + name, x: left + 0.3 + 1.0, y, w: 2.0, field: true });
        const vs = valueSpec(`fv:${id}:${name}`, v, 0, y);
        vs.x = left + 2.5 + 0.2 + vs.w / 2;
        spec.values.push(vs);
        if (v.k === 'ref') sockets.push({ key: vs.key, x: vs.x, y, refId: v.id });
      });
      return s;
    }
    return s;
  };

  // Depth-first: first child continues to the right, siblings go below.
  const layoutTree = (id, left, top) => {
    placed.add(id);
    const s = placeObject(id, left, top);
    let used = s.h;
    let cy = top;
    for (const cid of childRefs(heap[id])) {
      if (placed.has(cid)) continue;
      const h = layoutTree(cid, left + s.w + U.HGAP, cy);
      cy -= h + U.VGAP;
      used = Math.max(used, top - cy - U.VGAP);
    }
    return used;
  };

  // Roots stack downwards; once a column gets taller than the stack area,
  // start a new column to the right so the camera doesn't zoom far out.
  const colHeight = Math.max(9, ...spec.frames.map((f) => f.h + 2));
  let heapY = 0;
  let colX = U.HEAP_X;
  let colRight = U.HEAP_X;
  for (const id of roots) {
    if (placed.has(id) || !heap[id]) continue;
    if (heapY < -colHeight) { colX = colRight + U.HGAP; heapY = 0; }
    const before = spec.objects.length;
    const h = layoutTree(id, colX, heapY);
    for (const o of spec.objects.slice(before)) colRight = Math.max(colRight, o.x + o.w / 2);
    heapY -= h + U.VGAP * 1.4;
  }

  // ---- arrows from sockets to their targets
  for (const s of sockets) {
    const a = anchors.get(s.refId);
    if (!a) continue;
    spec.arrows.push({ key: `arrow:${s.key}`, fromKey: s.key, toKey: a.key, from: [s.x, s.y], to: [a.x, a.y] });
  }

  // ---- index pointers (i, j, left, mid ...) and dict key highlights
  const markerCount = new Map();
  for (const f of frames) {
    const vars = new Map(f.vars);
    for (const [cname, iname] of ctx.pointers || []) {
      const c = vars.get(cname), iv = vars.get(iname);
      if (!c || !iv || c.k !== 'ref') continue;
      const o = heap[c.id];
      if (!o) continue;
      if (o.items && iv.k === 'p' && iv.t === 'int') {
        const idx = parseInt(iv.r, 10);
        const cells = cellPos.get(c.id);
        if (!cells || idx < 0 || idx > cells.length) continue;
        const base = idx < cells.length ? cells[idx] : (cells.length ? { x: cells[cells.length - 1].x + U.STEP, y: cells[cells.length - 1].y } : null);
        if (!base) continue;
        const slotKey = `${c.id}:${idx}`;
        const n = markerCount.get(slotKey) || 0;
        markerCount.set(slotKey, n + 1);
        spec.markers.push({ key: `marker:${f.fid}:${iname}:${c.id}`, x: base.x, y: base.y - 1.15 - n * 0.75, label: `${iname}=${idx}`, name: iname, past: idx >= cells.length, active: f.fid === step.fid });
      } else if (o.type === 'dict') {
        const pos = entryPos.get(c.id);
        const hit = pos && pos.get(sig(iv));
        if (!hit) continue;
        spec.markers.push({ key: `marker:${f.fid}:${iname}:${c.id}`, x: hit.x - hit.w / 2 - 0.9, y: hit.y, label: iname, name: iname, side: true, active: f.fid === step.fid });
      }
    }
  }

  // ---- loop cursors
  for (const cur of step.cursors || []) {
    const f = frames.find(fr => fr.fid === cur.fid);
    if (!f) continue;
    const v = new Map(f.vars).get(cur.seq);
    if (!v || v.k !== 'ref') continue;
    const o = heap[v.id];
    const cells = cellPos.get(v.id);
    if (o && o.type === 'dict') {
      const ent = o.entries[cur.idx];
      const pos = entryPos.get(v.id);
      if (ent && pos) {
        const p = pos.get(sig(ent[0]));
        spec.cursors.push({ key: `cursor:${cur.fid}:${cur.line}`, x: p.x, y: p.y, w: p.w + 0.25, label: `for ${cur.target}`, done: false });
      }
      continue;
    }
    if (!cells) continue;
    const done = cur.idx >= cells.length;
    const base = done ? (cells.length ? { x: cells[cells.length - 1].x + U.STEP, y: cells[cells.length - 1].y, w: 1 } : null) : cells[cur.idx];
    if (!base) continue;
    spec.cursors.push({ key: `cursor:${cur.fid}:${cur.line}`, x: base.x, y: base.y, w: (base.w || 1) + 0.3, label: done ? 'loop done' : `for ${cur.target}`, done });
  }

  // ---- bounds for the camera
  let minX = -0.5, maxX = U.FRAME_W + 0.5, minY = -2, maxY = 1;
  const grow = (x, y, w = 0, h = 0) => {
    minX = Math.min(minX, x - w / 2); maxX = Math.max(maxX, x + w / 2);
    minY = Math.min(minY, y - h / 2); maxY = Math.max(maxY, y + h / 2);
  };
  spec.frames.forEach(f => grow(f.x, f.y, f.w, f.h));
  spec.objects.forEach(o => grow(o.x, o.y, o.w, o.h));
  spec.markers.forEach(m => grow(m.x, m.y, 1, 1));
  spec.bounds = { minX, maxX, minY, maxY };
  return spec;
}

function cellWidth(o) {
  let w = 1;
  for (const v of o.items) w = Math.max(w, v.k === 'ref' ? 1 : cubeWidth(displayText(v, { inString: o.type === 'str' })));
  return w;
}

// ------------------------------------------------------------ decode

function nameFor(id, step) {
  const active = step.frames.find(f => f.fid === step.fid);
  const order = active ? [active, ...step.frames.filter(f => f !== active).reverse()] : step.frames;
  for (const f of order) for (const [n, v] of f.vars) if (v.k === 'ref' && v.id === id) return n;
  for (const [pid, o] of Object.entries(step.heap)) {
    if (o.fields) for (const [fn, v] of o.fields) if (v.k === 'ref' && v.id === id) return `${o.cls}.${fn}`;
  }
  return step.heap[id] ? step.heap[id].type : 'object';
}

function conditionText(src) {
  const m = src.trim().match(/^(?:if|elif|while)\s+(.*):\s*(#.*)?$/);
  return m ? m[1] : src.trim();
}

/**
 * Describe what a step did, as a list of {op, text}. `prev` may be null.
 */
export function decodeStep(step, prev, lines) {
  const ops = [];
  const src = (lines[step.line - 1] || '').trim();
  const heap = step.heap;
  const pheap = prev ? prev.heap : {};

  if (step.event === 'error') {
    ops.push({ op: 'ERROR', text: `${step.error.type}: ${step.error.message}` });
    return ops;
  }
  if (step.event === 'call') {
    const f = step.frames[step.frames.length - 1];
    const args = f.vars.map(([n, v]) => `${n}=${brief(v, heap)}`).join(', ');
    ops.push({ op: 'CALL', text: `${f.name}(${args}) — push a new stack frame` });
    return ops;
  }

  if (step.branch) {
    const b = step.branch;
    if (b.kind === 'for') {
      const cur = (step.cursors || []).find(c => c.line === step.line && c.fid === step.fid);
      if (b.taken) ops.push({ op: 'NEXT', text: cur ? `take item #${cur.idx} of ${cur.seq} → ${cur.target}` : 'take the next item → loop body' });
      else ops.push({ op: 'EXIT', text: cur ? `${cur.seq} has no more items — leave the loop` : 'no more items — leave the loop' });
    } else {
      const label = b.kind === 'while' ? 'LOOP?' : 'TEST';
      ops.push({ op: label, text: `${conditionText(src)} → ${b.taken ? 'True' : 'False'}${b.kind === 'while' ? (b.taken ? ', run the body' : ', stop looping') : (b.taken ? ', enter the block' : ', skip the block')}` });
    }
  }

  // variables in every frame that already existed
  const prevFrames = new Map((prev ? prev.frames : []).map(f => [f.fid, f]));
  for (const f of step.frames) {
    const pf = prevFrames.get(f.fid) || (prev ? null : { vars: [] });
    if (!pf) continue;
    const before = new Map(pf.vars);
    for (const [n, v] of f.vars) {
      const old = before.get(n);
      if (v.t === 'function' || v.t === 'class') {
        if (!old) ops.push({ op: 'DEFINE', text: `${v.t} ${v.r.replace(/^class /, '')}` });
        continue;
      }
      if (!old) {
        const isNew = v.k === 'ref' && !pheap[v.id];
        ops.push({ op: 'STORE', text: `${n} ← ${brief(v, heap)}${isNew ? `  (new ${heap[v.id] ? heap[v.id].type : 'object'} in memory)` : v.k === 'ref' ? '  (points at an object already in memory)' : ''}` });
      } else if (sig(old) !== sig(v)) {
        ops.push({ op: 'UPDATE', text: `${n}: ${brief(old, pheap)} → ${brief(v, heap)}` });
      }
    }
  }

  // mutations of heap objects that survived
  for (const [id, o] of Object.entries(heap)) {
    const p = pheap[id];
    if (!p || p.type !== o.type) continue;
    const name = nameFor(id, step);
    if (o.items && p.items) {
      const a = p.items.map(sig), b = o.items.map(sig);
      if (a.join('|') === b.join('|')) continue;
      if (b.length === a.length + 1 && a.every((s, i) => s === b[i])) ops.push({ op: 'APPEND', text: `${brief(o.items[b.length - 1], heap)} → end of ${name} (index ${b.length - 1})` });
      else if (b.length === a.length - 1 && b.every((s, i) => s === a[i])) ops.push({ op: 'POP', text: `${brief(p.items[a.length - 1], pheap)} removed from the end of ${name}` });
      else if (b.length === a.length - 1 && b.every((s, i) => s === a[i + 1])) ops.push({ op: 'POP', text: `${brief(p.items[0], pheap)} removed from the front of ${name} — everything shifts left` });
      else if (b.length === a.length + 1 && a.every((s, i) => s === b[i + 1])) ops.push({ op: 'INSERT', text: `${brief(o.items[0], heap)} → front of ${name} — everything shifts right` });
      else if (b.length === a.length) {
        const changed = [];
        b.forEach((s, i) => { if (s !== a[i]) changed.push(i); });
        if (changed.length === 2 && a[changed[0]] === b[changed[1]] && a[changed[1]] === b[changed[0]]) {
          ops.push({ op: 'SWAP', text: `${name}[${changed[0]}] ⇄ ${name}[${changed[1]}]` });
        } else {
          changed.slice(0, 3).forEach(i => ops.push({ op: 'WRITE', text: `${name}[${i}] = ${brief(o.items[i], heap)}  (was ${brief(p.items[i], pheap)})` }));
          if (changed.length > 3) ops.push({ op: 'WRITE', text: `…and ${changed.length - 3} more cells of ${name}` });
        }
      } else ops.push({ op: 'RESIZE', text: `${name} now has ${o.items.length} items (was ${p.items.length})` });
    } else if (o.entries && p.entries) {
      const pm = new Map(p.entries.map(([k, v]) => [sig(k), [k, v]]));
      const nm = new Map(o.entries.map(([k, v]) => [sig(k), [k, v]]));
      for (const [ks, [k, v]] of nm) {
        const old = pm.get(ks);
        if (!old) ops.push({ op: 'INSERT', text: `${name}[${brief(k, heap)}] = ${brief(v, heap)}  (new key)` });
        else if (sig(old[1]) !== sig(v)) ops.push({ op: 'UPDATE', text: `${name}[${brief(k, heap)}]: ${brief(old[1], pheap)} → ${brief(v, heap)}` });
      }
      for (const [ks, [k]] of pm) if (!nm.has(ks)) ops.push({ op: 'DELETE', text: `key ${brief(k, pheap)} removed from ${name}` });
    } else if (o.fields && p.fields) {
      const pm = new Map(p.fields);
      for (const [fname, v] of o.fields) {
        const old = pm.get(fname);
        if (!old) ops.push({ op: 'STORE', text: `${name}.${fname} = ${brief(v, heap)}` });
        else if (sig(old) !== sig(v)) ops.push({ op: 'LINK', text: `${name}.${fname}: ${brief(old, pheap)} → ${brief(v, heap)}` });
      }
    }
  }

  if (step.out) ops.push({ op: 'PRINT', text: JSON.stringify(step.out.replace(/\n$/, '')) });
  if (step.event === 'return') ops.push({ op: 'RETURN', text: `${brief(step.ret, heap)} — pop ${step.frames[step.frames.length - 1].name}() off the stack` });
  if (!ops.length) ops.push({ op: 'EVAL', text: src.startsWith('def ') ? 'define a function' : 'evaluate — no memory changed' });
  return ops;
}
