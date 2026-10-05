import { CodeEditor } from './editor.js';
import { EXAMPLES } from './examples.js';
import { decodeStep, layoutStep, TokenBook } from './model.js';
import { loadPython, test as runTests, trace as runTrace } from './runtime.js';
import { LEVELS, TRACKS } from '../levels/index.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
};

const state = {
  mode: 'levels',
  level: null,
  example: null,
  steps: [],
  lines: [],
  outAt: [],
  idx: 0,
  playing: false,
  timer: null,
  speed: 1,
  ctx: null,
  scene: null,
  progress: store.get('codeblocks-progress', {}),
};

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const md = (s) => s.split(/\n\n+/).map((p) => `<p>${escapeHtml(p).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>')}</p>`).join('');
const pyRepr = (v) => JSON.stringify(v).replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None');

function toast(msg, kind = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${kind}`;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3200);
}

// ------------------------------------------------------------- editor
const editor = new CodeEditor($('editor'), {
  onChange: (code) => {
    if (state.mode === 'levels' && state.level) store.set(`codeblocks-draft:${state.level.id}`, code);
    else store.set('codeblocks-playground', code);
  },
});
editor.onRun = () => visualize();

// ------------------------------------------------------------- 3D scene
async function initScene() {
  try {
    const { BlockScene } = await import('./scene.js');
    state.scene = new BlockScene($('viewport'));
    state.scene.applyTheme(document.documentElement.dataset.theme);
    state.scene.onUserCamera = () => { $('recenterBtn').hidden = false; };
  } catch (err) {
    console.error(err);
    $('viewportMsg').innerHTML = '<p>The 3D engine could not load.</p><p class="muted">Check your connection (Three.js is served from cdn.jsdelivr.net) and that WebGL is enabled. The step-by-step decoder still works.</p>';
  }
}

// ------------------------------------------------------------- python
function setPyStatus(text, kind) {
  const el = $('pyStatus');
  el.className = `py-status ${kind || ''}`;
  el.querySelector('.txt').textContent = text;
}

loadPython((msg) => setPyStatus(msg, 'loading'))
  .then(() => setPyStatus('Python ready', 'ready'))
  .catch((err) => { console.error(err); setPyStatus('Python failed to load', 'error'); });

// ------------------------------------------------------------- sidebar
function renderTracks(filter = '') {
  const q = filter.trim().toLowerCase();
  const html = TRACKS.map((track) => {
    const levels = LEVELS.filter((l) => l.track === track.id && (!q || `${l.title} ${l.concepts.join(' ')} ${l.difficulty}`.toLowerCase().includes(q)));
    if (!levels.length) return '';
    const done = levels.filter((l) => state.progress[l.id]).length;
    return `<div class="track">
      <div class="track-head"><h3>${escapeHtml(track.title)}</h3><span>${done}/${levels.length}</span></div>
      <p class="track-blurb">${escapeHtml(track.blurb)}</p>
      <ol class="level-list">${levels.map((l) => `
        <li><button class="level-item ${state.level && state.level.id === l.id ? 'active' : ''} ${state.progress[l.id] ? 'done' : ''}" data-id="${l.id}">
          <span class="level-num">${LEVELS.indexOf(l) + 1}</span>
          <span class="level-title">${escapeHtml(l.title)}</span>
          <span class="badge ${l.difficulty.toLowerCase()}">${l.difficulty}</span>
        </button></li>`).join('')}
      </ol></div>`;
  }).join('');
  $('trackList').innerHTML = html || '<p class="side-note">No levels match.</p>';
  const total = Object.keys(state.progress).filter((id) => LEVELS.some((l) => l.id === id)).length;
  $('progressPill').textContent = `${total} / ${LEVELS.length}`;
}

function renderExamples() {
  $('exampleList').innerHTML = EXAMPLES.map((ex, i) => `
    <button class="example-item ${state.example === i ? 'active' : ''}" data-i="${i}">
      <strong>${escapeHtml(ex.title)}</strong><span>${escapeHtml(ex.note)}</span>
    </button>`).join('');
}

function renderBrief() {
  const b = $('brief');
  if (state.mode === 'playground') {
    b.innerHTML = `<div class="brief-head"><h2>Playground</h2></div>
      <p>Write any Python and press <b>▶ Visualize</b>. Each executed line becomes one step: the <b>FETCH</b> bar shows the line, <b>DECODE</b> explains what it does to memory, and the 3D view <b>EXECUTES</b> it.</p>
      <p class="muted">Tip: keep programs small (under ~1500 steps). Ctrl/⌘ + Enter runs.</p>`;
    $('checkBtn').hidden = true;
    $('demoBtn').hidden = true;
    $('resetBtn').hidden = true;
    return;
  }
  const l = state.level;
  $('checkBtn').hidden = false;
  $('demoBtn').hidden = false;
  $('resetBtn').hidden = false;
  const idx = LEVELS.indexOf(l);
  b.innerHTML = `<div class="brief-head">
      <span class="level-tag">Level ${idx + 1} · ${escapeHtml(l.trackTitle)}</span>
      <h2>${escapeHtml(l.title)} ${state.progress[l.id] ? '<span class="done-mark" title="Completed">✓</span>' : ''}</h2>
      <div class="chips"><span class="badge ${l.difficulty.toLowerCase()}">${l.difficulty}</span>${l.concepts.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('')}</div>
    </div>
    <div class="prompt">${md(l.prompt)}</div>
    <div class="watch"><span>👀 What to watch</span>${md(l.watch)}</div>
    <details class="examples"><summary>Examples (${l.tests.length})</summary>
      <ul>${l.tests.map((t) => `<li><code>${escapeHtml(l.fn)}(${t.args.map(pyRepr).map(escapeHtml).join(', ')})</code> → <code>${escapeHtml(pyRepr(t.expected))}</code></li>`).join('')}</ul>
    </details>
    <div class="level-nav">
      <button class="btn ghost small" id="prevLevel" ${idx === 0 ? 'disabled' : ''}>← Previous</button>
      <button class="btn ghost small" id="nextLevel" ${idx === LEVELS.length - 1 ? 'disabled' : ''}>Next →</button>
    </div>`;
  $('prevLevel').onclick = () => openLevel(LEVELS[idx - 1].id);
  $('nextLevel').onclick = () => openLevel(LEVELS[idx + 1].id);
}

function openLevel(id) {
  const level = LEVELS.find((l) => l.id === id) || LEVELS[0];
  state.level = level;
  store.set('codeblocks-last-level', level.id);
  editor.value = store.get(`codeblocks-draft:${level.id}`, level.starter);
  editor.setErrorLine(null);
  renderBrief();
  renderTracks($('levelSearch').value);
  clearRun();
  $('testPane').innerHTML = '<p class="muted">Press ✓ Check to run the tests.</p>';
  if (location.hash !== `#${level.id}`) history.replaceState(null, '', `#${level.id}`);
}

