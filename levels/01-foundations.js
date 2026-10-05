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
      prompt: 'A variable is a **name tag** stuck on a value in memory. Write `swap(a, b)` that returns the two values in the opposite order: `(b, a)`.\n\nDo it the old-school way, with a third variable `temp`, and watch the value blocks change hands.',
      watch: 'Each assignment re-labels a block. `temp` keeps a copy of `a` safe while `a` gets overwritten.',
      fn: 'swap',
      starter: `def swap(a, b):
    temp = a
    # move b into a, then temp into b
    return a, b

print(swap(1, 2))
`,
      solution: `def swap(a, b):
    temp = a
    a = b
    b = temp
    return a, b

print(swap(1, 2))
`,
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
      starter: `def squares(n):
    result = []
    for i in range(1, n + 1):
        pass  # append i * i
    return result

print(squares(4))
`,
      solution: `def squares(n):
    result = []
    for i in range(1, n + 1):
        result.append(i * i)
    return result

print(squares(4))
`,
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
      prompt: 'Add up every number in `nums` **without** using `sum()`. Keep a running `total` and visit each item once.',
      watch: 'The yellow cursor walks the list one cell at a time while `total` updates beside it.',
      fn: 'total',
      starter: `def total(nums):
    running = 0
    for n in nums:
        pass
    return running

print(total([3, 1, 4, 1, 5]))
`,
      solution: `def total(nums):
    running = 0
    for n in nums:
        running = running + n
    return running

print(total([3, 1, 4, 1, 5]))
`,
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
      starter: `def largest(nums):
    best = nums[0]
    for n in nums:
        # replace best if n is bigger
        pass
    return best

print(largest([4, 9, 2, 7]))
`,
      solution: `def largest(nums):
    best = nums[0]
    for n in nums:
        if n > best:
            best = n
    return best

print(largest([4, 9, 2, 7]))
`,
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
      starter: `def countdown(n):
    out = []
    while n > 0:
        out.append(n)
        # don't forget to move n towards 0
    return out

print(countdown(3))
`,
      solution: `def countdown(n):
    out = []
    while n > 0:
        out.append(n)
        n -= 1
    return out

print(countdown(3))
`,
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
      watch: 'A dict is a row of key → value pairs. New keys INSERT a row; existing keys UPDATE their value block.',
      fn: 'count_letters',
      starter: `def count_letters(word):
    counts = {}
    for ch in word:
        pass  # add 1 to counts[ch], starting from 0
    return counts

print(count_letters("hello"))
`,
      solution: `def count_letters(word):
    counts = {}
    for ch in word:
        counts[ch] = counts.get(ch, 0) + 1
    return counts

print(count_letters("hello"))
`,
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
      prompt: 'Return a **new** list equal to `items` with `x` added to the end — but the original list must stay untouched.\n\n`b = a` does *not* copy a list: it sticks a second name tag on the same object. Try the buggy version first and watch both arrows point at one list.',
      watch: 'Two variables with arrows to the same block = one object, two names. `list(items)` or `items[:]` builds a second object.',
      fn: 'with_item',
      pure: true,
      starter: `def with_item(items, x):
    result = items      # is this really a copy?
    result.append(x)
    return result

original = [1, 2]
print(with_item(original, 3), original)
`,
      solution: `def with_item(items, x):
    result = list(items)
    result.append(x)
    return result

original = [1, 2]
print(with_item(original, 3), original)
`,
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
      starter: `def area(w, h):
    return w * h

def total_area(rects):
    total = 0
    for w, h in rects:
        pass  # call area()
    return total

print(total_area([[2, 3], [4, 5]]))
`,
      solution: `def area(w, h):
    return w * h

def total_area(rects):
    total = 0
    for w, h in rects:
        total += area(w, h)
    return total

print(total_area([[2, 3], [4, 5]]))
`,
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
      starter: `def factorial(n):
    if n <= 1:
        return 1
    # return n times the factorial of n - 1
    return n

print(factorial(4))
`,
      solution: `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(4))
`,
      tests: [
        { args: [4], expected: 24 },
        { args: [0], expected: 1 },
        { args: [1], expected: 1 },
        { args: [6], expected: 720 },
      ],
    },
  ],
};
