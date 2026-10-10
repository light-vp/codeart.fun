// Floating, resizable panels for the workspace.
//
// Each `.win` is positioned in fractions of the desk, so a layout survives
// window resizes, and is saved per browser. Panels drag by their header,
// resize from any edge or corner, snap to the desk edges and to each other,
// minimise to their header, and can be moved from the keyboard (focus the
// grip, then arrows; shift+arrows resizes). Below 920px the CSS stacks them
// and this module stands down.

const STORE = 'codeart-layout-v1';
const SNAP = 12;       // px distance at which an edge snaps
const GAP = 10;        // px between snapped neighbours
const PAD = 10;        // px from the desk edge
const RESERVE_RIGHT = 66; // px kept clear for the camera toolbar
const MIN_W = 260;
const MIN_H = 140;

export const PRESETS = {
  classic: {
    brief: { x: 0.008, y: 0.016, w: 0.33, h: 0.42, min: false },
    code: { x: 0.008, y: 0.46, w: 0.33, h: 0.52, min: false },
    cpu: { x: 0.35, y: 0.016, w: 0.56, h: null, min: false },
  },
  code: {
    code: { x: 0.008, y: 0.016, w: 0.47, h: 0.965, min: false },
    brief: { x: 0.49, y: 0.016, w: 0.3, h: 0.5, min: true },
    cpu: { x: 0.49, y: 0.105, w: 0.42, h: null, min: false },
  },
  right: {
    brief: { x: 0.6, y: 0.016, w: 0.33, h: 0.42, min: false },
    code: { x: 0.6, y: 0.46, w: 0.33, h: 0.52, min: false },
    cpu: { x: 0.008, y: 0.016, w: 0.55, h: null, min: false },
  },
  stage: {
    brief: { x: 0.008, y: 0.016, w: 0.26, h: 0.42, min: true },
    code: { x: 0.008, y: 0.105, w: 0.26, h: 0.52, min: true },
    cpu: { x: 0.28, y: 0.016, w: 0.5, h: null, min: false },
  },
};

const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || null; } catch { return null; } };
const save = (v) => { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* storage unavailable */ } };

export class PanelManager {
  constructor(desk, { onChange } = {}) {
    this.desk = desk;
    this.onChange = onChange || (() => {});
    this.wins = new Map([...desk.querySelectorAll('.win')].map((el) => [el.dataset.win, el]));
    this.mq = matchMedia('(max-width: 920px)');
    const saved = load();
    this.state = saved && saved.layout ? saved.layout : structuredClone(PRESETS.classic);
    for (const id of this.wins.keys()) if (!this.state[id]) this.state[id] = structuredClone(PRESETS.classic[id]);

    for (const [id, el] of this.wins) this.decorate(id, el);
    this.guideV = Object.assign(document.createElement('div'), { className: 'snap-guide v', hidden: true });
    this.guideH = Object.assign(document.createElement('div'), { className: 'snap-guide h', hidden: true });
    desk.append(this.guideV, this.guideH);

    new ResizeObserver(() => this.applyAll()).observe(desk);
    this.mq.addEventListener('change', () => this.applyAll());
    this.applyAll();
    this.focus(this.wins.get('code'));
  }

  get enabled() { return !this.mq.matches; }

  decorate(id, el) {
    for (const dir of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
      const h = document.createElement('span');
      h.className = `rs ${dir}`;
      h.dataset.rs = dir;
      h.setAttribute('aria-hidden', 'true');
      el.appendChild(h);
      h.addEventListener('pointerdown', (e) => this.startResize(e, id, dir));
    }
    for (const c of ['tl', 'tr', 'bl', 'br']) {
      const k = document.createElement('span');
      k.className = `corner ${c}`;
      k.setAttribute('aria-hidden', 'true');
      el.appendChild(k);
    }
    const head = el.querySelector('[data-drag]');
    head.addEventListener('pointerdown', (e) => this.startDrag(e, id));
    head.addEventListener('dblclick', (e) => { if (!e.target.closest('button, input, a')) this.toggleMin(id); });
    el.querySelector('.win-min').addEventListener('click', () => this.toggleMin(id));
    el.addEventListener('pointerdown', () => this.focus(el), true);
    el.addEventListener('focusin', () => this.focus(el));

    const grip = el.querySelector('.win-grip');
    grip.tabIndex = 0;
    grip.setAttribute('role', 'button');
    grip.setAttribute('aria-label', `Move ${el.getAttribute('aria-label') || id} panel: arrow keys move, shift and arrow keys resize`);
    grip.addEventListener('keydown', (e) => this.keyMove(e, id));
  }

