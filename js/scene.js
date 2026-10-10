// Three.js renderer: an ink-and-paper tabletop, cel-shaded like the rest of
// the site (vaibhav.co.uk's manga sketchbook look).
//
// model.js lays everything out on a 2D board (x right, y up). Here that board
// is laid flat on a table: a root group rotated -90° about X turns board y into
// "away from the camera" and board z into height. Blocks that persist between
// steps glide (and hop) to their new place, new blocks drop in, removed blocks
// lift away, so rewinding is simply reconciling to an earlier description.
//
// Camera: by default it follows the program, re-framing every step. Any manual
// move (drag, wheel, keys, toolbar) switches follow off until asked back.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const THEMES = {
  light: {
    bg: 0xf3ecdd, floor: 0xf3ecdd, dot: 'rgba(17,17,17,0.10)', zone: 'rgba(17,17,17,0.16)',
    ink: 0x111111, inkCss: '#111111', paperCss: '#f3ecdd',
    frame: 0xebe2cd, frameActive: 0xfff3c4, heap: 0xf8f2e4, cell: 0xddd1b6, plate: 0xfbf7ee,
    text: '#111111', muted: '#6a6358', accent: 0xff2e63, hi: 0xffd84d, arrow: 0x111111, cursor: 0xff2e63,
    hemiSky: 0xffffff, hemiGround: 0xcfc4ab, hemi: 1.15, sun: 1.9,
  },
  dark: {
    bg: 0x131311, floor: 0x131311, dot: 'rgba(243,236,221,0.08)', zone: 'rgba(243,236,221,0.16)',
    ink: 0xf3ecdd, inkCss: '#f3ecdd', paperCss: '#131311',
    frame: 0x1d1d1a, frameActive: 0x2a2614, heap: 0x191916, cell: 0x0b0b0a, plate: 0x26251f,
    text: '#f3ecdd', muted: '#9b937f', accent: 0xff2e63, hi: 0xffd84d, arrow: 0xf3ecdd, cursor: 0xff2e63,
    hemiSky: 0xfff6e0, hemiGround: 0x1d1d1a, hemi: 0.9, sun: 1.6,
  },
};

export const TYPE_COLORS = {
  int: 0x2f6fdb, float: 0x22d3ee, complex: 0x22d3ee, str: 0xffd84d,
  True: 0x3fae5a, False: 0xff2e63, None: 0xcfc6b2,
  function: 0xc084fc, class: 0xc084fc, builtin: 0xc084fc,
};
const MARKER_COLORS = [0xff2e63, 0x2f6fdb, 0x3fae5a, 0xc084fc, 0x22d3ee, 0xf97316];

// camera views: pitch above the table and yaw around it, in degrees
const VIEWS = { angled: { pitch: 54, yaw: -8 }, top: { pitch: 88, yaw: 0 }, front: { pitch: 24, yaw: 0 } };

