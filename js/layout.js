// Geometry for the movable workspace panels (problem + code). Pure functions
// with no DOM access so Node can test them: rects are {x, y, w, h} in pixels
// relative to the workspace, and layouts are stored as fractions of it so a
// saved arrangement survives window resizes.

export const GUTTER = 10;          // comic-strip gap between panels and edges
export const SNAP = 12;            // px within which an edge snaps to a guide
export const PANELS = ['problem', 'code'];
export const MIN = { problem: { w: 260, h: 120 }, code: { w: 300, h: 240 } };
const VERSION = 1;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** The original two-panel column on the left, docked against the stage. */
export function defaultRects(W, H, g = GUTTER) {
  const w = Math.min(Math.max(380, Math.round(W * 0.36)), W - 2 * g);
  const inner = H - 3 * g;
  const top = Math.round(inner * 0.46);
  return {
    problem: { x: g, y: g, w, h: top },
    code: { x: g, y: 2 * g + top, w, h: inner - top },
  };
}

/** Keep a rect inside the W×H workspace and at least its minimum size. */
export function clampRect(r, W, H, min = { w: 0, h: 0 }) {
  const w = clamp(r.w, Math.min(min.w, W), W);
  const h = clamp(r.h, Math.min(min.h, H), H);
  return { x: clamp(r.x, 0, W - w), y: clamp(r.y, 0, H - h), w, h };
}

/**
 * Resize `start` by dragging the edges named in `dir` (any of n/s/e/w) by
 * dx/dy. The opposite edge stays put, so minimums push back instead of
 * sliding the panel.
 */
export function resizeRect(start, dir, dx, dy, W, H, min = { w: 0, h: 0 }) {
  let { x, y, w, h } = start;
  const right = x + w, bottom = y + h;
  if (dir.includes('e')) w = clamp(w + dx, min.w, W - x);
  if (dir.includes('s')) h = clamp(h + dy, min.h, H - y);
  if (dir.includes('w')) { x = clamp(x + dx, 0, right - min.w); w = right - x; }
  if (dir.includes('n')) { y = clamp(y + dy, 0, bottom - min.h); h = bottom - y; }
  return { x, y, w, h };
}

// Guide lines an edge may snap to: the workspace edges (inset by the gutter)
// and the other panels' edges, flush or one gutter apart.
function guides(others, size, g) {
  const lo = [g], hi = [size - g];
  for (const o of others) {
    lo.push(o.lo, o.hi + g);
    hi.push(o.hi, o.lo - g);
  }
  return { lo, hi };
}

function nearest(value, targets, t) {
  let best = null;
  for (const target of targets) {
    const d = target - value;
    if (Math.abs(d) <= t && (best === null || Math.abs(d) < Math.abs(best))) best = d;
  }
  return best;
}

/**
 * Snap a rect's moving edges to nearby guides. `dir` is 'move' for a drag
 * (both edges travel together) or the resize direction (n/s/e/w letters).
 */
export function snapRect(r, others, W, H, dir = 'move', g = GUTTER, t = SNAP) {
  let { x, y, w, h } = r;
  const gx = guides(others.map((o) => ({ lo: o.x, hi: o.x + o.w })), W, g);
  const gy = guides(others.map((o) => ({ lo: o.y, hi: o.y + o.h })), H, g);
  if (dir === 'move') {
    const ds = [nearest(x, gx.lo, t), nearest(x + w, gx.hi, t)].filter((d) => d !== null);
    if (ds.length) x += ds.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
    const dy = [nearest(y, gy.lo, t), nearest(y + h, gy.hi, t)].filter((d) => d !== null);
    if (dy.length) y += dy.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
    return { x, y, w, h };
  }
  if (dir.includes('e')) { const d = nearest(x + w, gx.hi, t); if (d !== null) w += d; }
  if (dir.includes('s')) { const d = nearest(y + h, gy.hi, t); if (d !== null) h += d; }
  if (dir.includes('w')) { const d = nearest(x, gx.lo, t); if (d !== null) { x += d; w -= d; } }
  if (dir.includes('n')) { const d = nearest(y, gy.lo, t); if (d !== null) { y += d; h -= d; } }
  return { x, y, w, h };
}

/**
 * How far the 3D stage should step aside. Panels flush with the left (or
 * right) edge that together cover most of the height form a docked column;
 * anything else floats over the stage.
 */
export function dockInsets(rects, W, H, g = GUTTER) {
  const out = { left: 0, right: 0 };
  const list = Object.values(rects);
  const left = list.filter((r) => r.x <= g + 1);
  const right = list.filter((r) => r.x + r.w >= W - g - 1);
  const covers = (rs) => rs.reduce((s, r) => s + r.h, 0) >= H * 0.6;
  if (covers(left)) out.left = Math.max(...left.map((r) => r.x + r.w));
  if (covers(right)) out.right = W - Math.min(...right.map((r) => r.x));
  if (out.left + out.right > W * 0.8) return { left: 0, right: 0 };   // nothing left to dock beside
  return out;
}

export function toFractions(rects, W, H) {
  const panels = {};
  for (const [k, r] of Object.entries(rects)) panels[k] = { x: r.x / W, y: r.y / H, w: r.w / W, h: r.h / H };
  return panels;
}

export function fromFractions(panels, W, H) {
  const rects = {};
  for (const [k, f] of Object.entries(panels)) {
    rects[k] = clampRect({ x: Math.round(f.x * W), y: Math.round(f.y * H), w: Math.round(f.w * W), h: Math.round(f.h * H) }, W, H, MIN[k]);
  }
  return rects;
}

/** Saved layouts are per signed-in account; signed-out visitors share 'guest'. */
export const layoutKey = (user) => `codeart-layout:${user && user.id != null ? `u${user.id}` : 'guest'}`;

export function serialize(rects, order, W, H) {
  return { v: VERSION, panels: toFractions(rects, W, H), order: [...order] };
}

/** Validate a stored layout; anything malformed is treated as "no layout". */
export function parseLayout(raw) {
  if (!raw || raw.v !== VERSION || typeof raw.panels !== 'object') return null;
  const ok = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  for (const k of PANELS) {
    const f = raw.panels[k];
    if (!f || !ok(f.x) || !ok(f.y) || !ok(f.w) || !ok(f.h) || f.w === 0 || f.h === 0) return null;
  }
  const order = Array.isArray(raw.order) && PANELS.every((k) => raw.order.includes(k)) ? raw.order.filter((k) => PANELS.includes(k)) : [...PANELS];
  return { v: VERSION, panels: Object.fromEntries(PANELS.map((k) => [k, raw.panels[k]])), order };
}
