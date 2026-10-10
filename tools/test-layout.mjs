// Unit tests for js/layout.js, the geometry behind the movable panels.
// Usage: node tools/test-layout.mjs
import assert from 'node:assert/strict';
import {
  GUTTER, MIN, clampRect, defaultRects, dockInsets, fromFractions, layoutKey,
  parseLayout, resizeRect, serialize, snapRect,
} from '../js/layout.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; } catch (err) { console.error(`✗ ${name}`); throw err; }
};
const W = 1400, H = 800, g = GUTTER;

test('default layout is a docked left column with gutters', () => {
  const r = defaultRects(W, H);
  assert.equal(r.problem.x, g);
  assert.equal(r.problem.y, g);
  assert.equal(r.code.y, r.problem.y + r.problem.h + g);
  assert.equal(r.code.y + r.code.h, H - g);
  assert.equal(r.problem.w, Math.round(W * 0.36));
  assert.deepEqual(dockInsets(r, W, H), { left: g + r.problem.w, right: 0 });
});

test('default column never gets narrower than 380px', () => {
  assert.equal(defaultRects(960, H).problem.w, 380);
});

test('clampRect keeps panels inside the workspace and at minimum size', () => {
  assert.deepEqual(clampRect({ x: -50, y: 900, w: 100, h: 50 }, W, H, MIN.code), { x: 0, y: H - MIN.code.h, w: MIN.code.w, h: MIN.code.h });
  assert.deepEqual(clampRect({ x: 10, y: 10, w: 5000, h: 5000 }, W, H), { x: 0, y: 0, w: W, h: H });
});

test('resizing from the west edge keeps the east edge fixed', () => {
  const start = { x: 100, y: 100, w: 400, h: 300 };
  assert.deepEqual(resizeRect(start, 'w', -50, 0, W, H), { x: 50, y: 100, w: 450, h: 300 });
  // shrinking past the minimum stops at the minimum, anchored on the right
  assert.deepEqual(resizeRect(start, 'w', 390, 0, W, H, { w: 300, h: 100 }), { x: 200, y: 100, w: 300, h: 300 });
});

test('resizing a corner moves both edges and respects bounds', () => {
  const start = { x: 100, y: 100, w: 400, h: 300 };
  assert.deepEqual(resizeRect(start, 'se', 2000, 2000, W, H), { x: 100, y: 100, w: W - 100, h: H - 100 });
  assert.deepEqual(resizeRect(start, 'nw', -500, -500, W, H), { x: 0, y: 0, w: 500, h: 400 });
});

test('dragging near an edge snaps to the gutter', () => {
  assert.deepEqual(snapRect({ x: 4, y: 300, w: 400, h: 200 }, [], W, H), { x: g, y: 300, w: 400, h: 200 });
  assert.deepEqual(snapRect({ x: W - 400 - 15, y: H - 205, w: 400, h: 200 }, [], W, H), { x: W - 400 - g, y: H - 200 - g, w: 400, h: 200 });
});

test('dragging near another panel snaps one gutter away from it', () => {
  const other = { x: 10, y: 10, w: 500, h: 300 };
  assert.equal(snapRect({ x: 515, y: 400, w: 300, h: 200 }, [other], W, H).x, 510 + g);
  assert.equal(snapRect({ x: 600, y: 316, w: 300, h: 200 }, [other], W, H).y, 310 + g);
});

test('Far-away edges do not snap', () => {
  const r = { x: 300, y: 300, w: 300, h: 200 };
  assert.deepEqual(snapRect(r, [], W, H), r);
});

test('resize snapping only moves the dragged edge', () => {
  const r = snapRect({ x: 100, y: 100, w: W - 100 - 16, h: 200 }, [], W, H, 'e');
  assert.deepEqual(r, { x: 100, y: 100, w: W - 100 - g, h: 200 });
});

test('floating panels do not dock; right-hand columns do', () => {
  assert.deepEqual(dockInsets({ a: { x: 300, y: 10, w: 400, h: 700 } }, W, H), { left: 0, right: 0 });
  assert.deepEqual(dockInsets({ a: { x: g, y: 10, w: 400, h: 200 } }, W, H), { left: 0, right: 0 });   // too short
  const right = { a: { x: 1000 - g, y: g, w: 400, h: 380 }, b: { x: 1000 - g, y: 400, w: 400, h: 390 } };
  assert.deepEqual(dockInsets(right, W, H), { left: 0, right: 400 + g });
});

test('layouts round-trip through fractions and rescale', () => {
  const rects = defaultRects(W, H);
  const saved = parseLayout(JSON.parse(JSON.stringify(serialize(rects, ['code', 'problem'], W, H))));
  assert.deepEqual(saved.order, ['code', 'problem']);
  assert.deepEqual(fromFractions(saved.panels, W, H), rects);
  const half = fromFractions(saved.panels, W / 2, H / 2);
  assert.equal(half.problem.w, Math.max(MIN.problem.w, Math.round(rects.problem.w / 2)));
});

test('malformed saved layouts are ignored', () => {
  assert.equal(parseLayout(null), null);
  assert.equal(parseLayout({ v: 99, panels: {} }), null);
  assert.equal(parseLayout({ v: 1, panels: { problem: { x: 0, y: 0, w: 0.3, h: 0.5 } } }), null);
  assert.equal(parseLayout({ v: 1, panels: { problem: { x: 0, y: 0, w: 0.3, h: 0.5 }, code: { x: 0, y: 0.5, w: 2, h: 0.5 } } }), null);
  const ok = parseLayout({ v: 1, panels: { problem: { x: 0, y: 0, w: 0.3, h: 0.5 }, code: { x: 0, y: 0.5, w: 0.3, h: 0.5 } }, order: 'junk' });
  assert.deepEqual(ok.order, ['problem', 'code']);
});

test('layouts are keyed per account', () => {
  assert.equal(layoutKey(null), 'codeart-layout:guest');
  assert.equal(layoutKey({ id: 42, email: 'a@b.c' }), 'codeart-layout:u42');
  assert.notEqual(layoutKey({ id: 1 }), layoutKey({ id: 2 }));
});

console.log(`layout: ${passed} tests passed`);
