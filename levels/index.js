// Level registry. To add a level, append it to the right track file (or add a
// new track file and list it here), then run:
//   node visualizer/tools/validate-levels.mjs
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
