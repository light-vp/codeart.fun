// Level registry. To add a level, append it to the right track file (or add a
// new track file and list it here), then run:
//   node codeart-fun/tools/validate-levels.mjs
import foundations from './01-foundations.js';
import arrays from './02-arrays.js';
import hashing from './03-hashing.js';
import stacks from './04-stacks.js';
import searchSort from './05-search-sort.js';
import linkedLists from './06-linked-lists.js';
import trees from './07-trees.js';
import dp from './08-dynamic-programming.js';

export const TRACKS = [foundations, arrays, hashing, stacks, searchSort, linkedLists, trees, dp];

export const LEVELS = TRACKS.flatMap((track) => track.levels.map((level) => ({ ...level, track: track.id, trackTitle: track.title })));

// Solution tiers. A solution may carry several tags; "time" + "space" = optimal.
export const TIERS = {
  optimal: { label: 'Optimal', rank: 0 },
  time: { label: 'Best time', rank: 1 },
  space: { label: 'Best space', rank: 2 },
  alt: { label: 'Alternative', rank: 3 },
  brute: { label: 'Brute force', rank: 4 },
};

export function tierOf(solution) {
  const t = new Set(solution.tags);
  if (t.has('time') && t.has('space')) return 'optimal';
  if (t.has('time')) return 'time';
  if (t.has('brute')) return 'brute';
  if (t.has('space')) return 'space';
  return 'alt';
}

/** Solutions ordered best-first (stable within a tier). */
export function rankedSolutions(level) {
  return level.solutions
    .map((s, i) => ({ ...s, tier: tierOf(s), index: i }))
    .sort((a, b) => TIERS[a.tier].rank - TIERS[b.tier].rank || a.index - b.index);
}

/** A runnable program for a solution: shared prelude + function + the demo call. */
export function programFor(level, solution) {
  return `${level.prelude || ''}${solution.code.trimEnd()}\n\n${level.demo}\n`;
}
