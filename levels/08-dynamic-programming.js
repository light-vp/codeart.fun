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
      demo: 'print(climb_stairs(5))',
      starter: `def climb_stairs(n):
    ways = [0] * (n + 1)
    ways[0] = 1
    for i in range(1, n + 1):
        pass  # add up the ways from the previous one or two steps
    return ways[n]

print(climb_stairs(5))
`,
      solutions: [
        {
          name: 'Two rolling variables',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'Each cell only needs the previous two, so keep just those two numbers.',
          code: `def climb_stairs(n):
    a, b = 1, 1
    for _ in range(n - 1):
        a, b = b, a + b
    return b
`,
        },
        {
          name: 'Bottom-up table',
          tags: ['time'],
          time: 'O(n)', space: 'O(n)',
          idea: 'Fill every step\'s answer into a list, from the ground up.',
          code: `def climb_stairs(n):
    ways = [0] * (n + 1)
    ways[0] = 1
    for i in range(1, n + 1):
        ways[i] = ways[i - 1]
        if i >= 2:
            ways[i] += ways[i - 2]
    return ways[n]
`,
        },
        {
          name: 'Plain recursion',
          tags: ['brute'],
          time: 'O(2ⁿ)', space: 'O(n)',
          idea: 'Directly encodes the rule, but recomputes the same steps again and again — watch the stack churn.',
          code: `def climb_stairs(n):
    if n <= 1:
        return 1
    return climb_stairs(n - 1) + climb_stairs(n - 2)
`,
        },
      ],
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
      demo: 'print(rob([2, 7, 9, 3, 1]))',
      starter: `def rob(houses):
    prev, best = 0, 0
    for cash in houses:
        pass  # best becomes max(skip, rob); prev remembers the old best
    return best

print(rob([2, 7, 9, 3, 1]))
`,
      solutions: [
        {
          name: 'Rolling DP',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'The best total up to each house depends only on the previous two totals.',
          code: `def rob(houses):
    prev, best = 0, 0
    for cash in houses:
        prev, best = best, max(best, prev + cash)
    return best
`,
        },
        {
          name: 'DP table',
          tags: ['time'],
          time: 'O(n)', space: 'O(n)',
          idea: '`dp[i]` is the best haul from the first `i` houses. Easier to inspect, more memory.',
          code: `def rob(houses):
    dp = [0] * (len(houses) + 1)
    for i in range(1, len(houses) + 1):
        take = houses[i - 1] + (dp[i - 2] if i >= 2 else 0)
        dp[i] = max(dp[i - 1], take)
    return dp[len(houses)]
`,
        },
        {
          name: 'Try every choice',
          tags: ['brute'],
          time: 'O(2ⁿ)', space: 'O(n)',
          idea: 'At each house branch into "rob" and "skip". Exponential, because the same suffixes are solved repeatedly.',
          code: `def rob(houses, i=0):
    if i >= len(houses):
        return 0
    return max(rob(houses, i + 1), houses[i] + rob(houses, i + 2))
`,
        },
      ],
      tests: [
        { args: [[1, 2, 3, 1]], expected: 4 },
        { args: [[2, 7, 9, 3, 1]], expected: 12 },
        { args: [[]], expected: 0 },
        { args: [[5]], expected: 5 },
      ],
    },
  ],
};