function openExample(i) {
  state.example = i;
  editor.value = EXAMPLES[i].code;
  store.set('codeblocks-playground', editor.value);
  renderExamples();
  clearRun();
}

function setMode(mode) {
  stop();
  state.mode = mode;
  document.querySelectorAll('.mode-tab').forEach((t) => { const on = t.dataset.mode === mode; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
  $('levelBrowser').hidden = mode !== 'levels';
  $('playgroundBrowser').hidden = mode !== 'playground';
  if (mode === 'levels') openLevel(state.level ? state.level.id : store.get('codeblocks-last-level', LEVELS[0].id));
  else {
    renderBrief();
    renderExamples();
    editor.value = store.get('codeblocks-playground', EXAMPLES[0].code);
    clearRun();
    history.replaceState(null, '', '#playground');
  }
}

// ------------------------------------------------------------- running
function clearRun() {
  stop();
  state.steps = [];
  state.idx = 0;
  editor.setRunLine(null);
  $('scrubber').max = 0;
  $('scrubber').value = 0;
  $('stepCount').textContent = '0 / 0';
  $('outPane').textContent = '';
  $('fetchText').textContent = 'Press ▶ Visualize to run your program';
  $('decodeText').textContent = '—';
  $('execText').textContent = '—';
  $('hud').textContent = '';
  $('viewportMsg').hidden = false;
  if (state.scene) state.scene.render({ frames: [], slots: [], values: [], cells: [], objects: [], arrows: [], markers: [], cursors: [], bounds: { minX: 0, maxX: 20, minY: -6, maxY: 2 } }, { duration: 250 });
}

async function visualize(source = editor.value) {
  stop();
  setBusy(true);
  editor.setErrorLine(null);
  try {
    const result = await runTrace(source, 1500);
    state.lines = source.split('\n');
    state.steps = result.steps;
    state.ctx = { tokens: new TokenBook(), pointers: result.pointers };
    state.outAt = [];
    let acc = '';
    for (const s of state.steps) { acc += s.out || ''; state.outAt.push(acc); }
    showConsole('out');
    if (result.error && result.error.type === 'SyntaxError') {
      editor.setErrorLine(result.error.line);
      $('outPane').innerHTML = `<span class="err">SyntaxError on line ${result.error.line}: ${escapeHtml(result.error.message)}</span>`;
      $('fetchText').textContent = `line ${result.error.line}`;
      $('decodeText').innerHTML = '<span class="op op-ERROR">ERROR</span> Python could not understand this line';
      return;
    }
    if (!state.steps.length) { $('outPane').textContent = '(nothing to run)'; return; }
    if (result.truncated) toast(`Stopped after ${state.steps.length} steps — is there an infinite loop?`, 'warn');
    if (result.error) editor.setErrorLine(result.error.line);
    $('viewportMsg').hidden = true;
    $('scrubber').max = state.steps.length - 1;
    show(0, 0);
    play();
  } catch (err) {
    console.error(err);
    toast('Python is not available yet: ' + err.message, 'error');
  } finally {
    setBusy(false);
  }
}

function setBusy(on) {
  $('runBtn').disabled = on;
  $('checkBtn').disabled = on;
  $('runBtn').textContent = on ? '… Running' : '▶ Visualize';
}

function show(idx, duration) {
  const steps = state.steps;
  if (!steps.length) return;
  idx = Math.max(0, Math.min(steps.length - 1, idx));
  state.idx = idx;
  const step = steps[idx];
  const prev = idx > 0 ? steps[idx - 1] : null;
  const spec = layoutStep(step, state.ctx);
  if (state.scene) state.scene.render(spec, { duration: duration ?? stepDuration() });

  editor.setRunLine(step.line);
  const src = (state.lines[step.line - 1] || '').trim();
  $('fetchText').innerHTML = `<span class="ln">line ${step.line}</span> ${escapeHtml(src || '(end)')}`;
  const ops = decodeStep(step, prev, state.lines);
  $('decodeText').innerHTML = ops.slice(0, 4).map((o) => `<div><span class="op op-${o.op.replace(/\W/g, '')}">${o.op}</span> ${escapeHtml(o.text)}</div>`).join('');
  const changed = spec.values.length;
  $('execText').innerHTML = step.event === 'error' ? '<span class="err">program stopped</span>'
    : step.event === 'call' ? 'frame pushed ↑' : step.event === 'return' ? 'frame popped ↓'
    : `${ops[0].op === 'EVAL' ? 'no change' : 'memory updated'} · ${changed} block${changed === 1 ? '' : 's'}`;
  ['cpuFetch', 'cpuDecode', 'cpuExec'].forEach((id, i) => {
    const el = $(id);
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.style.animationDelay = `${i * 90}ms`;
    el.classList.add('pulse');
  });

  const out = state.outAt[idx];
  $('outPane').innerHTML = escapeHtml(out) + (step.event === 'error' ? `<span class="err">${escapeHtml(`${step.error.type}: ${step.error.message} (line ${step.error.line})`)}</span>` : '');
  $('outPane').scrollTop = $('outPane').scrollHeight;
  $('scrubber').value = idx;
  $('stepCount').textContent = `${idx + 1} / ${steps.length}`;
  const heapCount = Object.keys(step.heap).length;
  $('hud').innerHTML = `<span>stack depth <b>${step.frames.length}</b></span><span>objects on heap <b>${heapCount}</b></span><span>${step.event === 'call' ? 'calling' : step.event === 'return' ? 'returning' : 'running'} <b>${escapeHtml(step.frames[step.frames.length - 1].name)}</b></span>`;
}

function stepInterval() { return 1100 / state.speed; }
function stepDuration() { return Math.min(650, stepInterval() * 0.7); }

function play() {
  if (!state.steps.length) return;
  if (state.idx >= state.steps.length - 1) show(0, 200);
  state.playing = true;
  $('playBtn').textContent = '❚❚';
  $('playBtn').setAttribute('aria-label', 'Pause');
  const tick = () => {
    if (!state.playing) return;
    if (state.idx >= state.steps.length - 1) { stop(); return; }
    show(state.idx + 1);
    state.timer = setTimeout(tick, stepInterval());
  };
  state.timer = setTimeout(tick, stepInterval());
}

function stop() {
  state.playing = false;
  clearTimeout(state.timer);
  $('playBtn').textContent = '▶';
  $('playBtn').setAttribute('aria-label', 'Play');
}

// ------------------------------------------------------------- tests
async function check() {
  const l = state.level;
  if (!l) return;
  setBusy(true);
  showConsole('tests');
  $('testPane').innerHTML = '<p class="muted">Running tests…</p>';
  try {
    const res = await runTests(editor.value, { fn: l.fn, tests: l.tests, compare: l.compare, inplace: l.inplace, pure: l.pure, argTypes: l.argTypes, returnType: l.returnType });
    if (res.error) {
      $('testPane').innerHTML = `<p class="err">${escapeHtml(res.error)}</p>`;
      return;
    }
    const allOk = res.passed === res.total;
    $('testPane').innerHTML = `<p class="test-summary ${allOk ? 'ok' : 'bad'}">${allOk ? '🎉' : '✗'} ${res.passed} / ${res.total} tests passed</p>
      <ul class="test-list">${res.results.map((r) => `
        <li class="${r.ok ? 'ok' : 'bad'}"><span class="mark">${r.ok ? '✓' : '✗'}</span>
          <code>${escapeHtml(l.fn)}(${r.args.map(pyRepr).map(escapeHtml).join(', ')})</code>
          ${r.ok ? '' : `<div class="detail">expected <code>${escapeHtml(pyRepr(r.expected))}</code>, got <code>${escapeHtml(r.error || pyRepr(r.got))}</code>${r.note ? ` — ${escapeHtml(r.note)}` : ''}</div>`}
        </li>`).join('')}</ul>`;
    if (allOk && !state.progress[l.id]) {
      state.progress[l.id] = true;
      store.set('codeblocks-progress', state.progress);
      renderTracks($('levelSearch').value);
      renderBrief();
      toast(`Level complete: ${l.title}!`, 'success');
    }
  } catch (err) {
    $('testPane').innerHTML = `<p class="err">${escapeHtml(err.message)}</p>`;
  } finally {
    setBusy(false);
  }
}

function showConsole(pane) {
  document.querySelectorAll('.console-tab').forEach((t) => t.classList.toggle('active', t.dataset.pane === pane));
  $('outPane').hidden = pane !== 'out';
  $('testPane').hidden = pane !== 'tests';
}

// ------------------------------------------------------------- wiring
$('runBtn').onclick = () => visualize();
$('checkBtn').onclick = () => check();
$('demoBtn').onclick = () => {
  if (!state.level) return;
  if (editor.value !== state.level.solution && !confirm('Replace your code with the reference solution? (Your draft is lost unless you copy it first.)')) return;
  editor.value = state.level.solution;
  store.set(`codeblocks-draft:${state.level.id}`, editor.value);
  visualize();
};
$('resetBtn').onclick = () => {
  if (!state.level || !confirm('Reset to the starter code?')) return;
  editor.value = state.level.starter;
  store.set(`codeblocks-draft:${state.level.id}`, editor.value);
  clearRun();
};
$('playBtn').onclick = () => (state.playing ? stop() : play());
$('prevBtn').onclick = () => { stop(); show(state.idx - 1); };
$('nextBtn').onclick = () => { stop(); show(state.idx + 1); };
$('firstBtn').onclick = () => { stop(); show(0); };
$('lastBtn').onclick = () => { stop(); show(state.steps.length - 1); };
$('scrubber').oninput = (e) => { stop(); show(+e.target.value, 160); };
$('speedSel').onchange = (e) => { state.speed = +e.target.value; };
$('recenterBtn').onclick = () => { state.scene?.recenter(); $('recenterBtn').hidden = true; };
$('levelSearch').oninput = (e) => renderTracks(e.target.value);
$('trackList').onclick = (e) => { const b = e.target.closest('.level-item'); if (b) openLevel(b.dataset.id); };
$('exampleList').onclick = (e) => { const b = e.target.closest('.example-item'); if (b) openExample(+b.dataset.i); };
document.querySelectorAll('.mode-tab').forEach((t) => { t.onclick = () => setMode(t.dataset.mode); });
document.querySelectorAll('.console-tab').forEach((t) => { t.onclick = () => showConsole(t.dataset.pane); });
$('themeBtn').onclick = () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('codeart-theme', next); } catch { /* ignore */ }
  state.scene?.setTheme(next);
};
document.addEventListener('keydown', (e) => {
  if (e.target.closest('textarea, input, select')) return;
  if (e.key === ' ') { e.preventDefault(); state.playing ? stop() : play(); }
  else if (e.key === 'ArrowRight') { stop(); show(state.idx + 1); }
  else if (e.key === 'ArrowLeft') { stop(); show(state.idx - 1); }
});

// ------------------------------------------------------------- boot
initScene();
const hash = location.hash.slice(1);
if (hash === 'playground') setMode('playground');
else {
  state.level = LEVELS.find((l) => l.id === hash) || LEVELS.find((l) => l.id === store.get('codeblocks-last-level', '')) || LEVELS[0];
  setMode('levels');
}