  // Bring a panel to the front. z-indexes stay within 20..(20 + panels), so
  // panels never climb above the transport bar or camera toolbar.
  focus(el) {
    if (!el) return;
    this.order = (this.order || [...this.wins.values()]).filter((w) => w !== el).concat(el);
    this.order.forEach((w, i) => {
      w.style.zIndex = String(20 + i);
      w.classList.toggle('focused', w === el);
    });
  }

  size() { return { W: this.desk.clientWidth, H: this.desk.clientHeight }; }

  // fractions → clamped pixels
  rectOf(id) {
    const { W, H } = this.size();
    const s = this.state[id];
    const el = this.wins.get(id);
    const maxW = W - PAD - RESERVE_RIGHT;
    let w = Math.max(MIN_W, Math.min(s.w * W, maxW - PAD));
    let x = Math.max(PAD, Math.min(s.x * W, maxW - w));
    let h = s.h == null ? null : Math.max(MIN_H, Math.min(s.h * H, H - 2 * PAD));
    const realH = s.min ? el.querySelector('.win-head').offsetHeight + 5 : h ?? el.offsetHeight;
    let y = Math.max(PAD, Math.min(s.y * H, H - PAD - Math.min(realH, H - 2 * PAD)));
    return { x, y, w, h };
  }

