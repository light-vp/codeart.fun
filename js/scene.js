// Three.js renderer. Receives scene descriptions from model.layoutStep() and
// reconciles them: blocks that persist glide to their new place, new blocks
// drop (or fly) in, removed blocks lift out. Rewinding is just reconciling to
// an earlier description, so every animation is reversible for free.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const THEMES = {
  light: {
    bg: 0xf3efe7, board: 0xfbf9f4, grid: 'rgba(80,60,40,0.07)', frame: 0xe8e1d4, frameActive: 0xf1d5cc,
    object: 0xe6e9f2, plate: 0xffffff, cell: 0xd9d3c7, text: '#1d1a22', muted: '#7a7480',
    accent: 0x800020, arrow: 0x5d576b, cursor: 0xffb000,
  },
  dark: {
    bg: 0x14111c, board: 0x1c1827, grid: 'rgba(200,190,255,0.06)', frame: 0x2a2438, frameActive: 0x3b2c48,
    object: 0x252536, plate: 0x3a3547, cell: 0x332d43, text: '#f4f1bb', muted: '#a39fb0',
    accent: 0x9bc1bc, arrow: 0x9bc1bc, cursor: 0xffc94d,
  },
};

export const TYPE_COLORS = {
  int: 0x4a72e8, float: 0x23a597, str: 0xe8962e, bool: 0x4caf6a, None: 0x83818f,
  function: 0x8d5ff0, class: 0x8d5ff0, builtin: 0x8d5ff0, ref: 0x2b2733, complex: 0x23a597,
};
const MARKER_COLORS = [0xe8505b, 0x2e9cdb, 0x9b59b6, 0x16a085, 0xd35400, 0xc2185b, 0x5d6d7e];

const Z = { board: -0.75, frame: -0.5, cell: -0.32, slot: -0.25, value: 0.18, marker: 0.2, cursor: 0.18 };

function hashName(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
function shade(color, amt) { const c = new THREE.Color(color); c.offsetHSL(0, 0, amt); return c; }

function textTexture(text, { fg = '#fff', bg = null, aspect = 1, weight = 700, align = 'center', family = 'JetBrains Mono, monospace', scale = 0.58 }) {
  const h = 128;
  const w = Math.min(1024, Math.max(32, Math.round(h * aspect)));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  let size = Math.round(h * scale);
  g.font = `${weight} ${size}px ${family}`;
  while (size > 14 && g.measureText(text).width > w * 0.88) { size -= 2; g.font = `${weight} ${size}px ${family}`; }
  g.fillStyle = fg;
  g.textBaseline = 'middle';
  g.textAlign = align;
  g.fillText(text, align === 'left' ? w * 0.06 : w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
  });
}

function setOpacity(obj, a) {
  obj.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) { m.transparent = true; m.opacity = a * (m.userData.baseOpacity ?? 1); }
  });
}

