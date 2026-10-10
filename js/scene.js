// Three.js renderer: a tabletop of soft blocks seen from above.
//
// model.js lays everything out on a 2D board (x right, y up). Here that board
// is laid flat on a table: a root group rotated -90° about X turns board y into
// "away from the camera" and board z into height. Blocks that persist between
// steps glide (and hop) to their new place, new blocks drop in, removed blocks
// lift away, so rewinding is simply reconciling to an earlier description.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const THEMES = {
  dark: {
    bg: 0x0b0c10, floor: 0x0f1015, dot: 'rgba(255,255,255,0.07)', zone: 'rgba(255,255,255,0.10)',
    frame: 0x1a1d25, frameActive: 0x232634, heap: 0x15171e, cell: 0x0c0d12, plate: 0x262a35,
    text: '#e8e9ec', muted: '#7f8592', accent: 0xffb224, arrow: 0x8b9cff, cursor: 0xffb224, ref: 0x2b2f3a,
    hemiSky: 0xb9c2ff, hemiGround: 0x15161c, hemi: 1.1, sun: 2.1,
  },
  light: {
    bg: 0xf3f1ec, floor: 0xeeebe4, dot: 'rgba(40,30,20,0.10)', zone: 'rgba(40,30,20,0.12)',
    frame: 0xffffff, frameActive: 0xfffaf0, heap: 0xfbfaf7, cell: 0xe6e2d9, plate: 0xf1eee8,
    text: '#17181c', muted: '#8a8478', accent: 0xf59e0b, arrow: 0x5b6cff, cursor: 0xf59e0b, ref: 0x3b4050,
    hemiSky: 0xffffff, hemiGround: 0xcfc8bb, hemi: 1.5, sun: 2.0,
  },
};

export const TYPE_COLORS = {
  int: 0x7c8cff, float: 0x3fc1ad, complex: 0x3fc1ad, str: 0xf2a65a,
  True: 0x7dd36a, False: 0xf07a7a, None: 0x6b7080,
  function: 0xb48cff, class: 0xb48cff, builtin: 0xb48cff,
};
const MARKER_COLORS = [0xff6b8b, 0x4cc9f0, 0xc77dff, 0x52d6a4, 0xff9f43, 0xf15bb5, 0x9bb0c9];

