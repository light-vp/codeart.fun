# CodeArt Blocks

Write Python and watch it run as 3D blocks: variables, lists, dicts, objects and
the call stack, one executed line at a time.

Open `visualizer/index.html` through any static server (ES modules don't load
from `file://`), e.g. `npx http-server .` from the repo root, then visit
`/visualizer/`.

## How it works

```
your code ──► py/tracer.py (in Pyodide) ──► steps[] ──► js/model.js ──► js/scene.js (Three.js)
              sys.settrace, one snapshot      JSON        layout + FETCH/DECODE text   animated blocks
              per executed line
```

1. **Trace.** `tracer.py` runs the program under `sys.settrace` and records a
   snapshot after every line: the stack frames, every reachable heap object,
   the branch taken by `if`/`while`/`for`, the loop cursor position and any
   output. Step and opcode budgets stop infinite loops.
2. **Model.** `model.js` turns a snapshot into a scene description (frames,
   value cubes, list cells, arrows, index pointers such as `i`, `left` or `mid`,
   and loop cursors) and decodes what changed (`APPEND`, `SWAP`, `INSERT`,
   `LINK`, `CALL`, …). It has no DOM or Three.js dependency, so Node can test it.
3. **Scene.** `scene.js` reconciles each description by key. Blocks that
   persist glide to their new position, new blocks drop or fly in, and removed
   blocks lift out. Rewinding just reconciles to an earlier step.

| Python concept | Block |
| --- | --- |
| variable | name plate on a stack frame + value cube (or a socket with an arrow) |
| int / float / str / bool / None | coloured cube labelled with the value |
| list / tuple / str / set / deque | row of indexed cells on the heap |
| list of lists | grid (unless rows are shared, in which case arrows show the aliasing) |
| dict | rows of key cube → value cube |
| class instance | card of `.field` rows; references become arrows (linked lists, trees) |
| function call | new frame stacked on top; `return` pops it |
| `for x in seq` | yellow cursor walking the cells |
| `seq[i]` | coloured pointer under cell `i` |

## Adding levels (the 200-question plan)

Levels are plain data in `levels/NN-track.js`. Each track exports
`{ id, title, blurb, levels: [...] }` and is listed in `levels/index.js`.

```js
{
  id: 'two-sum',               // unique, used in the URL hash
  title: 'Two Sum',
  difficulty: 'Easy',          // Intro | Easy | Medium | Hard
  concepts: ['dict'],
  prompt: 'Markdown-lite: `code`, **bold**, *italic*, blank line = paragraph',
  watch: 'What to look for in the animation',
  fn: 'two_sum',               // function the tests call
  starter: `...`,              // keep a small example call at the bottom
  solution: `...`,             // reference solution, used by "Watch solution"
  tests: [{ args: [[2, 7, 11, 15], 9], expected: [0, 1] }],
  // optional:
  compare: 'unordered' | 'unordered_nested' | 'float',
  inplace: 0,                  // compare args[0] after the call instead of the return value
  pure: true,                  // fail if the inputs were mutated
  argTypes: ['linked', 'tree'],// build ListNode / TreeNode from JSON lists
  returnType: 'linked' | 'tree',
}
```

Then validate:

```sh
node visualizer/tools/validate-levels.mjs        # all levels
node visualizer/tools/validate-levels.mjs two-sum # just one
node visualizer/tools/test-model.mjs --verbose   # model smoke test with decoded steps
```

The validator checks the schema, that the solution passes every test, that the
starter does not, and that both trace and lay out without problems. It needs
`python3` (3.11+).

## Dependencies

Three.js 0.160 and Pyodide 0.26 load from `cdn.jsdelivr.net`. There is no build
step. The whole `visualizer/` folder is self-contained and can move to its own
repo unchanged.
