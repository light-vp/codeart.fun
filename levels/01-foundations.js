export default {
  id: 'foundations',
  title: 'Memory Basics',
  blurb: 'Variables, lists, loops, dicts and the call stack — the moving parts every program is built from.',
  levels: [
    {
      id: 'swap-values',
      title: 'Swap Two Boxes',
      difficulty: 'Intro',
      concepts: ['variables', 'assignment'],
      prompt: 'A variable is a **name tag** stuck on a value in memory. Write `swap(a, b)` that returns the two values in the opposite order: `(b, a)`.\n\nDo it the old-school way first, with a third variable `temp`, and watch the value blocks change hands.',
      watch: 'Each assignment re-labels a block. `temp` keeps a copy of `a` safe while `a` gets overwritten.',
      fn: 'swap',
      demo: 'print(swap(1, 2))',
      starter: `def swap(a, b):
    temp = a
    # move b into a, then temp into b
    return a, b

print(swap(1, 2))
`,
      solutions: [
        {
          name: 'Tuple unpacking',
          tags: ['time', 'space'],
          time: 'O(1)', space: 'O(1)',
          idea: 'Python builds the tuple `(b, a)` on the right first, then unpacks it — no temporary name needed.',
          code: `def swap(a, b):
    a, b = b, a
    return a, b
`,
        },
        {
          name: 'Temporary variable',
          tags: ['time', 'space'],
          time: 'O(1)', space: 'O(1)',
          idea: 'The classic three-step swap used in every language: park `a` in `temp`, overwrite `a`, then restore into `b`.',
          code: `def swap(a, b):
    temp = a
    a = b
    b = temp
    return a, b
`,
        },
      ],
      tests: [
        { args: [1, 2], expected: [2, 1] },
        { args: ['x', 'y'], expected: ['y', 'x'] },
        { args: [5, 5], expected: [5, 5] },
      ],
    },
    {
      id: 'build-squares',
      title: 'Grow a List',
      difficulty: 'Intro',
      concepts: ['list', 'append', 'for loop'],
      prompt: 'Return a list of the first `n` square numbers: `squares(4)` → `[1, 4, 9, 16]`.\n\nStart with an empty list and `append` one block per loop iteration.',
      watch: 'Every `append` slides a new block onto the end of the list. The list object stays the same; only its contents grow.',
      fn: 'squares',
      demo: 'print(squares(4))',
      starter: `def squares(n):
    result = []
    for i in range(1, n + 1):
        pass  # append i * i
    return result

print(squares(4))
`,
      solutions: [
        {
          name: 'Append in a loop',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(n)',
          idea: 'One multiplication and one append per number. The output itself needs O(n) space, so this is optimal.',
          code: `def squares(n):
    result = []
    for i in range(1, n + 1):
        result.append(i * i)
    return result
`,
        },
        {
          name: 'List comprehension',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(n)',
          idea: 'The same loop written as an expression. Idiomatic Python, identical complexity.',
          code: `def squares(n):
    return [i * i for i in range(1, n + 1)]
`,
        },
        {
          name: 'Repeated addition',
          tags: ['brute'],
          time: 'O(n²)', space: 'O(n)',
          idea: 'Build each square by adding `i` to itself `i` times. Correct, but the inner loop makes the work grow quadratically.',
          code: `def squares(n):
    result = []
    for i in range(1, n + 1):
        total = 0
        for _ in range(i):
            total += i
        result.append(total)
    return result
`,
        },
      ],
      tests: [
        { args: [4], expected: [1, 4, 9, 16] },
        { args: [1], expected: [1] },
        { args: [0], expected: [] },
        { args: [6], expected: [1, 4, 9, 16, 25, 36] },
      ],
    },
    {
      id: 'sum-list',
      title: 'Walk the List',
      difficulty: 'Intro',
      concepts: ['for loop', 'accumulator'],
      prompt: 'Add up every number in `nums` **without** using `sum()`. Keep a running total and visit each item once.',
      watch: 'The amber cursor walks the list one cell at a time while `running` updates beside it.',
      fn: 'total',
      demo: 'print(total([3, 1, 4, 1, 5]))',
      starter: `def total(nums):
    running = 0
    for n in nums:
        pass
    return running

print(total([3, 1, 4, 1, 5]))
`,
      solutions: [
        {
          name: 'Running total',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'One pass, one number of extra memory: the accumulator.',
          code: `def total(nums):
    running = 0
    for n in nums:
        running = running + n
    return running
`,
        },
        {
          name: 'Recursion',
          tags: [],
          time: 'O(n)', space: 'O(n)',
          idea: 'The sum is the first item plus the sum of the rest. Elegant, but every call adds a stack frame — and `nums[1:]` copies the list each time.',
          code: `def total(nums):
    if not nums:
        return 0
    return nums[0] + total(nums[1:])
`,
        },
      ],
      tests: [
        { args: [[3, 1, 4, 1, 5]], expected: 14 },
        { args: [[]], expected: 0 },
        { args: [[-2, 2, 10]], expected: 10 },
      ],
    },
    {
      id: 'find-max',
      title: 'King of the Hill',
      difficulty: 'Intro',
      concepts: ['for loop', 'if', 'comparison'],
      prompt: 'Return the largest number in a non-empty list **without** using `max()`. Assume the first item is the best so far, then challenge it with every other item.',
      watch: 'Watch the TEST step: each comparison either keeps the champion or crowns a new one.',
      fn: 'largest',
      demo: 'print(largest([4, 9, 2, 7]))',
      starter: `def largest(nums):
    best = nums[0]
    for n in nums:
        # replace best if n is bigger
        pass
    return best

print(largest([4, 9, 2, 7]))
`,
      solutions: [
        {
          name: 'Single pass',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'Every item must be looked at once, and one variable remembers the champion.',
          code: `def largest(nums):
    best = nums[0]
    for n in nums:
        if n > best:
            best = n
    return best
`,
        },
        {
          name: 'Sort, take the last',
          tags: ['brute'],
          time: 'O(n log n)', space: 'O(n)',
          idea: 'Sorting puts the biggest at the end — but it orders *everything* just to find one item.',
          code: `def largest(nums):
    ordered = sorted(nums)
    return ordered[-1]
`,
        },
      ],
      tests: [
        { args: [[4, 9, 2, 7]], expected: 9 },
        { args: [[-5, -2, -9]], expected: -2 },
        { args: [[7]], expected: 7 },
      ],
    },
    {
      id: 'countdown',
      title: 'Countdown',
      difficulty: 'Intro',
      concepts: ['while loop', 'condition'],
      prompt: 'Return `[n, n-1, …, 1]` using a `while` loop. `countdown(3)` → `[3, 2, 1]`.\n\nA `while` loop re-checks its condition before every lap — make sure something changes so it eventually stops!',
      watch: 'The LOOP? step evaluates the condition each lap. When it turns False the loop exits.',
      fn: 'countdown',
      demo: 'print(countdown(3))',
      starter: `def countdown(n):
    out = []
    while n > 0:
        out.append(n)
        # don't forget to move n towards 0
    return out

print(countdown(3))
`,
      solutions: [
        {
          name: 'While loop',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(n)',
          idea: 'Append, then shrink `n`. Without `n -= 1` the condition never becomes False.',
          code: `def countdown(n):
    out = []
    while n > 0:
        out.append(n)
        n -= 1
    return out
`,
        },
        {
          name: 'Backwards range',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(n)',
          idea: '`range(n, 0, -1)` counts down for you, and `list()` collects it.',
          code: `def countdown(n):
    return list(range(n, 0, -1))
`,
        },
      ],
      tests: [
        { args: [3], expected: [3, 2, 1] },
        { args: [1], expected: [1] },
        { args: [0], expected: [] },
      ],
    },
    {
      id: 'letter-count',
      title: 'Letter Tally',
      difficulty: 'Intro',
      concepts: ['dict', 'counting'],
      prompt: 'Return a dictionary mapping each letter of `word` to how many times it appears. `count_letters("noon")` → `{"n": 2, "o": 2}`.',
      watch: 'A dict is a set of key → value rows. New keys INSERT a row; existing keys UPDATE their value block.',
      fn: 'count_letters',
      demo: 'print(count_letters("hello"))',
      starter: `def count_letters(word):
    counts = {}
    for ch in word:
        pass  # add 1 to counts[ch], starting from 0
    return counts

print(count_letters("hello"))
`,
      solutions: [
        {
          name: 'One pass with dict.get',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(k)',
          idea: '`counts.get(ch, 0)` reads the current tally (or 0 for a new letter) in constant time. `k` is the number of distinct letters.',
          code: `def count_letters(word):
    counts = {}
    for ch in word:
        counts[ch] = counts.get(ch, 0) + 1
    return counts
`,
        },
        {
          name: 'Count each letter separately',
          tags: ['brute'],
          time: 'O(n²)', space: 'O(k)',
          idea: '`word.count(ch)` scans the whole word again for every letter — the same work done over and over.',
          code: `def count_letters(word):
    counts = {}
    for ch in word:
        counts[ch] = word.count(ch)
    return counts
`,
        },
      ],
      tests: [
        { args: ['noon'], expected: { n: 2, o: 2 } },
        { args: ['hello'], expected: { h: 1, e: 1, l: 2, o: 1 } },
        { args: [''], expected: {} },
      ],
    },
    {
      id: 'copy-not-alias',
      title: 'Copy, Not Alias',
      difficulty: 'Easy',
      concepts: ['references', 'aliasing', 'copy'],
      prompt: 'Return a **new** list equal to `items` with `x` added to the end — but the original list must stay untouched.\n\n`b = a` does *not* copy a list: it sticks a second name tag on the same object. Run the starter first and watch both arrows point at one list.',
      watch: 'Two arrows to the same block = one object, two names. `list(items)` or `items[:]` builds a second object.',
      fn: 'with_item',
      pure: true,
      demo: 'original = [1, 2]\nprint(with_item(original, 3), original)',
      starter: `def with_item(items, x):
    result = items      # is this really a copy?
    result.append(x)
    return result

original = [1, 2]
print(with_item(original, 3), original)
`,
      solutions: [
        {
          name: 'Copy, then append',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(n)',
          idea: '`list(items)` allocates a brand-new list object with the same contents, so appending to it leaves the caller\'s list alone.',
          code: `def with_item(items, x):
    result = list(items)
    result.append(x)
    return result
`,
        },
        {
          name: 'Concatenation',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(n)',
          idea: '`+` always creates a new list, so it can never mutate either operand.',
          code: `def with_item(items, x):
    return items + [x]
`,
        },
      ],
      tests: [
        { args: [[1, 2], 3], expected: [1, 2, 3] },
        { args: [[], 'a'], expected: ['a'] },
      ],
    },
    {
      id: 'helper-functions',
      title: 'Helpers on the Stack',
      difficulty: 'Easy',
      concepts: ['functions', 'call stack', 'return'],
      prompt: '`rects` is a list of `[width, height]` pairs. Return the total area of all rectangles, using the helper `area(w, h)` for each one.',
      watch: 'Every call pushes a fresh frame with its own variables on top of the stack; `return` pops it and hands back a value.',
      fn: 'total_area',
      demo: 'print(total_area([[2, 3], [4, 5]]))',
      prelude: `def area(w, h):
    return w * h

`,
      starter: `def area(w, h):
    return w * h

def total_area(rects):
    total = 0
    for w, h in rects:
        pass  # call area()
    return total

print(total_area([[2, 3], [4, 5]]))
`,
      solutions: [
        {
          name: 'Loop and call',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'One helper call per rectangle. Each call\'s frame is popped before the next one is pushed, so the stack never grows deeper than two.',
          code: `def total_area(rects):
    total = 0
    for w, h in rects:
        total += area(w, h)
    return total
`,
        },
        {
          name: 'Generator + sum',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'The same calls, folded by `sum()` without building an intermediate list.',
          code: `def total_area(rects):
    return sum(area(w, h) for w, h in rects)
`,
        },
      ],
      tests: [
        { args: [[[2, 3], [4, 5]]], expected: 26 },
        { args: [[]], expected: 0 },
        { args: [[[1, 1]]], expected: 1 },
      ],
    },
    {
      id: 'factorial',
      title: 'Tower of Frames',
      difficulty: 'Easy',
      concepts: ['recursion', 'call stack', 'base case'],
      prompt: 'Return `n!` = `n × (n-1) × … × 1` using **recursion**: a function that calls itself on a smaller problem. `0!` and `1!` are both `1`.',
      watch: 'The stack grows one frame per call until the base case, then unwinds as each frame returns into the one below.',
      fn: 'factorial',
      demo: 'print(factorial(4))',
      starter: `def factorial(n):
    if n <= 1:
        return 1
    # return n times the factorial of n - 1
    return n

print(factorial(4))
`,
      solutions: [
        {
          name: 'Iterative product',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'Multiply up from 2 to n in a single frame. Same number of multiplications, no stack growth.',
          code: `def factorial(n):
    result = 1
    for k in range(2, n + 1):
        result *= k
    return result
`,
        },
        {
          name: 'Recursion',
          tags: ['time'],
          time: 'O(n)', space: 'O(n)',
          idea: 'Mirrors the maths definition. Each pending multiplication waits in its own frame, so memory grows with n.',
          code: `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
`,
        },
      ],
      tests: [
        { args: [4], expected: 24 },
        { args: [0], expected: 1 },
        { args: [1], expected: 1 },
        { args: [6], expected: 720 },
      ],
    },
  ],
};