// heights above the table (board z)
const H = { tray: 0.22, cell: 0.06, plate: 0.08, cube: 0.84 };
const Z = { tray: H.tray / 2, cell: H.tray + H.cell / 2, plate: H.tray + H.plate / 2, cube: H.tray + H.cell + H.cube / 2 + 0.01, label: H.tray + 0.012 };

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
function hashName(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

const FONT_SANS = '"Geist", "Inter", system-ui, sans-serif';
const FONT_MONO = '"Geist Mono", "JetBrains Mono", ui-monospace, monospace';

// Crisp text on a transparent (or coloured, rounded) canvas.
function textTexture(text, { color = '#fff', bg = null, aspect = 1, weight = 600, align = 'center', font = FONT_MONO, scale = 0.56, radius = 0 }) {
  const h = 192;
  const w = Math.min(2048, Math.max(48, Math.round(h * aspect)));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(0, 0, w, h, radius * h);
    g.fill();
  }
  let size = Math.round(h * scale);
  const fit = () => { g.font = `${weight} ${size}px ${font}`; };
  fit();
  while (size > 18 && g.measureText(text).width > w * 0.86) { size -= 4; fit(); }
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.textAlign = align;
  g.fillText(text, align === 'left' ? w * 0.07 : w / 2, h / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function decal(text, w, h, opts) {
  const mat = new THREE.MeshBasicMaterial({ map: textTexture(text, { aspect: w / h, ...opts }), transparent: true, depthWrite: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function roundedBox(w, d, h, r, material) {
  const radius = Math.min(r, w / 2 - 0.001, d / 2 - 0.001, h / 2 - 0.001);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, d, h, 3, radius), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
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

export class BlockScene {
  constructor(container, { interactive = true } = {}) {
    this.container = container;
    this.themeName = 'dark';
    this.theme = THEMES.dark;
    this.ents = new Map();
    this.exiting = new Set();
    this.autoFit = true;
    this.lastSpec = null;
    this.camGoal = null;
    this.insets = { top: 0, bottom: 0, left: 0, right: 0 };   // px covered by overlays
    this.lastTick = performance.now();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.root = new THREE.Group();
    this.root.rotation.x = -Math.PI / 2;
    this.scene.add(this.root);

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
    this.camera.position.set(10, 30, 30);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.44;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 220;
    this.controls.enabled = interactive;
    this.controls.addEventListener('start', () => { this.autoFit = false; this.onUserCamera?.(); });

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 6;
    this.fill = new THREE.DirectionalLight(0xffffff, 0.35);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.fill);

    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }));
    this.floor.position.z = -0.001;
    this.floor.receiveShadow = true;
    this.root.add(this.floor);

    this.applyTheme('dark');
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  // ---------------------------------------------------------------- theme
  applyTheme(name) {
    this.themeName = THEMES[name] ? name : 'dark';
    const t = this.theme = THEMES[this.themeName];
    this.scene.background = new THREE.Color(t.bg);
    this.scene.fog = new THREE.Fog(t.bg, 70, 190);
    this.hemi.color.set(t.hemiSky); this.hemi.groundColor.set(t.hemiGround); this.hemi.intensity = t.hemi;
    this.sun.intensity = t.sun;

    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = hex(t.floor); g.fillRect(0, 0, 64, 64);
    g.fillStyle = t.dot; g.beginPath(); g.arc(32, 32, 2.2, 0, Math.PI * 2); g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(600, 600);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    if (this.floor.material.map) this.floor.material.map.dispose();
    this.floor.material.map = tex;
    this.floor.material.needsUpdate = true;
  }

  setTheme(name) {
    this.applyTheme(name);
    for (const ent of [...this.ents.values(), ...this.exiting]) { this.root.remove(ent.obj); disposeTree(ent.obj); }
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

  // Frame the board bounds from above-front at a fixed pitch.
  setInsets(insets) { this.insets = { ...this.insets, ...insets }; if (this.lastSpec && this.autoFit) this.fit(this.lastSpec.bounds); }

  fit(b, instant = false) {
    const pad = 1.2;
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const w = b.maxX - b.minX + pad * 2, d = b.maxY - b.minY + pad * 2;
    const pitch = THREE.MathUtils.degToRad(54), yaw = THREE.MathUtils.degToRad(-8);
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const W = this.container.clientWidth || 1, Hh = this.container.clientHeight || 1;
    const { top, bottom, left, right } = this.insets;
    const freeH = Math.max(0.3, (Hh - top - bottom) / Hh), freeW = Math.max(0.3, (W - left - right) / W);
    // the table recedes, so its depth shrinks on screen by sin(pitch)
    const dist = Math.max((d * Math.sin(pitch) + 1.5) / 2 / t / freeH, w / 2 / (t * this.camera.aspect) / freeW, 12) * 1.02;
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const target = new THREE.Vector3(cx, 0, -cy);
    // slide the view so the content centres in the area not covered by overlays
    const perPx = (2 * dist * t) / Hh;
    const up = new THREE.Vector3(0, 1, 0).sub(dir.clone().multiplyScalar(dir.y)).normalize();
    const rightV = new THREE.Vector3().crossVectors(up, dir).normalize().negate();
    target.addScaledVector(up, ((top - bottom) / 2) * perPx).addScaledVector(rightV, -((left - right) / 2) * perPx);
    const pos = target.clone().addScaledVector(dir, dist);
    this.camGoal = { target, pos };
    if (instant) { this.controls.target.copy(target); this.camera.position.copy(pos); }

    this.sun.position.set(cx - 10, 26, -cy + 14);
    this.sun.target.position.copy(target);
    this.fill.position.set(cx + 20, 10, -cy - 10);
    const s = this.sun.shadow.camera;
    const r = Math.max(w, d) * 0.7 + 8;
    s.left = -r; s.right = r; s.top = r; s.bottom = -r; s.near = 1; s.far = 120;
    s.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ builders
  colorFor(v) {
    if (v.t === 'bool') return v.text === 'True' ? TYPE_COLORS.True : TYPE_COLORS.False;
    if (v.t === 'ref') return this.theme.ref;
    return TYPE_COLORS[v.t] ?? 0xa08c7a;
  }

  makeValue(v) {
    const g = new THREE.Group();
    const color = this.colorFor(v);
    const isRef = v.t === 'ref';
    const size = isRef ? 0.5 : H.cube;
    const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4, emissive: this.theme.accent, emissiveIntensity: 0 });
    const body = roundedBox(v.w - 0.06, size, size, isRef ? 0.12 : 0.16, mat);
    g.add(body);
    if (isRef) {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshBasicMaterial({ color: this.theme.arrow }));
      dot.position.z = size / 2 + 0.006;
      g.add(dot);
    } else {
      const face = decal(v.text, v.w - 0.14, size * 0.8, { color: '#ffffff', weight: 600, scale: v.text.length > 6 ? 0.5 : 0.6 });
      face.position.z = size / 2 + 0.006;
      g.add(face);
    }
    g.userData = { text: v.text, w: v.w, t: v.t, mat };
    return g;
  }

  makeSlot(s) {
    const g = new THREE.Group();
    const plate = roundedBox(s.w, 0.74, H.plate, 0.04, new THREE.MeshStandardMaterial({ color: s.ret ? this.theme.accent : this.theme.plate, roughness: 0.9 }));
    plate.castShadow = false;
    g.add(plate);
    const lab = decal(s.label, s.w - 0.12, 0.66, { color: s.ret ? '#17181c' : this.theme.text, align: 'left', weight: s.field ? 500 : 600, scale: 0.58 });
    lab.position.z = H.plate / 2 + 0.004;
    g.add(lab);
    return g;
  }

  makeTray(o, { active = false, kind = 'frame' } = {}) {
    const g = new THREE.Group();
    const t = this.theme;
    const color = kind === 'heap' ? t.heap : active ? t.frameActive : t.frame;
    const tray = roundedBox(o.w, o.h, H.tray, 0.14, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    tray.castShadow = false;
    g.add(tray);
    if (active) {
      const rim = roundedBox(o.w + 0.12, o.h + 0.12, 0.04, 0.18, new THREE.MeshBasicMaterial({ color: t.accent }));
      rim.position.z = -H.tray / 2 + 0.02;
      g.add(rim);
    }
    const titleW = Math.min(o.w - 0.4, Math.max(2.6, 0.26 * o.title.length + 0.8));
    const title = decal(o.title, titleW, 0.58, { color: active ? hex(t.accent) : t.muted, align: 'left', font: FONT_MONO, weight: 600, scale: 0.52 });
    title.position.set(-o.w / 2 + titleW / 2 + 0.12, o.h / 2 - 0.42, H.tray / 2 + 0.004);
    g.add(title);
    g.userData = { w: o.w, h: o.h, title: o.title, active };
    return g;
  }

  makeCell(c) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: this.theme.cell, roughness: 1 });
    if (c.ghost) { mat.transparent = true; mat.opacity = 0.5; mat.userData.baseOpacity = 0.5; }
    const tile = roundedBox(c.w, c.row ? 1.0 : 1.04, H.cell, 0.08, mat);
    tile.castShadow = false;
    g.add(tile);
    if (c.label != null) {
      const ghost = c.label === 'empty';
      const lab = decal(c.label, ghost ? 1.3 : 0.9, ghost ? 0.5 : 0.36, { color: this.theme.muted, weight: 500, scale: 0.62 });
      lab.position.set(0, ghost ? 0 : -0.74, ghost ? H.cell / 2 + 0.004 : -H.cell / 2 + 0.002);
      g.add(lab);
    }
    g.userData = { w: c.w, label: c.label };
    return g;
  }

  makeMarker(m) {
    const g = new THREE.Group();
    const color = MARKER_COLORS[hashName(m.name) % MARKER_COLORS.length];
    const lw = Math.max(0.9, 0.22 * m.label.length + 0.4);
    const chip = roundedBox(lw, 0.44, 0.08, 0.06, new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: m.active ? 0.25 : 0 }));
    const txt = decal(m.label, lw - 0.08, 0.38, { color: '#ffffff', weight: 700, scale: 0.62 });
    txt.position.z = 0.045;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 3), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
    head.castShadow = true;
    if (m.side) {
      chip.position.x = -lw / 2 + 0.25; txt.position.x = chip.position.x;
      head.rotation.z = -Math.PI / 2; head.position.set(0.55, 0, 0.05);
    } else {
      head.position.set(0, 0.36, 0.05);
    }
    g.add(chip, txt, head);
    g.userData = { label: m.label, active: m.active };
    return g;
  }

  makeCursor(c) {
    const g = new THREE.Group();
    const color = this.theme.cursor;
    const w = c.w, d = 1.24;
    const shape = new THREE.Shape();
    const r = 0.2;
    const rr = (s, x, y, ww, hh) => { s.moveTo(x + r, y); s.lineTo(x + ww - r, y); s.quadraticCurveTo(x + ww, y, x + ww, y + r); s.lineTo(x + ww, y + hh - r); s.quadraticCurveTo(x + ww, y + hh, x + ww - r, y + hh); s.lineTo(x + r, y + hh); s.quadraticCurveTo(x, y + hh, x, y + hh - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); };
    rr(shape, -w / 2, -d / 2, w, d);
    const hole = new THREE.Path();
    const inset = 0.07;
    rr(hole, -w / 2 + inset, -d / 2 + inset, w - inset * 2, d - inset * 2);
    shape.holes.push(hole);
    const ring = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: c.done ? 0.35 : 1 }));
    ring.material.userData.baseOpacity = ring.material.opacity;
    ring.position.z = H.cell + 0.01;
    const glow = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, d - 0.1, 1.4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: c.done ? 0.03 : 0.09, depthWrite: false }));
    glow.material.userData.baseOpacity = glow.material.opacity;
    glow.position.z = 0.75;
    const lw = Math.max(1.6, 0.2 * c.label.length + 0.5);
    const tag = decal(c.label, lw, 0.4, { color: hex(color), weight: 700, scale: 0.6 });
    tag.position.set(0, d / 2 + 0.3, 0.02);
    g.add(ring, glow, tag);
    g.userData = { w: c.w, label: c.label, done: c.done, ring };
    return g;
  }

  makeZone(z) {
    const g = new THREE.Group();
    const lab = decal(z.label, z.w, 0.8, { color: this.theme.zone, align: 'left', font: FONT_SANS, weight: 700, scale: 0.62 });
    g.add(lab);
    g.userData = { label: z.label };
    return g;
  }

  makeArrow() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: this.theme.arrow, roughness: 0.4, emissive: this.theme.arrow, emissiveIntensity: 0.25 });
    const tube = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    tube.castShadow = true;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 14), mat);
    head.castShadow = true;
    g.add(tube, head);
    g.userData = { tube, head };
    return g;
  }

  updateArrow(ent) {
    const from = this.ents.get(ent.spec.fromKey), to = this.ents.get(ent.spec.toKey);
    if (!from || !to) { ent.obj.visible = false; return; }
    ent.obj.visible = true;
    const a = from.obj.position.clone().add(new THREE.Vector3(0, 0, 0.28));
    const b = to.obj.position.clone().add(new THREE.Vector3(ent.offset[0] - 0.05, ent.offset[1], H.tray / 2 + 0.1));
    const dist = a.distanceTo(b);
    const back = b.x < a.x;
    const lift = Math.min(4.5, 0.8 + dist * (back ? 0.32 : 0.18));
    const reach = Math.min(3, Math.max(0.6, Math.abs(b.x - a.x) * 0.35));
    const curve = new THREE.CubicBezierCurve3(a, a.clone().add(new THREE.Vector3(back ? 0.4 : reach, 0, lift)), b.clone().add(new THREE.Vector3(-reach, 0, lift * 0.8)), b);
    const { tube, head } = ent.obj.userData;
    tube.geometry.dispose();
    tube.geometry = new THREE.TubeGeometry(curve, 40, 0.032, 8, false);
    const tan = curve.getTangent(1);
    head.position.copy(b).addScaledVector(tan, -0.14);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
  }

  // -------------------------------------------------------- reconcile
  render(spec, { duration = 450 } = {}) {
    this.lastSpec = spec;
    const now = performance.now();
    const seen = new Set();
    const nextValues = new Map(spec.values.map((v) => [v.key, v]));

    // A value that vanishes in one place and appears elsewhere flies across.
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
        const scale = ent.obj.scale.x;
        this.root.remove(ent.obj); disposeTree(ent.obj);
        ent.obj = build(item);
        ent.obj.position.copy(pos);
        ent.obj.scale.setScalar(scale);
        this.root.add(ent.obj);
        ent.flash = now;
      }
      if (!ent) {
        const obj = build(item);
        let start = target.clone().add(new THREE.Vector3(0, 0, kind === 'value' || kind === 'marker' ? 3.2 : 0.01));
        let startScale = kind === 'value' ? 1 : 0.92;
        let fade = kind !== 'value';
        if (kind === 'value' && item.t !== 'ref') {
          const pool = vanishing.get(item.sig);
          const donor = pool && pool.shift();
          if (donor) {
            start = donor.obj.position.clone();
            this.root.remove(donor.obj); disposeTree(donor.obj); this.ents.delete(donor.spec.key);
          } else if (!item.key.startsWith('var:') && surviving.has(item.sig)) {
            start = surviving.get(item.sig).obj.position.clone(); startScale = 0.7;
          }
        }
        obj.position.copy(start);
        obj.scale.setScalar(startScale);
        if (fade) setOpacity(obj, 0);
        this.root.add(obj);
        ent = { kind, obj, spec: item, from: start, to: target, s0: startScale, t0: now, dur: duration, enter: true, fade };
        this.ents.set(item.key, ent);
        if (duration === 0) { obj.position.copy(target); obj.scale.setScalar(1); if (fade) setOpacity(obj, 1); }
        return ent;
      }
      ent.spec = item;
      ent.from = ent.obj.position.clone();
      ent.s0 = ent.obj.scale.x;
      ent.to = target;
      ent.t0 = now;
      ent.dur = duration;
      ent.enter = false;
      if (ent.fade) { setOpacity(ent.obj, 1); ent.fade = false; }
      if (duration === 0) { ent.obj.position.copy(target); ent.obj.scale.setScalar(1); }
      return ent;
    };

    for (const z of spec.zones || []) place('zone', z, 0.003, (x) => this.makeZone(x), (e, x) => e.obj.userData.label === x.label);
    for (const f of spec.frames) place('frame', f, Z.tray, (x) => this.makeTray(x, { active: x.active }), (e, x) => e.obj.userData.active === x.active && e.obj.userData.h === x.h && e.obj.userData.w === x.w && e.obj.userData.title === x.title);
    for (const o of spec.objects) place('object', o, Z.tray, (x) => this.makeTray(x, { kind: 'heap' }), (e, x) => e.obj.userData.w === x.w && e.obj.userData.h === x.h && e.obj.userData.title === x.title);
    for (const c of spec.cells) place('cell', c, Z.cell, (x) => this.makeCell(x), (e, x) => e.obj.userData.w === x.w && e.obj.userData.label === x.label);
    for (const s of spec.slots) place('slot', s, Z.plate, (x) => this.makeSlot(x), () => true);
    for (const v of spec.values) place('value', v, Z.cube, (x) => this.makeValue(x), (e, x) => e.obj.userData.text === x.text && e.obj.userData.w === x.w && e.obj.userData.t === x.t);
    for (const m of spec.markers) place('marker', m, H.tray + 0.05, (x) => this.makeMarker(x), (e, x) => e.obj.userData.label === x.label && e.obj.userData.active === x.active);
    for (const c of spec.cursors) place('cursor', c, H.tray, (x) => this.makeCursor(x), (e, x) => e.obj.userData.w === x.w && e.obj.userData.label === x.label && e.obj.userData.done === x.done);

    const objIndex = new Map(spec.objects.map((o) => [o.key, o]));
    for (const a of spec.arrows) {
      seen.add(a.key);
      let ent = this.ents.get(a.key);
      if (!ent) {
        ent = { kind: 'arrow', obj: this.makeArrow(), spec: a };
        this.root.add(ent.obj);
        this.ents.set(a.key, ent);
      }
      ent.spec = a;
      const target = objIndex.get(a.toKey);
      ent.offset = target ? [a.to[0] - target.x, a.to[1] - target.y] : [0, 0];
    }

    for (const [key, ent] of this.ents) {
      if (seen.has(key)) continue;
      this.ents.delete(key);
      if (ent.kind === 'arrow' || duration === 0) { this.root.remove(ent.obj); disposeTree(ent.obj); continue; }
      ent.from = ent.obj.position.clone();
      ent.to = ent.from.clone().add(new THREE.Vector3(0, 0, ent.kind === 'value' ? 2.6 : 0.6));
      ent.s0 = ent.obj.scale.x;
      ent.t0 = now;
      ent.dur = duration * 0.75;
      this.exiting.add(ent);
    }

    this.animUntil = now + duration + 60;
    if (this.autoFit) this.fit(spec.bounds, duration === 0 && !this.camGoal);
    this.updateArrows();
  }

  updateArrows() {
    for (const ent of this.ents.values()) if (ent.kind === 'arrow') this.updateArrow(ent);
  }

  tick() {
    const now = performance.now();
    const dt = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;
    let moving = false;
    for (const ent of this.ents.values()) {
      if (ent.kind === 'arrow' || !ent.to) continue;
      const p = ent.dur ? Math.min(1, (now - ent.t0) / ent.dur) : 1;
      if (p < 1 || ent.flash) moving = true;
      const e = ent.enter && ent.kind === 'value' ? easeOutBack(p) : easeInOut(p);
      ent.obj.position.lerpVectors(ent.from, ent.to, Math.min(e, ent.enter ? 1.2 : 1));
      if (ent.enter && ent.kind === 'value') ent.obj.position.z = ent.from.z + (ent.to.z - ent.from.z) * Math.min(1, e);
      // hop over neighbours while travelling across the table
      const dx = ent.to.x - ent.from.x, dy = ent.to.y - ent.from.y;
      const flat = Math.hypot(dx, dy);
      if (ent.kind === 'value' && flat > 0.3 && p < 1) ent.obj.position.z += Math.sin(Math.PI * easeInOut(p)) * Math.min(2.4, 0.7 + flat * 0.22);
      ent.obj.scale.setScalar(ent.s0 + (1 - ent.s0) * Math.min(1, easeInOut(p)));
      if (ent.fade) { setOpacity(ent.obj, Math.min(1, p * 1.4)); if (p >= 1) ent.fade = false; }
      if (ent.flash) {
        const f = (now - ent.flash) / 700;
        const mat = ent.obj.userData.mat;
        if (f < 1) {
          const k = Math.sin(f * Math.PI);
          if (mat) mat.emissiveIntensity = 0.55 * k;
          ent.obj.position.z += 0.35 * k;
        } else { if (mat) mat.emissiveIntensity = 0; ent.flash = 0; }
      }
      if (ent.kind === 'cursor' && !ent.spec.done) {
        const ring = ent.obj.userData.ring;
        ring.material.opacity = 0.7 + 0.3 * Math.sin(now / 260);
      }
    }
    for (const ent of this.exiting) {
      const p = Math.min(1, (now - ent.t0) / ent.dur);
      const e = easeInOut(p);
      ent.obj.position.lerpVectors(ent.from, ent.to, e);
      ent.obj.scale.setScalar(Math.max(0.001, ent.s0 * (1 - 0.4 * e)));
      setOpacity(ent.obj, 1 - e);
      if (p >= 1) { this.root.remove(ent.obj); disposeTree(ent.obj); this.exiting.delete(ent); }
    }
    // keep arrows glued to their endpoints while anything moves, plus one settling frame
    if (moving || this.wasMoving || now < (this.animUntil || 0)) this.updateArrows();
    this.wasMoving = moving;

    if (this.autoFit && this.camGoal) {
      const k = 1 - Math.exp(-dt * 4.5);
      this.controls.target.lerp(this.camGoal.target, k);
      this.camera.position.lerp(this.camGoal.pos, k);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
