import { CodeEditor, highlightPython } from './editor.js';
import { EXAMPLES } from './examples.js';
import { decodeStep, layoutStep, TokenBook } from './model.js';
import { loadPython, test as runTests, trace as runTrace } from './runtime.js';
import { account } from './sync.js';
import { LEVELS, TIERS, TRACKS, programFor, rankedSolutions } from '../levels/index.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
};

const SPEEDS = [0.5, 1, 2, 4];
const state = {
  mode: 'levels',
  level: null,
  example: 0,
  tab: 'problem',
  viewing: null,          // { name } while a reference solution is shown in the editor
  steps: [],
  lines: [],
  outAt: [],
  idx: 0,
  playing: false,
  timer: null,
  speed: 1,
  ctx: null,
  scene: null,
  progress: store.get('codeart-progress', {}),
  revealed: store.get('codeart-revealed', {}),
  stepCache: new Map(),
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
const md = (s) => s.split(/\n\n+/).map((p) => `<p>${inline(p)}</p>`).join('');
const pyRepr = (v) => JSON.stringify(v).replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None').replace(/,(?=\S)/g, ', ').replace(/:(?=\S)/g, ': ');
const draftKey = (id) => `codeart-draft:${id}`;
const historyKey = (id) => `codeart-history:${id}`;

function toast(msg, kind = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${kind}`;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3400);
}

// ================================================================ editor
const editor = new CodeEditor($('editor'), {
  onChange: (code) => {
    if (state.viewing) return;
    if (state.mode === 'levels' && state.level) {
      store.set(draftKey(state.level.id), code);
      queueDraftUpload(state.level.id, code);
    } else store.set('codeart-playground', code);
  },
});
editor.onRun = () => visualize();

let draftTimer = null;
function queueDraftUpload(levelId, code) {
  if (!account.user) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => account.saveDraft(levelId, code).catch(() => {}), 1500);
}

// ================================================================ scene
async function initScene() {
  try {
    if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
    const { BlockScene } = await import('./scene.js');
    state.scene = new BlockScene($('viewport'));
    state.scene.setTheme(document.documentElement.dataset.theme);
    state.scene.onUserCamera = () => { $('recenterBtn').hidden = false; };
    const measure = () => {
      const stage = document.querySelector('.stage').getBoundingClientRect();
      const pipe = document.querySelector('.pipeline').getBoundingClientRect();
      const transport = document.querySelector('.transport').getBoundingClientRect();
      state.scene.setInsets({ top: pipe.bottom - stage.top + 8, bottom: stage.bottom - transport.top + 8 });
    };
    measure();
    new ResizeObserver(measure).observe(document.querySelector('.stage'));
    if (state.steps.length) show(state.idx, 0);
  } catch (err) {
    console.error(err);
    $('emptyState').innerHTML = '<h3>3D view unavailable</h3><p>Three.js could not load (it is served from cdn.jsdelivr.net) or WebGL is disabled. The step decoder above still works.</p>';
  }
}

// ================================================================ python
function setPyStatus(text, kind) {
  $('pyStatus').className = `py ${kind || ''}`;
  $('pyStatus').querySelector('span').textContent = text;
}
const pyReady = loadPython((msg) => setPyStatus(msg.replace('…', ''), 'loading'));
pyReady.then(() => { setPyStatus('Python ready', 'ready'); if (state.tab === 'solutions') measureSolutions(); })
  .catch((err) => { console.error(err); setPyStatus('Python failed to load', 'error'); });

// ================================================================ progress
function solvedCount() { return LEVELS.filter((l) => state.progress[l.id]).length; }

function renderProgress() {
  const n = solvedCount();
  $('progressText').textContent = `${n}/${LEVELS.length}`;
  $('ringFg').style.strokeDashoffset = String(94.25 * (1 - n / LEVELS.length));
}

function markSolved(id) {
  if (state.progress[id]) return false;
  state.progress[id] = true;
  store.set('codeart-progress', state.progress);
  renderProgress();
  return true;
}

// ================================================================ drawer
let kbIndex = -1;
function renderTracks() {
  const q = $('levelSearch').value.trim().toLowerCase();
  $('trackList').innerHTML = TRACKS.map((track) => {
    const levels = LEVELS.filter((l) => l.track === track.id && (!q || `${l.title} ${l.concepts.join(' ')} ${l.difficulty} ${track.title}`.toLowerCase().includes(q)));
    if (!levels.length) return '';
    const all = LEVELS.filter((l) => l.track === track.id);
    const done = all.filter((l) => state.progress[l.id]).length;
    return `<section class="track">
      <div class="track-head"><h3>${esc(track.title)}</h3><span class="bar-mini"><i style="width:${(done / all.length) * 100}%"></i></span><span>${done}/${all.length}</span></div>
      ${q ? '' : `<p>${esc(track.blurb)}</p>`}
      ${levels.map((l) => `<button class="lv ${state.level && state.level.id === l.id ? 'active' : ''} ${state.progress[l.id] ? 'done' : ''}" data-id="${l.id}">
          <span class="lv-num">${LEVELS.indexOf(l) + 1}</span>
          <span class="lv-title">${esc(l.title)}</span>
          <span class="diff ${l.difficulty.toLowerCase()}">${l.difficulty}</span>
        </button>`).join('')}
    </section>`;
  }).join('') || '<p class="empty-note">No levels match that search.</p>';
  kbIndex = -1;
}

function openDrawer() {
  if (state.mode !== 'levels') setMode('levels');
  $('drawer').hidden = false;
  $('scrim').hidden = false;
  $('levelSearch').value = '';
  renderTracks();
  setTimeout(() => {
    $('levelSearch').focus();
    $('trackList').querySelector('.lv.active')?.scrollIntoView({ block: 'center' });
  }, 0);
}
function closeDrawer() { $('drawer').hidden = true; $('scrim').hidden = true; }

function moveKb(delta) {
  const items = [...$('trackList').querySelectorAll('.lv')];
  if (!items.length) return;
  items[kbIndex]?.classList.remove('kb');
  kbIndex = (kbIndex + delta + items.length) % items.length;
  items[kbIndex].classList.add('kb');
  items[kbIndex].scrollIntoView({ block: 'nearest' });
}

// ================================================================ panels
function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  $('problemPane').hidden = tab !== 'problem';
  $('solutionsPane').hidden = tab !== 'solutions';
  $('historyPane').hidden = tab !== 'history';
  if (tab === 'solutions') renderSolutions();
  if (tab === 'history') renderHistory();
}

function renderProblem() {
  const pane = $('problemPane');
  if (state.mode === 'playground') {
    pane.innerHTML = `<div class="p-eyebrow">PLAYGROUND</div>
      <h2 class="p-title">Write anything</h2>
      <div class="prose"><p>Press <strong>Run</strong> and each executed line becomes one step: <strong>Fetch</strong> shows the line, <strong>Decode</strong> explains what it does to memory, and the table <strong>executes</strong> it.</p></div>
      <div class="examples"><h4>Start from an example</h4>
      ${EXAMPLES.map((ex, i) => `<button class="lv ${state.example === i ? 'active' : ''}" data-example="${i}"><span class="lv-num">${i + 1}</span><span class="lv-title">${esc(ex.title)}<br><span style="color:var(--muted);font-size:12px">${esc(ex.note)}</span></span><span></span></button>`).join('')}
      </div>`;
    return;
  }
  const l = state.level;
  const idx = LEVELS.indexOf(l);
  pane.innerHTML = `
    <div class="p-eyebrow"><span>${String(idx + 1).padStart(2, '0')}</span><span>·</span><span>${esc(l.trackTitle)}</span></div>
    <h2 class="p-title">${esc(l.title)}${state.progress[l.id] ? '<span class="solved" title="Solved">✓</span>' : ''}</h2>
    <div class="p-meta"><span class="diff ${l.difficulty.toLowerCase()}">${l.difficulty}</span>${l.concepts.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
    <div class="prose">${md(l.prompt)}</div>
    <div class="watch"><div class="watch-label">What to watch</div><div class="prose">${md(l.watch)}</div></div>
    <div class="examples"><h4>Examples</h4>
      ${l.tests.slice(0, 3).map((t) => `<div class="example"><span>in</span><code>${esc(l.fn)}(${t.args.map(pyRepr).map(esc).join(', ')})</code><span>out</span><code>${esc(pyRepr(t.expected))}</code></div>`).join('')}
    </div>
    <div class="level-nav">
      <button class="btn ghost" data-nav="-1" ${idx === 0 ? 'disabled' : ''}>← Previous</button>
      <button class="btn ghost" data-nav="1" ${idx === LEVELS.length - 1 ? 'disabled' : ''}>Next →</button>
    </div>`;
}

function renderSolutions() {
  const pane = $('solutionsPane');
  const l = state.level;
  if (!l) return;
  if (!state.revealed[l.id] && !state.progress[l.id]) {
    pane.innerHTML = `<div class="gate">
      <h4>Give it a go first</h4>
      <p>${l.solutions.length} approaches are ranked here, from brute force to optimal, each with its time and space cost. They unlock when you solve the level.</p>
      <button class="btn" id="revealBtn">Reveal anyway</button></div>`;
    $('revealBtn').onclick = () => { state.revealed[l.id] = true; store.set('codeart-revealed', state.revealed); renderSolutions(); };
    return;
  }
  const sols = rankedSolutions(l);
  pane.innerHTML = `<p class="sol-note">Ranked best-first. Step counts are measured on the small example — Big-O tells you how each one grows as the input does.</p>` + sols.map((s, i) => `
    <article class="sol ${s.tier}" data-sol="${s.index}">
      <div class="sol-head"><span class="sol-rank">${i + 1}</span><span class="sol-name">${esc(s.name)}</span><span class="tier ${s.tier}">${s.tier === 'optimal' ? '★ ' : ''}${TIERS[s.tier].label}</span></div>
      <div class="sol-cx"><span class="cx">time <b>${esc(s.time)}</b></span><span class="cx">space <b>${esc(s.space)}</b></span></div>
      <p class="sol-idea">${inline(s.idea)}</p>
      <div class="sol-foot">
        <span class="sol-steps" data-steps="${s.index}">measuring steps…</span>
        <button class="btn" data-animate="${s.index}"><svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>Animate</button>
        <button class="btn ghost" data-use="${s.index}">Use code</button>
      </div>
      <div class="sol-bar"><i data-bar="${s.index}"></i></div>
      <details><summary>Show code</summary><pre><code>${highlightPython(s.code.trimEnd())}</code></pre></details>
    </article>`).join('');
  measureSolutions();
}

// Trace every solution on the demo input so learners can compare the work done.
async function measureSolutions() {
  const l = state.level;
  if (!l || state.tab !== 'solutions' || $('solutionsPane').querySelector('.gate')) return;
  try { await pyReady; } catch { return; }
  const counts = [];
  for (let i = 0; i < l.solutions.length; i++) {
    const key = `${l.id}#${i}`;
    if (!state.stepCache.has(key)) {
      try {
        const r = await runTrace(programFor(l, l.solutions[i]), 3000);
        state.stepCache.set(key, { n: r.steps.length, capped: r.truncated });
      } catch { state.stepCache.set(key, { n: 0, capped: false }); }
    }
    counts.push(state.stepCache.get(key));
  }
  if (state.level !== l || state.tab !== 'solutions') return;
  const max = Math.max(1, ...counts.map((c) => c.n));
  counts.forEach((c, i) => {
    const label = $('solutionsPane').querySelector(`[data-steps="${i}"]`);
    const bar = $('solutionsPane').querySelector(`[data-bar="${i}"]`);
    if (label) label.innerHTML = `<b>${c.n}${c.capped ? '+' : ''}</b> steps on the example`;
    if (bar) requestAnimationFrame(() => { bar.style.width = `${Math.max(3, (c.n / max) * 100)}%`; });
  });
}

function historyFor(id) { return store.get(historyKey(id), []); }

async function renderHistory() {
  const pane = $('historyPane');
  const l = state.level;
  if (!l) return;
  let items = historyFor(l.id);
  let source = 'this browser';
  if (account.user) {
    pane.innerHTML = '<p class="empty-note">Loading your submissions…</p>';
    try {
      const data = await account.submissions(l.id);
      items = data.submissions.map((s) => ({ at: s.created_at, passed: s.passed, total: s.total, code: s.code }));
      source = 'your account';
    } catch { /* fall back to local */ }
    if (state.level !== l || state.tab !== 'history') return;
  }
  if (!items.length) {
    pane.innerHTML = `<p class="empty-note">No submissions yet. Press <b>Submit</b> to run the tests — every attempt is saved here${account.available && !account.user ? ', and to your account once you sign in' : ''}.</p>`;
    return;
  }
  pane.innerHTML = `<p class="empty-note" style="padding:0 0 10px;text-align:left">Saved in ${source}.</p>` + items.map((h, i) => `
    <div class="hist ${h.passed === h.total ? 'ok' : ''}">
      <span class="hist-dot"></span>
      <div class="hist-main"><b>${h.passed}/${h.total} tests passed</b><span>${esc(new Date(h.at).toLocaleString())}</span></div>
      <button class="btn ghost" data-restore="${i}">Load</button>
    </div>`).join('');
  pane.querySelectorAll('[data-restore]').forEach((b) => {
    b.onclick = () => { exitViewing(); editor.value = items[+b.dataset.restore].code; store.set(draftKey(l.id), editor.value); clearRun(); toast('Submission loaded into the editor'); };
  });
}

// ================================================================ level & mode
function openLevel(id, { keepTab = false } = {}) {
  const level = LEVELS.find((l) => l.id === id) || LEVELS[0];
  exitViewing({ restore: false });
  state.level = level;
  store.set('codeart-last-level', level.id);
  editor.value = store.get(draftKey(level.id), level.starter);
  editor.setErrorLine(null);
  $('crumbTrack').textContent = level.trackTitle;
  $('crumbTitle').textContent = level.title;
  $('solCount').textContent = level.solutions.length;
  renderProblem();
  if (!keepTab || state.tab !== 'problem') setTab('problem');
  clearRun();
  $('testPane').innerHTML = '<p class="empty-note">Press Submit to run the tests.</p>';
  $('testBadge').textContent = '';
  if (location.hash !== `#${level.id}`) history.replaceState(null, '', `#${level.id}`);
}

function setMode(mode) {
  stop();
  state.mode = mode;
  document.querySelectorAll('.seg-btn').forEach((t) => { const on = t.dataset.mode === mode; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
  const levels = mode === 'levels';
  $('levelsBtn').hidden = !levels;
  document.querySelector('.tab[data-tab="solutions"]').hidden = !levels;
  document.querySelector('.tab[data-tab="history"]').hidden = !levels;
  $('checkBtn').hidden = !levels;
  $('resetBtn').hidden = !levels;
  if (levels) {
    openLevel(state.level ? state.level.id : store.get('codeart-last-level', LEVELS[0].id));
  } else {
    exitViewing({ restore: false });
    setTab('problem');
    renderProblem();
    editor.value = store.get('codeart-playground', EXAMPLES[0].code);
    clearRun();
    history.replaceState(null, '', '#playground');
  }
}

// Show a reference solution in the editor without touching the learner's draft.
function viewSolution(index) {
  const l = state.level;
  const sol = l.solutions[index];
  state.viewing = { name: sol.name };
  editor.value = programFor(l, sol);
  editor.input.readOnly = true;
  const head = document.querySelector('.editor-head .file');
  head.innerHTML = `<i style="background:var(--accent)"></i>solution · ${esc(sol.name)}`;
  if (!$('backBtn')) {
    const back = document.createElement('button');
    back.className = 'btn ghost';
    back.id = 'backBtn';
    back.textContent = '← My code';
    back.onclick = () => { exitViewing(); clearRun(); };
    head.after(back);
  }
  visualize();
}

function exitViewing({ restore = true } = {}) {
  if (!state.viewing) return;
  state.viewing = null;
  editor.input.readOnly = false;
  document.querySelector('.editor-head .file').innerHTML = '<i></i>main.py';
  $('backBtn')?.remove();
  if (restore && state.level) editor.value = store.get(draftKey(state.level.id), state.level.starter);
}

// ================================================================ running
function clearRun() {
  stop();
  state.steps = [];
  state.idx = 0;
  editor.setRunLine(null);
  setScrub(0, 0);
  $('stepCount').textContent = '0 / 0';
  $('outPane').textContent = '';
  $('fetchText').textContent = 'waiting for a run';
  $('decodeText').textContent = '—';
  $('execText').textContent = '—';
  document.querySelectorAll('.stage-step').forEach((s) => s.classList.remove('on'));
  $('hud').textContent = '';
  $('emptyState').hidden = false;
  if (state.scene) state.scene.render({ zones: [], frames: [], slots: [], values: [], cells: [], objects: [], arrows: [], markers: [], cursors: [], bounds: { minX: 0, maxX: 22, minY: -8, maxY: 2 } }, { duration: 300 });
}

function setScrub(value, max) {
  const s = $('scrubber');
  s.max = max;
  s.value = value;
  s.style.setProperty('--p', `${max ? (value / max) * 100 : 0}%`);
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
      $('outPane').innerHTML = `<span class="err">SyntaxError on line ${result.error.line}: ${esc(result.error.message)}</span>`;
      $('fetchText').innerHTML = `<span class="ln">line ${result.error.line}</span>`;
      $('decodeText').innerHTML = '<div><span class="op op-ERROR">ERROR</span>Python could not parse this line</div>';
      return;
    }
    if (!state.steps.length) { $('outPane').textContent = '(nothing to run)'; return; }
    if (result.truncated) toast(`Stopped after ${state.steps.length} steps — is there an infinite loop?`, 'warn');
    if (result.error) editor.setErrorLine(result.error.line);
    $('emptyState').hidden = true;
    setScrub(0, state.steps.length - 1);
    show(0, 0);
    play();
  } catch (err) {
    console.error(err);
    toast(`Python isn't ready: ${err.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function setBusy(on) {
  $('runBtn').disabled = on;
  $('checkBtn').disabled = on;
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
  $('fetchText').innerHTML = `<span class="ln">${String(step.line).padStart(2, '0')}</span>${esc(src || '(end)')}`;
  const ops = decodeStep(step, prev, state.lines);
  $('decodeText').innerHTML = ops.slice(0, 3).map((o) => `<div><span class="op op-${o.op.replace(/\W/g, '')}">${o.op}</span>${esc(o.text)}</div>`).join('');
  $('execText').innerHTML = step.event === 'error' ? '<span class="err">program stopped</span>'
    : step.event === 'call' ? 'frame pushed' : step.event === 'return' ? 'frame popped'
    : ops[0].op === 'EVAL' ? 'no memory change' : 'memory updated';
  document.querySelectorAll('.stage-step').forEach((s) => s.classList.add('on'));
  const pipe = document.querySelector('.pipeline');
  pipe.classList.remove('tick'); void pipe.offsetWidth; pipe.classList.add('tick');

  const out = state.outAt[idx];
  $('outPane').innerHTML = esc(out) + (step.event === 'error' ? `<span class="err">${esc(`${step.error.type}: ${step.error.message} (line ${step.error.line})`)}</span>` : '');
  $('outPane').scrollTop = $('outPane').scrollHeight;
  setScrub(idx, steps.length - 1);
  $('stepCount').textContent = `${idx + 1} / ${steps.length}`;
  $('hud').innerHTML = `<span>stack <b>${step.frames.length}</b></span><span>heap <b>${Object.keys(step.heap).length}</b></span>`;
}

function stepInterval() { return 1150 / state.speed; }
function stepDuration() { return Math.min(700, stepInterval() * 0.72); }

const PLAY_ICON = '<path d="M5 3v10l8-5z" fill="currentColor"/>';
const PAUSE_ICON = '<rect x="4" y="3" width="3" height="10" rx="1" fill="currentColor"/><rect x="9" y="3" width="3" height="10" rx="1" fill="currentColor"/>';

function play() {
  if (!state.steps.length) return;
  if (state.idx >= state.steps.length - 1) show(0, 250);
  state.playing = true;
  $('playIcon').innerHTML = PAUSE_ICON;
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
  $('playIcon').innerHTML = PLAY_ICON;
  $('playBtn').setAttribute('aria-label', 'Play');
}

// ================================================================ tests
async function check() {
  const l = state.level;
  if (!l) return;
  if (state.viewing) exitViewing();
  setBusy(true);
  showConsole('tests');
  $('testPane').innerHTML = '<p class="empty-note">Running tests…</p>';
  const code = editor.value;
  try {
    const res = await runTests(code, { fn: l.fn, tests: l.tests, compare: l.compare, inplace: l.inplace, pure: l.pure, argTypes: l.argTypes, returnType: l.returnType });
    if (res.error) {
      $('testPane').innerHTML = `<p class="err">${esc(res.error)}</p>`;
      $('testBadge').textContent = '!';
      $('testBadge').className = 'bad';
      recordAttempt(l, code, 0, l.tests.length);
      return;
    }
    const allOk = res.passed === res.total;
    $('testBadge').textContent = `${res.passed}/${res.total}`;
    $('testBadge').className = allOk ? 'ok' : 'bad';
    $('testPane').innerHTML = `<div class="t-summary ${allOk ? 'ok' : 'bad'}">${allOk ? 'All tests passed' : `${res.passed} of ${res.total} tests passed`}</div>
      <ul class="t-list">${res.results.map((r) => `
        <li class="${r.ok ? 'ok' : 'bad'}"><span class="m">${r.ok ? '✓' : '✗'}</span><code>${esc(l.fn)}(${r.args.map(pyRepr).map(esc).join(', ')})</code>
          ${r.ok ? '' : `<div class="detail">expected <code>${esc(pyRepr(r.expected))}</code>, got <code>${esc(r.error || pyRepr(r.got))}</code>${r.note ? ` — ${esc(r.note)}` : ''}</div>`}
        </li>`).join('')}</ul>`;
    recordAttempt(l, code, res.passed, res.total);
    if (allOk && markSolved(l.id)) {
      renderProblem();
      toast(`Solved: ${l.title}. Solutions unlocked.`, 'success');
    }
  } catch (err) {
    $('testPane').innerHTML = `<p class="err">${esc(err.message)}</p>`;
  } finally {
    setBusy(false);
  }
}

function recordAttempt(level, code, passed, total) {
  const items = historyFor(level.id);
  items.unshift({ at: new Date().toISOString(), passed, total, code });
  store.set(historyKey(level.id), items.slice(0, 20));
  if (account.user) account.submit(level.id, code, passed, total).catch((e) => console.warn('submit sync failed', e));
  if (state.tab === 'history') renderHistory();
}

function showConsole(pane) {
  document.querySelectorAll('.ctab').forEach((t) => t.classList.toggle('active', t.dataset.pane === pane));
  $('outPane').hidden = pane !== 'out';
  $('testPane').hidden = pane !== 'tests';
}

// ================================================================ account
let authMode = 'login';
function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('.auth-tab').forEach((t) => t.classList.toggle('active', t.dataset.auth === mode));
  $('nameField').hidden = mode !== 'register';
  $('authTitle').textContent = mode === 'login' ? 'Welcome back' : 'Create your account';
  $('authSub').textContent = mode === 'login' ? 'Sign in to save your solutions and progress across devices.' : 'Free forever. Your local progress comes with you.';
  $('authSubmit').textContent = mode === 'login' ? 'Sign in' : 'Create account';
  $('authForm').password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('authError').textContent = '';
}

function renderAccount() {
  const btn = $('accountBtn');
  if (!account.available) { btn.hidden = true; return; }
  btn.hidden = false;
  if (account.user) {
    btn.className = 'avatar';
    btn.textContent = (account.user.name || account.user.email).trim()[0].toUpperCase();
    btn.title = account.user.email;
  } else {
    btn.className = 'btn';
    btn.textContent = 'Sign in';
    btn.title = '';
  }
}

async function afterSignIn() {
  const drafts = {};
  for (const l of LEVELS) {
    const d = store.get(draftKey(l.id), null);
    if (d && d !== l.starter) drafts[l.id] = d;
  }
  try {
    const merged = await account.sync(LEVELS.filter((l) => state.progress[l.id]).map((l) => l.id), drafts);
    applyServerState(merged);
  } catch (e) { console.warn('sync failed', e); }
}

function applyServerState(data) {
  for (const [id, p] of Object.entries(data.progress || {})) if (p.solved) state.progress[id] = true;
  store.set('codeart-progress', state.progress);
  for (const [id, code] of Object.entries(data.drafts || {})) {
    if (!store.get(draftKey(id), null)) store.set(draftKey(id), code);
  }
  renderProgress();
  if (state.mode === 'levels') renderProblem();
}

function openMenu() {
  const menu = document.createElement('div');
  menu.className = 'menu';
  const r = $('accountBtn').getBoundingClientRect();
  menu.style.top = `${r.bottom + 8}px`;
  menu.style.right = `${window.innerWidth - r.right}px`;
  menu.innerHTML = `<div class="menu-head"><b>${esc(account.user.name || 'Coder')}</b><span>${esc(account.user.email)}</span></div>
    <div class="menu-head" style="border:0;padding-top:6px"><span>${solvedCount()} of ${LEVELS.length} levels solved · synced</span></div>
    <button id="logoutBtn">Sign out</button>`;
  document.body.appendChild(menu);
  const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
  setTimeout(() => document.addEventListener('mousedown', close), 0);
  menu.querySelector('#logoutBtn').onclick = async () => { menu.remove(); await account.logout(); toast('Signed out. Progress stays in this browser.'); };
}

$('accountBtn').onclick = () => {
  if (account.user) { openMenu(); return; }
  setAuthMode('login');
  $('authDialog').showModal();
};
document.querySelectorAll('.auth-tab').forEach((t) => { t.onclick = () => setAuthMode(t.dataset.auth); });
$('authCancel').onclick = () => $('authDialog').close();
$('authForm').onsubmit = async (e) => {
  e.preventDefault();
  const f = $('authForm');
  const email = f.email.value.trim(), password = f.password.value, name = f.name.value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) { $('authError').textContent = 'Enter a valid email address.'; return; }
  if (password.length < 8) { $('authError').textContent = 'Passwords need at least 8 characters.'; return; }
  $('authSubmit').disabled = true;
  try {
    if (authMode === 'login') await account.login(email, password);
    else await account.register(name || email.split('@')[0], email, password);
    $('authDialog').close();
    f.reset();
    await afterSignIn();
    toast(`Signed in as ${account.user.name || account.user.email}`, 'success');
  } catch (err) {
    $('authError').textContent = err.message;
  } finally {
    $('authSubmit').disabled = false;
  }
};
account.onChange(renderAccount);

// ================================================================ wiring
$('runBtn').onclick = () => visualize();
$('checkBtn').onclick = () => check();
$('resetBtn').onclick = () => {
  if (!state.level) return;
  if (state.viewing) { exitViewing(); clearRun(); return; }
  if (editor.value !== state.level.starter && !confirm('Reset to the starter code? Your current draft will be replaced.')) return;
  editor.value = state.level.starter;
  store.set(draftKey(state.level.id), editor.value);
  clearRun();
};
$('playBtn').onclick = () => (state.playing ? stop() : play());
$('prevBtn').onclick = () => { stop(); show(state.idx - 1); };
$('nextBtn').onclick = () => { stop(); show(state.idx + 1); };
$('firstBtn').onclick = () => { stop(); show(0); };
$('lastBtn').onclick = () => { stop(); show(state.steps.length - 1); };
$('scrubber').oninput = (e) => { stop(); show(+e.target.value, 180); };
$('speedBtn').onclick = () => {
  state.speed = SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length];
  $('speedBtn').textContent = `${state.speed}×`;
};
$('recenterBtn').onclick = () => { state.scene?.recenter(); $('recenterBtn').hidden = true; };
$('levelsBtn').onclick = openDrawer;
$('scrim').onclick = closeDrawer;
$('levelSearch').oninput = renderTracks;
$('levelSearch').onkeydown = (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moveKb(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveKb(-1); }
  else if (e.key === 'Enter') {
    const target = $('trackList').querySelector('.lv.kb') || $('trackList').querySelector('.lv');
    if (target) { openLevel(target.dataset.id); closeDrawer(); }
  }
};
$('trackList').onclick = (e) => { const b = e.target.closest('.lv'); if (b) { openLevel(b.dataset.id); closeDrawer(); } };
$('problemPane').onclick = (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) { openLevel(LEVELS[LEVELS.indexOf(state.level) + Number(nav.dataset.nav)].id); return; }
  const ex = e.target.closest('[data-example]');
  if (ex) {
    state.example = +ex.dataset.example;
    editor.value = EXAMPLES[state.example].code;
    store.set('codeart-playground', editor.value);
    renderProblem();
    visualize();
  }
};
$('solutionsPane').onclick = (e) => {
  const anim = e.target.closest('[data-animate]');
  if (anim) { viewSolution(+anim.dataset.animate); return; }
  const use = e.target.closest('[data-use]');
  if (use) {
    const l = state.level;
    if (!confirm('Replace your draft with this solution?')) return;
    exitViewing({ restore: false });
    editor.value = programFor(l, l.solutions[+use.dataset.use]);
    store.set(draftKey(l.id), editor.value);
    queueDraftUpload(l.id, editor.value);
    clearRun();
    toast('Solution copied into your editor');
  }
};
document.querySelectorAll('.seg-btn').forEach((t) => { t.onclick = () => setMode(t.dataset.mode); });
document.querySelectorAll('.tab').forEach((t) => { t.onclick = () => setTab(t.dataset.tab); });
document.querySelectorAll('.ctab').forEach((t) => { t.onclick = () => showConsole(t.dataset.pane); });
$('themeBtn').onclick = () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('codeart-theme', next); } catch { /* ignore */ }
  state.scene?.setTheme(next);
};
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('drawer').hidden ? openDrawer() : closeDrawer(); return; }
  if (e.key === 'Escape' && !$('drawer').hidden) { closeDrawer(); return; }
  if (e.target.closest('textarea, input, select, dialog')) return;
  if (e.key === ' ') { e.preventDefault(); state.playing ? stop() : play(); }
  else if (e.key === 'ArrowRight') { stop(); show(state.idx + 1); }
  else if (e.key === 'ArrowLeft') { stop(); show(state.idx - 1); }
});

addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (id === 'playground') { if (state.mode !== 'playground') setMode('playground'); return; }
  const level = LEVELS.find((l) => l.id === id);
  if (level && level !== state.level) { if (state.mode !== 'levels') { state.level = level; setMode('levels'); } else openLevel(level.id); }
});

// ================================================================ boot
renderProgress();
initScene();
const hash = location.hash.slice(1);
if (hash === 'playground') setMode('playground');
else {
  state.level = LEVELS.find((l) => l.id === hash) || LEVELS.find((l) => l.id === store.get('codeart-last-level', '')) || LEVELS[0];
  setMode('levels');
}
account.init().then(async () => {
  if (!account.user) return;
  try { applyServerState(await account.progress()); } catch { /* offline */ }
});
