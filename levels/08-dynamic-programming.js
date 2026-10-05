export default {
  id: 'dynamic-programming',
  title: 'Dynamic Programming',
  blurb: 'Fill a table of small answers so the big answer is just one more step.',
  levels: [
    {
      id: 'climbing-stairs',
      title: 'Climbing Stairs',
      difficulty: 'Easy',
      concepts: ['DP table', 'Fibonacci'],
      prompt: 'You can climb 1 or 2 steps at a time. Return how many distinct ways there are to reach step `n`.\n\nTo stand on step `i` you came from step `i-1` or `i-2`, so `ways[i] = ways[i-1] + ways[i-2]`.',
      watch: 'The `ways` table fills left to right — each new cell is built from the two cells before it.',
      fn: 'climb_stairs',
      starter: `def climb_stairs(n):
    ways = [0] * (n + 1)
    ways[0] = 1
    for i in range(1, n + 1):
        pass  # add up the ways from the previous one or two steps
    return ways[n]

print(climb_stairs(5))
`,
      solution: `def climb_stairs(n):
    ways = [0] * (n + 1)
    ways[0] = 1
    for i in range(1, n + 1):
        ways[i] = ways[i - 1]
        if i >= 2:
            ways[i] += ways[i - 2]
    return ways[n]

print(climb_stairs(5))
`,
      tests: [
        { args: [2], expected: 2 },
        { args: [3], expected: 3 },
        { args: [5], expected: 8 },
        { args: [1], expected: 1 },
      ],
    },
    {
      id: 'house-robber',
      title: 'House Robber',
      difficulty: 'Medium',
      concepts: ['DP', 'choices'],
      prompt: '`houses[i]` is the cash in house `i`. You can\'t rob two neighbouring houses. Return the most cash you can take.\n\nAt each house choose: skip it (keep the best so far) or rob it (its cash + the best from two houses back).',
      watch: 'Two rolling boxes `prev` and `best` leapfrog each other down the street.',
      fn: 'rob',
      starter: `def rob(houses):
    prev, best = 0, 0
    for cash in houses:
        pass  # best becomes max(skip, rob); prev remembers the old best
    return best

print(rob([2, 7, 9, 3, 1]))
`,
      solution: `def rob(houses):
    prev, best = 0, 0
    for cash in houses:
        prev, best = best, max(best, prev + cash)
    return best

print(rob([2, 7, 9, 3, 1]))
`,
      tests: [
        { args: [[1, 2, 3, 1]], expected: 4 },
        { args: [[2, 7, 9, 3, 1]], expected: 12 },
        { args: [[]], expected: 0 },
        { args: [[5]], expected: 5 },
      ],
    },
  ],
};
