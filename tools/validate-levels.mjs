// Validates every level in levels/index.js:
//   * schema: unique ids, required fields, known option values
//   * every solution passes every test, and at least one is tagged best-time
//   * the starter code is not already a solution (at least one test fails)
//   * starter and every solution trace cleanly and lay out in the 3D model
// Requires python3 on PATH. Usage: node codeart-fun/tools/validate-levels.mjs [level-id ...]
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS, TRACKS, programFor, rankedSolutions } from '../levels/index.js';
import { checkTrace, trace } from './test-model.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2);

const REQUIRED = ['id', 'title', 'difficulty', 'concepts', 'prompt', 'watch', 'fn', 'starter', 'demo', 'solutions', 'tests'];
const SOLUTION_REQUIRED = ['name', 'tags', 'time', 'space', 'idea', 'code'];
const DIFFICULTIES = new Set(['Intro', 'Easy', 'Medium', 'Hard']);
const COMPARES = new Set([undefined, 'exact', 'unordered', 'unordered_nested', 'float']);
const ARG_TYPES = new Set([null, undefined, 'linked', 'tree']);
const TAGS = new Set(['time', 'space', 'brute']);

function runTests(source, level) {
  const spec = { fn: level.fn, tests: level.tests, compare: level.compare, inplace: level.inplace, pure: level.pure, argTypes: level.argTypes, returnType: level.returnType };
  const out = execFileSync('python3', [join(here, 'trace-cli.py'), 'test'], { input: JSON.stringify({ source, spec }), maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out.toString());
}

const ids = new Set();
let failures = 0;
let solutionCount = 0;
const fail = (level, msg) => { failures++; console.log(`  ✗ ${level.id}: ${msg}`); };

for (const track of TRACKS) {
  if (!track.id || !track.title || !Array.isArray(track.levels)) { console.log(`✗ track ${track.id} is missing id/title/levels`); failures++; }
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
  if (!level.starter.includes(level.demo)) fail(level, 'starter does not end with the demo call');
  if (level.prelude && !level.starter.startsWith(level.prelude)) fail(level, 'starter does not begin with the prelude');
  if (!Array.isArray(level.solutions) || !level.solutions.length) { fail(level, 'needs at least one solution'); continue; }
  if (!level.solutions.some((s) => s.tags.includes('time'))) fail(level, 'no solution is tagged best-time');

  const starter = runTests(level.starter, level);
  if (!starter.error && starter.passed === starter.total) fail(level, 'starter already passes every test');
  const st = trace(level.starter);
  if (st.error && st.error.type === 'SyntaxError') fail(level, `starter has a syntax error on line ${st.error.line}`);
  checkTrace(level.id, level.starter, st).slice(0, 3).forEach((p) => fail(level, `starter layout: ${p}`));

  rankedSolutions(level).forEach((sol, rank) => {
    solutionCount++;
    const label = `solution "${sol.name}"`;
    for (const key of SOLUTION_REQUIRED) if (sol[key] === undefined || sol[key] === '') fail(level, `${label} missing "${key}"`);
    for (const t of sol.tags || []) if (!TAGS.has(t)) fail(level, `${label} has unknown tag ${t}`);
    if (!new RegExp(`def ${level.fn}\\(`).test(sol.code)) fail(level, `${label} does not define ${level.fn}()`);
    const program = programFor(level, sol);
    const res = runTests(program, level);
    if (res.error || res.passed !== res.total) fail(level, `${label} fails: ${res.error || JSON.stringify(res.results.filter((r) => !r.ok))}`);
    const t = trace(program);
    if (t.error) fail(level, `${label} trace error: ${JSON.stringify(t.error)}`);
    if (rank === 0 && (t.truncated || t.steps.length > 400)) fail(level, `${label} demo takes ${t.steps.length} steps — use a smaller example`);
    checkTrace(level.id, program, t).slice(0, 3).forEach((p) => fail(level, `${label} layout: ${p}`));
  });
  if (failures === before) console.log(`  ✓ ${level.id} (${level.solutions.length} solutions)`);
}

console.log(`\n${LEVELS.length} levels, ${solutionCount} solutions, ${TRACKS.length} tracks — ${failures ? `${failures} problem(s)` : 'all good'}`);
process.exit(failures ? 1 : 0);
