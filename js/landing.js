import { highlightPython } from './editor.js';
import { decodeStep, layoutStep, TokenBook } from './model.js';
import { LEVELS, TRACKS } from '../levels/index.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const progress = (() => { try { return JSON.parse(localStorage.getItem('codeart-progress')) || {}; } catch { return {}; } })();

// ---- stats + track cards come straight from the level registry
$('statLevels').textContent = LEVELS.length;
$('statSolutions').textContent = LEVELS.reduce((n, l) => n + l.solutions.length, 0);
$('trackGrid').innerHTML = TRACKS.map((t, i) => `
  <a class="track-card reveal" href="app.html#${t.levels[0].id}">
    <span class="track-num">${String(i + 1).padStart(2, '0')}</span>
    <span class="arrow" aria-hidden="true">↗</span>
    <h3>${esc(t.title)}</h3>
    <p>${esc(t.blurb)}</p>
    <div class="track-meta"><span class="track-pips">${t.levels.map((l) => `<i class="${progress[l.id] ? 'done' : ''}"></i>`).join('')}</span>${t.levels.length} levels</div>
  </a>`).join('');

// ---- nav border + scroll reveals
const nav = document.querySelector('.nav');
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 8), { passive: true });
const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.25 });
document.querySelectorAll('.reveal, .compare, .cycle li, .section-head').forEach((el) => { if (!el.classList.contains('compare')) el.classList.add('reveal'); io.observe(el); });

// ---- theme
$('themeBtn').onclick = () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('codeart-theme', next); } catch { /* ignore */ }
  hero.scene?.setTheme(next);
};

// ---- hero: replay a pre-recorded trace on loop
const hero = { scene: null };
async function startHero() {
  const data = await fetch(new URL('../data/hero-trace.json', import.meta.url)).then((r) => r.json());
  const lines = data.source.trimEnd().split('\n');
  $('heroCode').innerHTML = highlightPython(data.source.trimEnd()).split('\n').filter((_, i) => i < lines.length)
    .map((html, i) => `<span class="ln" data-line="${i + 1}"><b>${i + 1}</b>${html || ' '}</span>`).join('');

  if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  const { BlockScene } = await import('./scene.js');
  hero.scene = new BlockScene($('heroStage'), { interactive: false });
  hero.scene.setTheme(document.documentElement.dataset.theme);
  const codeCard = document.querySelector('.demo-code');
  const fitHero = () => {
    const stage = $('heroStage').getBoundingClientRect();
    hero.scene.setInsets({ top: codeCard.getBoundingClientRect().bottom - stage.top + 6, bottom: 74 });
  };
  fitHero();
  new ResizeObserver(fitHero).observe($('heroStage'));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ctx = { tokens: new TokenBook(), pointers: data.pointers };
  let i = 0;
  const step = () => {
    if (i >= data.steps.length) { i = 0; ctx = { tokens: new TokenBook(), pointers: data.pointers }; }
    const s = data.steps[i];
    hero.scene.render(layoutStep(s, ctx), { duration: i === 0 ? 0 : 620 });
    document.querySelectorAll('#heroCode .ln').forEach((el) => el.classList.toggle('on', +el.dataset.line === s.line));
    const op = decodeStep(s, i ? data.steps[i - 1] : null, lines)[0];
    $('heroDecode').innerHTML = `<span class="op op-${op.op.replace(/\W/g, '')}">${op.op}</span>${esc(op.text)}`;
    i++;
    setTimeout(step, i >= data.steps.length ? 2600 : 900);
  };
  if (reduced) { i = data.steps.length - 1; step(); } else step();
}
startHero().catch((err) => {
  console.error(err);
  $('heroStage').innerHTML = '<p style="padding:24px;color:var(--muted)">The 3D demo needs WebGL.</p>';
});