  apply(id) {
    const el = this.wins.get(id);
    if (!this.enabled) { el.removeAttribute('style'); el.classList.toggle('min', false); return; }
    const r = this.rectOf(id);
    el.classList.toggle('min', !!this.state[id].min);
    Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: r.h == null || this.state[id].min ? '' : `${r.h}px` });
  }

  applyAll() {
    for (const id of this.wins.keys()) this.apply(id);
    this.onChange(this.rects());
  }

  persist() { save({ layout: this.state }); this.onChange(this.rects()); }

  rects() {
    const out = {};
    if (!this.enabled) return out;
    const d = this.desk.getBoundingClientRect();
    for (const [id, el] of this.wins) {
      const r = el.getBoundingClientRect();
      out[id] = { left: r.left - d.left, top: r.top - d.top, right: r.right - d.left, bottom: r.bottom - d.top, min: !!this.state[id].min };
    }
    return out;
  }

  setPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    this.state = structuredClone(p);
    this.applyAll();
    this.persist();
  }

  toggleMin(id) {
    this.state[id].min = !this.state[id].min;
    this.apply(id);
    this.persist();
  }

  // ---- snapping helpers --------------------------------------------------
  edges(exceptId) {
    const { W, H } = this.size();
    const xs = [PAD, W - PAD - RESERVE_RIGHT];
    const ys = [PAD, H - PAD];
    for (const [id, el] of this.wins) {
      if (id === exceptId) continue;
      const l = el.offsetLeft, t = el.offsetTop, r = l + el.offsetWidth, b = t + el.offsetHeight;
      xs.push(l, r, r + GAP, l - GAP);
      ys.push(t, b, b + GAP, t - GAP);
    }
    return { xs, ys };
  }

  snap(value, size, lines) {
    // snap either the leading or the trailing edge, whichever is closer
    let best = null;
    for (const line of lines) {
      for (const [edge, offset] of [[value, 0], [value + size, size]]) {
        const d = Math.abs(edge - line);
        if (d <= SNAP && (!best || d < best.d)) best = { d, v: line - offset, line };
      }
    }
    return best;
  }

  showGuides(vx, hy) {
    this.guideV.hidden = vx == null;
    this.guideH.hidden = hy == null;
    if (vx != null) this.guideV.style.left = `${vx}px`;
    if (hy != null) this.guideH.style.top = `${hy}px`;
  }

  // ---- drag ----------------------------------------------------------------
  startDrag(e, id) {
    if (!this.enabled || e.button !== 0) return;
    if (e.target.closest('button, input, textarea, a, select') && !e.target.closest('.win-grip')) return;
    const el = this.wins.get(id);
    const head = e.currentTarget;
    e.preventDefault();
    head.setPointerCapture(e.pointerId);
    this.focus(el);
    el.classList.add('dragging');
    const start = { px: e.clientX, py: e.clientY, x: el.offsetLeft, y: el.offsetTop };
    const { xs, ys } = this.edges(id);
    const w = el.offsetWidth, h = el.offsetHeight;
    const { W, H } = this.size();

    const move = (ev) => {
      let x = start.x + ev.clientX - start.px;
      let y = start.y + ev.clientY - start.py;
      const sx = this.snap(x, w, xs), sy = this.snap(y, h, ys);
      if (sx) x = sx.v;
      if (sy) y = sy.v;
      x = Math.max(PAD, Math.min(x, W - PAD - RESERVE_RIGHT - w));
      y = Math.max(PAD, Math.min(y, H - PAD - Math.min(h, H - 2 * PAD)));
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      this.showGuides(sx ? sx.line : null, sy ? sy.line : null);
      this.onChange(this.rects());
    };
    const up = () => {
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', up);
      head.removeEventListener('pointercancel', up);
      el.classList.remove('dragging');
      this.showGuides(null, null);
      this.state[id].x = el.offsetLeft / W;
      this.state[id].y = el.offsetTop / H;
      this.persist();
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
    head.addEventListener('pointercancel', up);
  }

  // ---- resize ----------------------------------------------------------------
  startResize(e, id, dir) {
    if (!this.enabled || e.button !== 0) return;
    const el = this.wins.get(id);
    if (this.state[id].min && /[ns]/.test(dir)) return;
    const handle = e.currentTarget;
    e.preventDefault();
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    this.focus(el);
    el.classList.add('resizing');
    const s0 = { px: e.clientX, py: e.clientY, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
    const { xs, ys } = this.edges(id);
    const { W, H } = this.size();
    const autoH = this.state[id].h == null;

    const move = (ev) => {
      const dx = ev.clientX - s0.px, dy = ev.clientY - s0.py;
      let { x, y, w, h } = s0;
      let gx = null, gy = null;
      if (dir.includes('e')) {
        let r = x + w + dx;
        const sn = this.snap(r, 0, xs); if (sn) { r = sn.v; gx = sn.line; }
        w = Math.max(MIN_W, Math.min(r, W - PAD - RESERVE_RIGHT) - x);
      }
      if (dir.includes('w')) {
        let l = x + dx;
        const sn = this.snap(l, 0, xs); if (sn) { l = sn.v; gx = sn.line; }
        l = Math.max(PAD, Math.min(l, x + w - MIN_W));
        w = x + w - l; x = l;
      }
      if (dir.includes('s')) {
        let b = y + h + dy;
        const sn = this.snap(b, 0, ys); if (sn) { b = sn.v; gy = sn.line; }
        h = Math.max(MIN_H, Math.min(b, H - PAD) - y);
      }
      if (dir.includes('n')) {
        let t = y + dy;
        const sn = this.snap(t, 0, ys); if (sn) { t = sn.v; gy = sn.line; }
        t = Math.max(PAD, Math.min(t, y + h - MIN_H));
        h = y + h - t; y = t;
      }
      Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px` });
      if (/[ns]/.test(dir) || !autoH) el.style.height = `${h}px`;
      this.showGuides(gx, gy);
      this.onChange(this.rects());
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      el.classList.remove('resizing');
      this.showGuides(null, null);
      Object.assign(this.state[id], { x: el.offsetLeft / W, y: el.offsetTop / H, w: el.offsetWidth / W });
      if (el.style.height) this.state[id].h = el.offsetHeight / H;
      this.persist();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  // ---- keyboard ----------------------------------------------------------------
  keyMove(e, id) {
    if (!this.enabled) return;
    const step = e.altKey ? 4 : 24;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggleMin(id); return; }
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    const el = this.wins.get(id);
    const { W, H } = this.size();
    if (e.shiftKey) {
      const w = Math.max(MIN_W, el.offsetWidth + d[0]);
      const h = Math.max(MIN_H, el.offsetHeight + d[1]);
      this.state[id].w = w / W;
      if (d[1]) this.state[id].h = h / H;
    } else {
      this.state[id].x = (el.offsetLeft + d[0]) / W;
      this.state[id].y = (el.offsetTop + d[1]) / H;
    }
    this.apply(id);
    this.persist();
  }
}
