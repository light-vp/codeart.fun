// Movable, resizable workspace panels. The problem and code cards float in a
// layer over the 3D stage: drag a header (or its grip) to move, drag an edge
// or corner to resize. Panels flush against the left or right edge dock, and
// the stage steps aside for them. Layouts are saved per account.
import {
  MIN, PANELS, clampRect, defaultRects, dockInsets, fromFractions,
  layoutKey, parseLayout, resizeRect, serialize, snapRect,
} from './layout.js';

const DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const NUDGE = 10;
const INTERACTIVE = 'button:not([data-grip]), a, input, select, textarea, label, [role="tab"]';

export class PanelLayout {
  constructor(ws, { narrowQuery = '(max-width: 920px)', onChange } = {}) {
    this.ws = ws;
    this.els = Object.fromEntries(PANELS.map((k) => [k, ws.querySelector(`[data-panel="${k}"]`)]));
    this.narrow = matchMedia(narrowQuery);
    this.onChange = onChange;
    this.key = layoutKey(null);
    this.rects = null;
    this.order = [...PANELS];

    for (const [name, el] of Object.entries(this.els)) {
      for (const dir of DIRS) {
        const h = document.createElement('span');
        h.className = `rz rz-${dir}`;
        h.dataset.dir = dir;
        h.setAttribute('aria-hidden', 'true');
        el.appendChild(h);
        h.addEventListener('pointerdown', (e) => this.begin(e, name, dir));
      }
      el.querySelector('[data-drag]').addEventListener('pointerdown', (e) => {
        if (e.target.closest(INTERACTIVE)) return;
        this.begin(e, name, 'move');
      });
      const grip = el.querySelector('[data-grip]');
      grip.addEventListener('keydown', (e) => this.key_(e, name));
      el.addEventListener('pointerdown', () => this.raise(name), true);
    }
    new ResizeObserver(() => this.apply()).observe(ws);
    this.narrow.addEventListener('change', () => this.apply());
    this.load(null);
  }

  get size() { return { W: this.ws.clientWidth, H: this.ws.clientHeight }; }

  /** Switch to the layout saved for `user` (null = signed out). */
  load(user) {
    this.key = layoutKey(user);
    let saved = null;
    try { saved = parseLayout(JSON.parse(localStorage.getItem(this.key))); } catch { /* storage unavailable */ }
    if (!saved && user) {
      // First sign-in on this browser: carry over the arrangement they already made.
      try { saved = parseLayout(JSON.parse(localStorage.getItem(layoutKey(null)))); } catch { /* ignore */ }
    }
    this.saved = saved;
    this.order = saved ? saved.order : [...PANELS];
    this.rects = null;
    this.apply();
  }

  reset() {
    try { localStorage.removeItem(this.key); } catch { /* ignore */ }
    this.saved = null;
    this.order = [...PANELS];
    this.rects = null;
    this.apply();
    this.onChange?.();
  }

  get customised() { return !!this.saved; }

  save() {
    const { W, H } = this.size;
    this.saved = serialize(this.rects, this.order, W, H);
    try { localStorage.setItem(this.key, JSON.stringify(this.saved)); } catch { /* storage unavailable */ }
    this.onChange?.();
  }

  /** Recompute pixel rects from the saved fractions (or defaults) and paint. */
  apply() {
    const floating = !this.narrow.matches;
    this.ws.classList.toggle('ws-float', floating);
    if (!floating) {
      for (const el of Object.values(this.els)) el.removeAttribute('style');
      this.ws.style.removeProperty('--dock-l');
      this.ws.style.removeProperty('--dock-r');
      return;
    }
    const { W, H } = this.size;
    if (!W || !H) return;
    this.rects = this.saved ? fromFractions(this.saved.panels, W, H) : defaultRects(W, H);
    this.paint();
    this.dock();
  }

  paint() {
    for (const k of PANELS) {
      const r = this.rects[k], el = this.els[k];
      el.style.left = `${r.x}px`;
      el.style.top = `${r.y}px`;
      el.style.width = `${r.w}px`;
      el.style.height = `${r.h}px`;
      el.style.zIndex = String(1 + this.order.indexOf(k));
    }
  }

  dock() {
    const { W, H } = this.size;
    const d = dockInsets(this.rects, W, H);
    this.ws.style.setProperty('--dock-l', `${d.left}px`);
    this.ws.style.setProperty('--dock-r', `${d.right}px`);
  }

  raise(name) {
    if (this.order[this.order.length - 1] === name) return;
    this.order = [...this.order.filter((k) => k !== name), name];
    if (this.rects) this.paint();
  }

  others(name) { return PANELS.filter((k) => k !== name).map((k) => this.rects[k]); }

  begin(e, name, dir) {
    if (e.button !== 0 || !this.rects || this.narrow.matches) return;
    e.preventDefault();
    const el = this.els[name];
    const start = { ...this.rects[name] };
    const sx = e.clientX, sy = e.clientY;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    this.raise(name);
    el.classList.add(dir === 'move' ? 'is-moving' : 'is-resizing');
    document.body.classList.add('panels-busy');
    document.body.dataset.panelCursor = dir;

    const move = (ev) => {
      const { W, H } = this.size;
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let r = dir === 'move' ? { ...start, x: start.x + dx, y: start.y + dy } : resizeRect(start, dir, dx, dy, W, H, MIN[name]);
      if (!ev.altKey) r = snapRect(r, this.others(name), W, H, dir);   // hold Alt to place freely
      this.rects[name] = clampRect(r, W, H, MIN[name]);
      this.paint();
    };
    const end = (ev) => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
      el.classList.remove('is-moving', 'is-resizing');
      document.body.classList.remove('panels-busy');
      delete document.body.dataset.panelCursor;
      if (ev.type === 'pointercancel') { this.rects[name] = start; this.paint(); return; }
      const r = this.rects[name];
      if (r.x !== start.x || r.y !== start.y || r.w !== start.w || r.h !== start.h) { this.dock(); this.save(); }
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }

  /** Grip keyboard control: arrows move, Shift+arrows resize. */
  key_(e, name) {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!step || !this.rects || this.narrow.matches) return;
    e.preventDefault();
    e.stopPropagation();   // keep the global ←/→ step shortcuts out of it
    const { W, H } = this.size;
    const [dx, dy] = step.map((s) => s * NUDGE);
    const r = this.rects[name];
    const next = e.shiftKey ? resizeRect(r, `${dx ? 'e' : ''}${dy ? 's' : ''}`, dx, dy, W, H, MIN[name]) : { ...r, x: r.x + dx, y: r.y + dy };
    this.rects[name] = clampRect(next, W, H, MIN[name]);
    this.raise(name);
    this.paint();
    this.dock();
    this.save();
  }
}

