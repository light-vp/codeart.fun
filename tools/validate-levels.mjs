// Validates every level in levels/index.js:
//   * schema: unique ids, required fields, known option values
//   * the reference solution passes every test
//   * the starter code is not already a solution (at least one test fails)
//   * starter and solution both trace cleanly and lay out in the 3D model
// Requires python3 on PATH. Usage: node visualizer/tools/validate-levels.mjs [level-id ...]
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS, TRACKS } from '../levels/index.js';
import { checkTrace, trace } from './test-model.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2);

const REQUIRED = ['id', 'title', 'difficulty', 'concepts', 'prompt', 'watch', 'fn', 'starter', 'solution', 'tests'];
const DIFFICULTIES = new Set(['Intro', 'Easy', 'Medium', 'Hard']);
const COMPARES = new Set([undefined, 'exact', 'unordered', 'unordered_nested', 'float']);
const ARG_TYPES = new Set([null, undefined, 'linked', 'tree']);

function runTests(source, level) {
  const spec = { fn: level.fn, tests: level.tests, compare: level.compare, inplace: level.inplace, pure: level.pure, argTypes: level.argTypes, returnType: level.returnType };
  const out = execFileSync('python3', [join(here, 'trace-cli.py'), 'test'], { input: JSON.stringify({ source, spec }), maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out.toString());
}

const ids = new Set();
let failures = 0;
const fail = (level, msg) => { failures++; console.log(`  ✗ ${level.id}: ${msg}`); };

for (const track of TRACKS) {
  if (!track.id || !track.title || !Array.isArray(track.levels)) console.log(`✗ track ${track.id} is missing id/title/levels`), failures++;
}

for (const level of LEVELS) {
  if (ids.has(level.id)) fail(level, 'duplicate id');
  ids.add(level.id);
  if (only.length && !only.includes(level.id)) continue;

  const before = failures;
  for (const key of REQUIRED) if (level[key] === undefined || level[key] === '') fail(level, `missing "${key}"`);
  if (!DIFFICULTIES.has(level.difficulty)) fail(level, `unknown difficulty ${level.difficulty}`);
  if (!COMPARES.has(level.compare)) fail(level, `unknown compare ${level.compare}`);
  for (const t of level.argTypes || []) if (!ARG_TYPES.has(t)) fail(level, `unknown argType ${t}`);
  if (!Array.isArray(level.tests) || level.tests.length < 2) fail(level, 'needs at least 2 tests');
  if (!new RegExp(`def ${level.fn}\\(`).test(level.starter)) fail(level, `starter does not define ${level.fn}()`);

  const good = runTests(level.solution, level);
  if (good.error || good.passed !== good.total) {
    fail(level, `solution fails: ${good.error || JSON.stringify(good.results.filter((r) => !r.ok))}`);
  }
  const starter = runTests(level.starter, level);
  if (!starter.error && starter.passed === starter.total) fail(level, 'starter already passes every test');

  for (const [label, src] of [['starter', level.starter], ['solution', level.solution]]) {
    const t = trace(src);
    if (label === 'solution' && !t.ok) fail(level, `solution trace failed: ${JSON.stringify(t.error)} truncated=${t.truncated}`);
    if (t.error && t.error.type === 'SyntaxError') fail(level, `${label} has a syntax error on line ${t.error.line}`);
    const problems = checkTrace(level.id, src, t);
    problems.slice(0, 3).forEach((p) => fail(level, `${label} layout: ${p}`));
    if (label === 'solution' && t.steps.length > 400) fail(level, `solution demo is ${t.steps.length} steps — use a smaller example`);
  }
  if (failures === before) console.log(`  ✓ ${level.id}`);
}

console.log(`\n${LEVELS.length} levels in ${TRACKS.length} tracks — ${failures ? `${failures} problem(s)` : 'all good'}`);
process.exit(failures ? 1 : 0);