function label(text, w, h, color, opts = {}) {
  const mat = new THREE.MeshBasicMaterial({ map: textTexture(text, { fg: color, aspect: w / h, weight: opts.weight || 600, align: opts.align || 'center', family: opts.family || 'Inter, system-ui, sans-serif', scale: opts.scale || 0.62 }), transparent: true, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return m;
}

export class BlockScene {
  constructor(container) {
    this.container = container;
    this.theme = THEMES.light;
    this.ents = new Map();
    this.exiting = new Set();
    this.autoFit = true;
    this.lastSpec = null;
    this.camGoal = null;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
    this.camera.position.set(10, 2, 30);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 140;
    this.controls.addEventListener('start', () => { this.autoFit = false; this.onUserCamera?.(); });

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f99, 1.6));
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sun.position.set(8, 14, 18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);

    this.board = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: this.theme.board, roughness: 1 }));
    this.board.position.z = Z.board;
    this.board.receiveShadow = true;
    this.scene.add(this.board);

    this.applyTheme('light');
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.clock = performance.now();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  applyTheme(name) {
    this.theme = THEMES[name] || THEMES.light;
    this.scene.background = new THREE.Color(this.theme.bg);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = hex(this.theme.board); g.fillRect(0, 0, 128, 128);
    g.strokeStyle = this.theme.grid; g.lineWidth = 2;
    g.strokeRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(200, 200);
    tex.colorSpace = THREE.SRGBColorSpace;
    if (this.board.material.map) this.board.material.map.dispose();
    this.board.material.map = tex;
    this.board.material.color.set(0xffffff);
    this.board.material.needsUpdate = true;
  }

  setTheme(name) {
    this.applyTheme(name);
    for (const ent of [...this.ents.values(), ...this.exiting]) { this.scene.remove(ent.obj); disposeTree(ent.obj); }
    this.ents.clear(); this.exiting.clear();
    if (this.lastSpec) this.render(this.lastSpec, { duration: 0 });
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.lastSpec && this.autoFit) this.fit(this.lastSpec.bounds, true);
  }

  recenter() { this.autoFit = true; if (this.lastSpec) this.fit(this.lastSpec.bounds); }

  fit(b, instant = false) {
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const w = b.maxX - b.minX + 3, h = b.maxY - b.minY + 3;
    const t = Math.tan((this.camera.fov * Math.PI) / 360);
    const d = Math.max(h / 2 / t, w / 2 / (t * this.camera.aspect), 12);
    const target = new THREE.Vector3(cx, cy, 0);
    const pos = new THREE.Vector3(cx + d * 0.12, cy + d * 0.18, d);
    this.camGoal = { target, pos };
    if (instant) { this.controls.target.copy(target); this.camera.position.copy(pos); }
    this.sun.position.set(cx + 8, cy + 14, 22);
    this.sun.target.position.set(cx, cy, 0);
    const s = this.sun.shadow.camera;
    const r = Math.max(w, h) * 0.75 + 6;
    s.left = -r; s.right = r; s.top = r; s.bottom = -r; s.near = 1; s.far = 80;
    s.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ builders
  makeValue(v) {
    const g = new THREE.Group();
    const color = v.t === 'bool' ? (v.text === 'True' ? 0x4caf6a : 0xe2574c) : (TYPE_COLORS[v.t] ?? 0x9a7b6a);
    const size = v.t === 'ref' ? 0.55 : 0.92;
    const side = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 });
    const top = new THREE.MeshStandardMaterial({ color: shade(color, 0.12), roughness: 0.45 });
    const front = new THREE.MeshStandardMaterial({ map: textTexture(v.text, { fg: '#ffffff', bg: hex(color), aspect: v.w / size, scale: v.t === 'ref' ? 0.9 : 0.56 }), roughness: 0.5 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(v.w, size, size), [side, side, top, side, front, side]);
    mesh.castShadow = true;
    g.add(mesh);
    if (v.isKey) {
      const ring = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0xffffff }));
      g.add(ring);
    }
    g.userData = { text: v.text, w: v.w, t: v.t };
    return g;
  }

  makeSlot(s) {
    const g = new THREE.Group();
    const color = s.ret ? this.theme.accent : this.theme.plate;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.82, 0.14), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    plate.receiveShadow = true;
    g.add(plate);
    const lab = label(s.label, s.w - 0.2, 0.7, s.ret ? '#ffffff' : this.theme.text, { family: 'JetBrains Mono, monospace', align: 'left', weight: 600, scale: 0.55 });
    lab.position.z = 0.08;
    g.add(lab);
    return g;
  }

  makeFrame(f) {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(f.w, f.h, 0.16), new THREE.MeshStandardMaterial({ color: f.active ? this.theme.frameActive : this.theme.frame, roughness: 0.9 }));
    slab.receiveShadow = true;
    g.add(slab);
    const t = label(f.title, f.w * 0.7, 0.62, f.active ? hex(this.theme.accent) : this.theme.muted, { align: 'left', weight: 700 });
    t.position.set(-f.w * 0.15, f.h / 2 - 0.45, 0.1);
    g.add(t);
    if (f.active) {
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), new THREE.LineBasicMaterial({ color: this.theme.accent }));
      g.add(edge);
    }
    g.userData = { active: f.active, h: f.h, title: f.title };
    return g;
  }

  makeObject(o) {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, 0.14), new THREE.MeshStandardMaterial({ color: this.theme.object, roughness: 0.9 }));
    slab.receiveShadow = true;
    g.add(slab);
    const text = o.more ? `${o.title}  (+${o.more} more)` : o.title;
    const t = label(text, Math.max(2.2, o.w * 0.8), 0.58, this.theme.muted, { align: 'left', family: 'JetBrains Mono, monospace', weight: 600 });
    t.position.set(-o.w / 2 + Math.max(2.2, o.w * 0.8) / 2 + 0.1, o.h / 2 - 0.42, 0.09);
    g.add(t);
    g.userData = { w: o.w, h: o.h, text };
    return g;
  }

  makeCell(c) {
    const g = new THREE.Group();
    const h = c.row ? 1.05 : 1.08;
    const mat = new THREE.MeshStandardMaterial({ color: this.theme.cell, roughness: 0.95 });
    if (c.ghost) { mat.transparent = true; mat.opacity = 0.45; mat.userData.baseOpacity = 0.45; }
    const tile = new THREE.Mesh(new THREE.BoxGeometry(c.w, h, 0.1), mat);
    tile.receiveShadow = true;
    g.add(tile);
    if (c.label != null) {
      const ghost = c.label === 'empty';
      const lab = label(c.label, ghost ? 1.2 : 0.9, ghost ? 0.5 : 0.42, this.theme.muted, { family: 'JetBrains Mono, monospace', weight: 500 });
      lab.position.set(0, ghost ? 0 : -0.78, 0.07);
      g.add(lab);
    }
    g.userData = { w: c.w, label: c.label };
    return g;
  }

  makeMarker(m) {
    const g = new THREE.Group();
    const color = MARKER_COLORS[hashName(m.name) % MARKER_COLORS.length];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: m.active ? 0.25 : 0.05 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 16), mat);
    cone.castShadow = true;
    if (m.side) { cone.rotation.z = -Math.PI / 2; cone.position.set(0.55, 0, 0); } else cone.position.set(0, 0.4, 0);
    g.add(cone);
    const lw = Math.max(0.9, 0.24 * m.label.length + 0.3);
    const tag = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.42, 0.1), new THREE.MeshStandardMaterial({ map: textTexture(m.label, { fg: '#fff', bg: hex(color), aspect: lw / 0.42, family: 'JetBrains Mono, monospace', scale: 0.7 }) }));
    tag.position.set(m.side ? -lw / 2 + 0.3 : 0, m.side ? 0 : -0.05, 0);
    g.add(tag);
    g.userData = { label: m.label, active: m.active };
    return g;
  }

  makeCursor(c) {
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(c.w, 1.3, 1.2);
    const glow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: this.theme.cursor, transparent: true, opacity: c.done ? 0.06 : 0.16, depthWrite: false }));
    glow.material.userData.baseOpacity = glow.material.opacity;
    g.add(glow);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: this.theme.cursor, transparent: true, opacity: c.done ? 0.4 : 1 }));
    edges.material.userData.baseOpacity = edges.material.opacity;
    g.add(edges);
    const lw = Math.max(1.6, 0.2 * c.label.length + 0.4);
    const tag = label(c.label, lw, 0.45, hex(this.theme.cursor), { family: 'JetBrains Mono, monospace', weight: 700 });
    tag.position.set(0, 0.95, 0.3);
    g.add(tag);
    g.userData = { w: c.w, label: c.label, done: c.done };
    return g;
  }

  makeArrow() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: this.theme.arrow, roughness: 0.5 });
    const tube = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 12), mat);
    tube.castShadow = true;
    g.add(tube, head);
    g.userData = { tube, head };
    return g;
  }

  updateArrow(ent) {
    const from = this.ents.get(ent.spec.fromKey), to = this.ents.get(ent.spec.toKey);
    if (!from || !to) { ent.obj.visible = false; return; }
    ent.obj.visible = true;
    const a = from.obj.position.clone().add(new THREE.Vector3(0, 0, 0.3));
    const b = to.obj.position.clone().add(new THREE.Vector3(ent.offset[0], ent.offset[1], 0.15));
    const back = b.x < a.x + 0.5;
    // keep arrows close to the board: a big z-lift projects as a loop above the scene
    const lift = back ? 1.1 : 0.45;
    const reach = Math.min(3, Math.max(0.8, Math.abs(b.x - a.x) * 0.4));
    const curve = new THREE.CubicBezierCurve3(a, a.clone().add(new THREE.Vector3(reach, back ? -0.8 : 0, lift)), b.clone().add(new THREE.Vector3(-reach, back ? -0.8 : 0, lift)), b);
    const { tube, head } = ent.obj.userData;
    tube.geometry.dispose();
    tube.geometry = new THREE.TubeGeometry(curve, 28, 0.045, 6, false);
    const tan = curve.getTangent(1);
    head.position.copy(b).addScaledVector(tan, -0.18);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
  }

  // -------------------------------------------------------- reconcile
  render(spec, { duration = 450 } = {}) {
    this.lastSpec = spec;
    const now = performance.now();
    const seen = new Set();
    const nextValues = new Map(spec.values.map((v) => [v.key, v]));

    // values that disappear this step, by signature: a value that vanishes in
    // one place and appears elsewhere flies across instead of fading.
    const vanishing = new Map();
    for (const [key, ent] of this.ents) {
      if (ent.kind === 'value' && !nextValues.has(key) && ent.spec.t !== 'ref') {
        const list = vanishing.get(ent.spec.sig) || [];
        list.push(ent);
        vanishing.set(ent.spec.sig, list);
      }
    }
    const surviving = new Map();
    for (const [key, ent] of this.ents) {
      if (ent.kind === 'value' && nextValues.has(key) && key.startsWith('var:')) surviving.set(ent.spec.sig, ent);
    }

    const place = (kind, item, z, build, same) => {
      seen.add(item.key);
      let ent = this.ents.get(item.key);
      const target = new THREE.Vector3(item.x, item.y, z);
      if (ent && !same(ent, item)) {
        const pos = ent.obj.position.clone();
        this.scene.remove(ent.obj); disposeTree(ent.obj);
        ent.obj = build(item); ent.obj.position.copy(pos);
        this.scene.add(ent.obj);
        ent.flash = now;
      }
      if (!ent) {
        const obj = build(item);
        let start = target.clone().add(new THREE.Vector3(0, 1.6, 2.5));
        let startScale = 0.01;
        if (kind === 'value' && item.t !== 'ref') {
          const pool = vanishing.get(item.sig);
          const donor = pool && pool.shift();
          if (donor) {
            start = donor.obj.position.clone(); startScale = 1;
            this.scene.remove(donor.obj); disposeTree(donor.obj); this.ents.delete(donor.spec.key);
          } else if (!item.key.startsWith('var:') && surviving.has(item.sig)) {
            start = surviving.get(item.sig).obj.position.clone(); startScale = 0.6;
          }
        }
        obj.position.copy(start);
        obj.scale.setScalar(startScale);
        this.scene.add(obj);
        ent = { kind, obj, spec: item, from: start, to: target, s0: startScale, t0: now, dur: duration };
        this.ents.set(item.key, ent);
        if (duration === 0) { obj.position.copy(target); obj.scale.setScalar(1); }
        return ent;
      }
      ent.spec = item;
      ent.from = ent.obj.position.clone();
      ent.s0 = ent.obj.scale.x;
      ent.to = target;
      ent.t0 = now;
      ent.dur = duration;
      if (duration === 0) { ent.obj.position.copy(target); ent.obj.scale.setScalar(1); }
      return ent;
    };

    for (const f of spec.frames) place('frame', f, Z.frame, (x) => this.makeFrame(x), (e, x) => e.obj.userData.active === x.active && Math.abs(e.obj.userData.h - x.h) < 1e-6 && e.obj.userData.title === x.title);
    for (const o of spec.objects) place('object', o, Z.frame + 0.02, (x) => this.makeObject(x), (e, x) => e.obj.userData.w === x.w && e.obj.userData.h === x.h && e.obj.userData.text === (x.more ? `${x.title}  (+${x.more} more)` : x.title));
    for (const c of spec.cells) place('cell', c, Z.cell, (x) => this.makeCell(x), (e, x) => e.obj.userData.w === x.w && e.obj.userData.label === x.label);
    for (const s of spec.slots) place('slot', s, Z.slot, (x) => this.makeSlot(x), () => true);
    for (const v of spec.values) place('value', v, Z.value, (x) => this.makeValue(x), (e, x) => e.obj.userData.text === x.text && e.obj.userData.w === x.w && e.obj.userData.t === x.t);
    for (const m of spec.markers) place('marker', m, Z.marker, (x) => this.makeMarker(x), (e, x) => e.obj.userData.label === x.label && e.obj.userData.active === x.active);
    for (const c of spec.cursors) place('cursor', c, Z.cursor, (x) => this.makeCursor(x), (e, x) => e.obj.userData.w === x.w && e.obj.userData.label === x.label);

    const objIndex = new Map(spec.objects.map((o) => [o.key, o]));
    for (const a of spec.arrows) {
      seen.add(a.key);
      let ent = this.ents.get(a.key);
      if (!ent) {
        ent = { kind: 'arrow', obj: this.makeArrow(), spec: a };
        this.scene.add(ent.obj);
        this.ents.set(a.key, ent);
      }
      ent.spec = a;
      const target = objIndex.get(a.toKey);
      ent.offset = target ? [a.to[0] - target.x, a.to[1] - target.y] : [0, 0];
    }

    for (const [key, ent] of this.ents) {
      if (seen.has(key)) continue;
      this.ents.delete(key);
      if (ent.kind === 'arrow' || duration === 0) { this.scene.remove(ent.obj); disposeTree(ent.obj); continue; }
      ent.from = ent.obj.position.clone();
      ent.to = ent.from.clone().add(new THREE.Vector3(0, 1.2, 2));
      ent.s0 = ent.obj.scale.x;
      ent.t0 = now;
      ent.dur = duration * 0.8;
      this.exiting.add(ent);
    }

    this.animUntil = now + duration + 50;
    if (this.autoFit) this.fit(spec.bounds, duration === 0 && !this.camGoal);
    this.updateArrows();
  }

  updateArrows() {
    for (const ent of this.ents.values()) if (ent.kind === 'arrow') this.updateArrow(ent);
  }

  tick() {
    const now = performance.now();
    for (const ent of this.ents.values()) {
      if (ent.kind === 'arrow' || !ent.to) continue;
      const p = ent.dur ? Math.min(1, (now - ent.t0) / ent.dur) : 1;
      const e = ease(p);
      ent.obj.position.lerpVectors(ent.from, ent.to, e);
      // arc upwards while travelling so moving blocks visibly "lift" over others
      const dist = ent.from.distanceTo(ent.to);
      if (ent.kind === 'value' && dist > 0.5 && p < 1) ent.obj.position.z += Math.sin(Math.PI * e) * Math.min(2.2, 0.4 + dist * 0.25);
      let s = ent.s0 + (1 - ent.s0) * e;
      if (ent.flash && now - ent.flash < 500) s *= 1 + 0.22 * Math.sin(((now - ent.flash) / 500) * Math.PI);
      ent.obj.scale.setScalar(s);
    }
    for (const ent of this.exiting) {
      const p = Math.min(1, (now - ent.t0) / ent.dur);
      const e = ease(p);
      ent.obj.position.lerpVectors(ent.from, ent.to, e);
      ent.obj.scale.setScalar(Math.max(0.001, ent.s0 * (1 - e)));
      setOpacity(ent.obj, 1 - e);
      if (p >= 1) { this.scene.remove(ent.obj); disposeTree(ent.obj); this.exiting.delete(ent); }
    }
    if (now < (this.animUntil || 0)) this.updateArrows();

    if (this.autoFit && this.camGoal) {
      this.controls.target.lerp(this.camGoal.target, 0.08);
      this.camera.position.lerp(this.camGoal.pos, 0.08);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