// heights above the table (board z)
const H = { tray: 0.22, cell: 0.06, plate: 0.08, cube: 0.84 };
const Z = { tray: H.tray / 2, cell: H.tray + H.cell / 2, plate: H.tray + H.plate / 2, cube: H.tray + H.cell + H.cube / 2 + 0.01 };

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
function hashName(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function readableOn(color) {
  const c = new THREE.Color(color);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return l > 0.45 ? '#111111' : '#ffffff';
}

const FONT_SANS = '"Space Grotesk", system-ui, sans-serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';
const FONT_DISPLAY = '"Bungee", "Space Grotesk", sans-serif';

// three-band ramp for the cel-shaded look
let toonRamp = null;
function ramp() {
  if (!toonRamp) {
    toonRamp = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
    toonRamp.needsUpdate = true;
  }
  return toonRamp;
}

function textTexture(text, { color = '#111', bg = null, aspect = 1, weight = 700, align = 'center', font = FONT_MONO, scale = 0.56 }) {
  const h = 192;
  const w = Math.min(2048, Math.max(48, Math.round(h * aspect)));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
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

export class BlockScene {
  constructor(container, { interactive = true } = {}) {
    this.container = container;
    this.interactive = interactive;
    this.themeName = 'light';
    this.theme = THEMES.light;
    this.ents = new Map();
    this.exiting = new Set();
    this.follow = true;
    this.view = { ...VIEWS.angled };
    this.viewName = 'angled';
    this.lastSpec = null;
    this.camGoal = null;
    this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
    this.lastTick = performance.now();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;   // crisp, like the site's hard offset shadows
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
    this.controls.dampingFactor = 0.1;
    this.controls.screenSpacePanning = false;   // pan slides across the table
    this.controls.zoomToCursor = true;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 260;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.enabled = interactive;
    this.setDragMode('pan');
    this.controls.addEventListener('start', () => this.userMoved());

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial());
    this.floor.position.z = -0.001;
    this.floor.receiveShadow = true;
    this.floor.userData.isFloor = true;
    this.root.add(this.floor);

    this.raycaster = new THREE.Raycaster();
    if (interactive) {
      this.renderer.domElement.addEventListener('dblclick', (e) => this.focusAt(e.clientX, e.clientY));
    }

    this.applyTheme('light');
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  // ================================================================ theme
  applyTheme(name) {
    this.themeName = THEMES[name] ? name : 'light';
    const t = this.theme = THEMES[this.themeName];
    this.scene.background = new THREE.Color(t.bg);
    this.scene.fog = new THREE.Fog(t.bg, 80, 210);
    this.hemi.color.set(t.hemiSky); this.hemi.groundColor.set(t.hemiGround); this.hemi.intensity = t.hemi;
    this.sun.intensity = t.sun;

    // paper with the site's dotted grid
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = hex(t.floor); g.fillRect(0, 0, 64, 64);
    g.fillStyle = t.dot; g.beginPath(); g.arc(32, 32, 2.6, 0, Math.PI * 2); g.fill();
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
    for (const ent of [...this.ents.values(), ...this.exiting]) { this.root.remove(ent.obj); this.disposeTree(ent.obj); }
    this.ents.clear(); this.exiting.clear();
    if (this.lastSpec) this.render(this.lastSpec, { duration: 0 });
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.lastSpec && this.follow) this.fit(this.lastSpec.bounds, true);
  }

  // ================================================================ camera
  setInsets(insets) {
    this.insets = { ...this.insets, ...insets };
    if (this.lastSpec && this.follow) this.fit(this.lastSpec.bounds);
  }

  setFollow(on) {
    this.follow = on;
    if (on && this.lastSpec) this.fit(this.lastSpec.bounds);
    this.onCameraChange?.(this.cameraState());
  }

  recenter() { this.setFollow(true); }

  cameraState() { return { follow: this.follow, view: this.viewName, drag: this.dragMode }; }

  userMoved() {
    this.camGoal = null;
    if (this.follow) { this.follow = false; this.onCameraChange?.(this.cameraState()); }
  }

  setDragMode(mode) {
    this.dragMode = mode === 'rotate' ? 'rotate' : 'pan';
    const pan = this.dragMode === 'pan';
    this.controls.mouseButtons = { LEFT: pan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: pan ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN };
    this.controls.touches = { ONE: pan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.onCameraChange?.(this.cameraState());
  }

  setView(name) {
    if (!VIEWS[name]) return;
    this.viewName = name;
    this.view = { ...VIEWS[name] };
    const b = this.lastSpec ? this.lastSpec.bounds : { minX: 0, maxX: 22, minY: -8, maxY: 2 };
    this.fit(b);
    this.onCameraChange?.(this.cameraState());
  }

  // move the camera to a goal smoothly; manual moves pause follow
  goTo(target, pos) {
    if (this.follow) { this.follow = false; this.onCameraChange?.(this.cameraState()); }
    this.camGoal = { target, pos };
  }

  zoomBy(factor) {
    const t = (this.camGoal ? this.camGoal.target : this.controls.target).clone();
    const p = (this.camGoal ? this.camGoal.pos : this.camera.position).clone();
    const d = p.clone().sub(t);
    const len = THREE.MathUtils.clamp(d.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.goTo(t, t.clone().add(d.setLength(len)));
  }

  rotateBy(rad) {
    const t = (this.camGoal ? this.camGoal.target : this.controls.target).clone();
    const p = (this.camGoal ? this.camGoal.pos : this.camera.position).clone();
    const d = p.sub(t).applyAxisAngle(new THREE.Vector3(0, 1, 0), rad);
    this.goTo(t, t.clone().add(d));
  }

  // pan along the table, relative to where the camera faces
  panBy(right, forward) {
    const t = (this.camGoal ? this.camGoal.target : this.controls.target).clone();
    const p = (this.camGoal ? this.camGoal.pos : this.camera.position).clone();
    const dist = p.distanceTo(t);
    const fwd = t.clone().sub(p).setY(0).normalize();
    const rgt = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const delta = rgt.multiplyScalar(right * dist * 0.08).add(fwd.multiplyScalar(forward * dist * 0.08));
    this.goTo(t.add(delta), p.add(delta));
  }

  // double-click: fly to whatever is under the pointer
  focusAt(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.root.children, true).find((h) => h.object.visible && h.object.type === 'Mesh');
    if (!hit) return;
    const t = this.controls.target.clone();
    const p = this.camera.position.clone();
    const offset = p.sub(t).multiplyScalar(0.6);
    if (offset.length() < this.controls.minDistance * 1.5) offset.setLength(this.controls.minDistance * 1.5);
    this.goTo(hit.point.clone(), hit.point.clone().add(offset));
  }

  handleKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const k = e.key.toLowerCase();
    const map = {
      w: () => this.panBy(0, 1), s: () => this.panBy(0, -1), a: () => this.panBy(-1, 0), d: () => this.panBy(1, 0),
      q: () => this.rotateBy(Math.PI / 8), e: () => this.rotateBy(-Math.PI / 8),
      '+': () => this.zoomBy(0.8), '=': () => this.zoomBy(0.8), '-': () => this.zoomBy(1.25), _: () => this.zoomBy(1.25),
      f: () => this.setFollow(true), v: () => this.setView('angled'), t: () => this.setView('top'), g: () => this.setView('front'),
    };
    if (!map[k]) return false;
    map[k]();
    return true;
  }

  // Frame the board bounds from the current view, inside the area the
  // floating panels leave free.
  fit(b, instant = false) {
    const pad = 1.2;
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const w = b.maxX - b.minX + pad * 2, d = b.maxY - b.minY + pad * 2;
    const pitch = THREE.MathUtils.degToRad(this.view.pitch), yaw = THREE.MathUtils.degToRad(this.view.yaw);
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const W = this.container.clientWidth || 1, Hh = this.container.clientHeight || 1;
    const { top, bottom, left, right } = this.insets;
    const freeH = Math.max(0.3, (Hh - top - bottom) / Hh), freeW = Math.max(0.3, (W - left - right) / W);
    // the table recedes, so its depth shrinks on screen by sin(pitch)
    const depthOnScreen = d * Math.sin(pitch) + 1.6 * Math.cos(pitch);
    const dist = Math.max(depthOnScreen / 2 / t / freeH, w / 2 / (t * this.camera.aspect) / freeW, 12) * 1.02;
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const target = new THREE.Vector3(cx, 0, -cy);
    // slide the view so the content centres in the area not covered by panels
    const perPx = (2 * dist * t) / Hh;
    const worldUp = Math.abs(dir.y) > 0.98 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const up = worldUp.clone().sub(dir.clone().multiplyScalar(dir.dot(worldUp))).normalize();
    // camera-right on screen = up × dir. To push the content right (away from a
    // left-hand panel) the target moves left, and vice versa.
    const rightV = new THREE.Vector3().crossVectors(up, dir).normalize();
    target.addScaledVector(up, ((top - bottom) / 2) * perPx).addScaledVector(rightV, -((left - right) / 2) * perPx);
    const pos = target.clone().addScaledVector(dir, dist);
    this.camGoal = { target, pos };
    if (instant) { this.controls.target.copy(target); this.camera.position.copy(pos); }

    // light from the back-left, so shadows fall down-right like the site's offsets
    this.sun.position.set(cx - 12, 30, -cy - 10);
    this.sun.target.position.set(cx, 0, -cy);
    const s = this.sun.shadow.camera;
    const r = Math.max(w, d) * 0.75 + 8;
    s.left = -r; s.right = r; s.top = r; s.bottom = -r; s.near = 1; s.far = 140;
    s.updateProjectionMatrix();
  }

  // ================================================================ builders
  disposeTree(obj) {
    obj.traverse((o) => {
      if (o.geometry && !o.userData.sharedGeometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
    });
  }

  setOpacity(obj, a) {
    obj.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) { m.transparent = true; m.opacity = a * (m.userData.baseOpacity ?? 1); }
    });
  }

  // a rounded block with an ink outline (back-face hull) — the manga look
  inkedBox(w, d, h, r, color, { outline = 0.045, toon = true, shadow = true } = {}) {
    const radius = Math.min(r, w / 2 - 0.001, d / 2 - 0.001, h / 2 - 0.001);
    const geo = new RoundedBoxGeometry(w, d, h, 3, radius);
    const mat = toon
      ? new THREE.MeshToonMaterial({ color, gradientMap: ramp() })
      : new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    if (outline > 0) {
      const hull = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: this.theme.ink, side: THREE.BackSide }));
      hull.scale.set((w + outline * 2) / w, (d + outline * 2) / d, (h + outline * 2) / h);
      hull.userData.sharedGeometry = true;
      mesh.add(hull);
    }
    return mesh;
  }

  colorFor(v) {
    if (v.t === 'bool') return v.text === 'True' ? TYPE_COLORS.True : TYPE_COLORS.False;
    if (v.t === 'ref') return this.theme.ink;
    if (v.t === 'None' && this.themeName === 'dark') return 0x6d675a;
    return TYPE_COLORS[v.t] ?? 0xd9a066;
  }

  makeValue(v) {
    const g = new THREE.Group();
    const color = this.colorFor(v);
    const isRef = v.t === 'ref';
    const size = isRef ? 0.5 : H.cube;
    const body = this.inkedBox(v.w - 0.06, size, size, isRef ? 0.12 : 0.16, color, { outline: isRef ? 0.035 : 0.05 });
    body.material.emissive = new THREE.Color(this.theme.accent);
    body.material.emissiveIntensity = 0;
    g.add(body);
    if (isRef) {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), new THREE.MeshBasicMaterial({ color: this.theme.accent }));
      dot.position.z = size / 2 + 0.006;
      g.add(dot);
    } else {
      const face = decal(v.text, v.w - 0.14, size * 0.8, { color: readableOn(color), weight: 700, scale: v.text.length > 6 ? 0.5 : 0.6 });
      face.position.z = size / 2 + 0.006;
      g.add(face);
    }
    g.userData = { text: v.text, w: v.w, t: v.t, mat: body.material };
    return g;
  }

  makeSlot(s) {
    const g = new THREE.Group();
    const color = s.ret ? this.theme.accent : this.theme.plate;
    const plate = this.inkedBox(s.w, 0.74, H.plate, 0.05, color, { outline: 0.03, shadow: false });
    g.add(plate);
    const lab = decal(s.label, s.w - 0.12, 0.66, { color: s.ret ? '#ffffff' : this.theme.text, align: 'left', weight: s.field ? 400 : 700, scale: 0.58 });
    lab.position.z = H.plate / 2 + 0.004;
    g.add(lab);
    return g;
  }

  makeTray(o, { active = false, kind = 'frame' } = {}) {
    const g = new THREE.Group();
    const t = this.theme;
    const color = kind === 'heap' ? t.heap : active ? t.frameActive : t.frame;
    const tray = this.inkedBox(o.w, o.h, H.tray, 0.16, color, { outline: 0.06, toon: false, shadow: false });
    g.add(tray);
    if (active) {
      // neon corner brackets, the site's comic-panel accent
      const m = new THREE.MeshBasicMaterial({ color: t.accent });
      const L = 0.7, th = 0.09;
      for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const cx = sx * (o.w / 2 + 0.16), cy = sy * (o.h / 2 + 0.16);
        const a = new THREE.Mesh(new THREE.PlaneGeometry(L, th), m);
        a.position.set(cx - sx * (L / 2 - th / 2), cy, -H.tray / 2 + 0.01);
        const b = new THREE.Mesh(new THREE.PlaneGeometry(th, L), m);
        b.position.set(cx, cy - sy * (L / 2 - th / 2), -H.tray / 2 + 0.01);
        g.add(a, b);
      }
    }
    const titleW = Math.min(o.w - 0.4, Math.max(2.6, 0.27 * o.title.length + 0.8));
    const title = decal(o.title, titleW, 0.58, { color: active ? hex(t.accent) : t.muted, align: 'left', font: FONT_MONO, weight: 700, scale: 0.52 });
    title.position.set(-o.w / 2 + titleW / 2 + 0.12, o.h / 2 - 0.42, H.tray / 2 + 0.004);
    g.add(title);
    g.userData = { w: o.w, h: o.h, title: o.title, active };
    return g;
  }

  makeCell(c) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: this.theme.cell });
    if (c.ghost) { mat.transparent = true; mat.opacity = 0.55; mat.userData.baseOpacity = 0.55; }
    const tile = new THREE.Mesh(new RoundedBoxGeometry(c.w, c.row ? 1.0 : 1.04, H.cell, 2, 0.03), mat);
    tile.receiveShadow = true;
    g.add(tile);
    if (c.label != null) {
      const ghost = c.label === 'empty';
      const lab = decal(c.label, ghost ? 1.3 : 0.9, ghost ? 0.5 : 0.36, { color: this.theme.muted, weight: 700, scale: 0.62 });
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
    const chip = this.inkedBox(lw, 0.44, 0.08, 0.06, color, { outline: 0.035, shadow: false });
    const txt = decal(m.label, lw - 0.08, 0.38, { color: readableOn(color), weight: 700, scale: 0.62 });
    txt.position.z = 0.045;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 3), new THREE.MeshToonMaterial({ color, gradientMap: ramp() }));
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
    const w = c.w, d = 1.24, r = 0.2, inset = 0.08;
    const rr = (s, x, y, ww, hh) => { s.moveTo(x + r, y); s.lineTo(x + ww - r, y); s.quadraticCurveTo(x + ww, y, x + ww, y + r); s.lineTo(x + ww, y + hh - r); s.quadraticCurveTo(x + ww, y + hh, x + ww - r, y + hh); s.lineTo(x + r, y + hh); s.quadraticCurveTo(x, y + hh, x, y + hh - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); };
    const shape = new THREE.Shape();
    rr(shape, -w / 2, -d / 2, w, d);
    const hole = new THREE.Path();
    rr(hole, -w / 2 + inset, -d / 2 + inset, w - inset * 2, d - inset * 2);
    shape.holes.push(hole);
    const ring = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: c.done ? 0.35 : 1 }));
    ring.material.userData.baseOpacity = ring.material.opacity;
    ring.position.z = H.cell + 0.01;
    const lw = Math.max(1.6, 0.2 * c.label.length + 0.5);
    const tag = decal(c.label, lw, 0.42, { color: hex(color), weight: 700, scale: 0.6 });
    tag.position.set(0, d / 2 + 0.3, 0.02);
    g.add(ring, tag);
    g.userData = { w: c.w, label: c.label, done: c.done, ring };
    return g;
  }

  makeZone(z) {
    const g = new THREE.Group();
    g.add(decal(z.label, z.w, 0.8, { color: this.theme.zone, align: 'left', font: FONT_DISPLAY, weight: 400, scale: 0.6 }));
    g.userData = { label: z.label };
    return g;
  }

  makeArrow() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: this.theme.arrow });
    const tube = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    tube.castShadow = true;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 14), new THREE.MeshBasicMaterial({ color: this.theme.accent }));
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
    tube.geometry = new THREE.TubeGeometry(curve, 40, 0.035, 8, false);
    const tan = curve.getTangent(1);
    head.position.copy(b).addScaledVector(tan, -0.15);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
  }

  // ================================================================ reconcile
  render(spec, { duration = 450 } = {}) {
    this.lastSpec = spec;
    const now = performance.now();
    const seen = new Set();
    const nextValues = new Map(spec.values.map((v) => [v.key, v]));

    // a value that vanishes in one place and appears elsewhere flies across
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
        this.root.remove(ent.obj); this.disposeTree(ent.obj);
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
        const fade = kind !== 'value';
        if (kind === 'value' && item.t !== 'ref') {
          const pool = vanishing.get(item.sig);
          const donor = pool && pool.shift();
          if (donor) {
            start = donor.obj.position.clone();
            this.root.remove(donor.obj); this.disposeTree(donor.obj); this.ents.delete(donor.spec.key);
          } else if (!item.key.startsWith('var:') && surviving.has(item.sig)) {
            start = surviving.get(item.sig).obj.position.clone(); startScale = 0.7;
          }
        }
        obj.position.copy(start);
        obj.scale.setScalar(startScale);
        if (fade) this.setOpacity(obj, 0);
        this.root.add(obj);
        ent = { kind, obj, spec: item, from: start, to: target, s0: startScale, t0: now, dur: duration, enter: true, fade };
        this.ents.set(item.key, ent);
        if (duration === 0) { obj.position.copy(target); obj.scale.setScalar(1); if (fade) this.setOpacity(obj, 1); }
        return ent;
      }
      ent.spec = item;
      ent.from = ent.obj.position.clone();
      ent.s0 = ent.obj.scale.x;
      ent.to = target;
      ent.t0 = now;
      ent.dur = duration;
      ent.enter = false;
      if (ent.fade) { this.setOpacity(ent.obj, 1); ent.fade = false; }
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
      if (ent.kind === 'arrow' || duration === 0) { this.root.remove(ent.obj); this.disposeTree(ent.obj); continue; }
      ent.from = ent.obj.position.clone();
      ent.to = ent.from.clone().add(new THREE.Vector3(0, 0, ent.kind === 'value' ? 2.6 : 0.6));
      ent.s0 = ent.obj.scale.x;
      ent.t0 = now;
      ent.dur = duration * 0.75;
      this.exiting.add(ent);
    }

    this.animUntil = now + duration + 60;
    if (this.follow) this.fit(spec.bounds, duration === 0 && !this.camGoal);
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
      const flat = Math.hypot(ent.to.x - ent.from.x, ent.to.y - ent.from.y);
      if (ent.kind === 'value' && flat > 0.3 && p < 1) ent.obj.position.z += Math.sin(Math.PI * easeInOut(p)) * Math.min(2.4, 0.7 + flat * 0.22);
      ent.obj.scale.setScalar(ent.s0 + (1 - ent.s0) * Math.min(1, easeInOut(p)));
      if (ent.fade) { this.setOpacity(ent.obj, Math.min(1, p * 1.4)); if (p >= 1) ent.fade = false; }
      if (ent.flash) {
        const f = (now - ent.flash) / 700;
        const mat = ent.obj.userData.mat;
        if (f < 1) {
          const k = Math.sin(f * Math.PI);
          if (mat && mat.emissive) mat.emissiveIntensity = 0.5 * k;
          ent.obj.position.z += 0.35 * k;
        } else { if (mat && mat.emissive) mat.emissiveIntensity = 0; ent.flash = 0; }
      }
      if (ent.kind === 'cursor' && !ent.spec.done) {
        ent.obj.userData.ring.material.opacity = 0.7 + 0.3 * Math.sin(now / 260);
      }
    }
    for (const ent of this.exiting) {
      const p = Math.min(1, (now - ent.t0) / ent.dur);
      const e = easeInOut(p);
      ent.obj.position.lerpVectors(ent.from, ent.to, e);
      ent.obj.scale.setScalar(Math.max(0.001, ent.s0 * (1 - 0.4 * e)));
      this.setOpacity(ent.obj, 1 - e);
      if (p >= 1) { this.root.remove(ent.obj); this.disposeTree(ent.obj); this.exiting.delete(ent); }
    }
    // keep arrows glued to their endpoints while anything moves, plus one settling frame
    if (moving || this.wasMoving || now < (this.animUntil || 0)) this.updateArrows();
    this.wasMoving = moving;

    if (this.camGoal) {
      const k = 1 - Math.exp(-dt * 5);
      this.controls.target.lerp(this.camGoal.target, k);
      this.camera.position.lerp(this.camGoal.pos, k);
      if (!this.follow && this.camera.position.distanceTo(this.camGoal.pos) < 0.01 && this.controls.target.distanceTo(this.camGoal.target) < 0.01) this.camGoal = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
