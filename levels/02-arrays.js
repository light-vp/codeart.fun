export default {
  id: 'arrays',
  title: 'Arrays & Two Pointers',
  blurb: 'Index arithmetic, in-place edits and two fingers walking towards each other.',
  levels: [
    {
      id: 'reverse-string',
      title: 'Reverse String',
      difficulty: 'Easy',
      concepts: ['two pointers', 'in-place', 'swap'],
      prompt: 'Reverse the list of characters `chars` **in place** — don\'t build a new list, and you don\'t need to return anything.\n\nPut one pointer at each end, swap, and move them towards the middle.',
      watch: 'The pointers `left` and `right` close in on each other; every SWAP makes two blocks hop over each other.',
      fn: 'reverse_chars',
      inplace: 0,
      demo: 'chars = ["h", "e", "l", "l", "o"]\nreverse_chars(chars)\nprint(chars)',
      starter: `def reverse_chars(chars):
    left, right = 0, len(chars) - 1
    while left < right:
        pass  # swap, then move both pointers

chars = ["h", "e", "l", "l", "o"]
reverse_chars(chars)
print(chars)
`,
      solutions: [
        {
          name: 'Two pointers',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'Swap the outermost pair and step inwards. Each element moves exactly once and nothing extra is allocated.',
          code: `def reverse_chars(chars):
    left, right = 0, len(chars) - 1
    while left < right:
        chars[left], chars[right] = chars[right], chars[left]
        left += 1
        right -= 1
`,
        },
        {
          name: 'Reversed copy, written back',
          tags: ['brute'],
          time: 'O(n)', space: 'O(n)',
          idea: 'Build a reversed copy, then overwrite the original cell by cell. Works, but needs a second list as big as the first.',
          code: `def reverse_chars(chars):
    backwards = []
    for i in range(len(chars) - 1, -1, -1):
        backwards.append(chars[i])
    for i in range(len(chars)):
        chars[i] = backwards[i]
`,
        },
      ],
      tests: [
        { args: [['h', 'e', 'l', 'l', 'o']], expected: ['o', 'l', 'l', 'e', 'h'] },
        { args: [['a', 'b']], expected: ['b', 'a'] },
        { args: [['x']], expected: ['x'] },
        { args: [[]], expected: [] },
      ],
    },
    {
      id: 'valid-palindrome',
      title: 'Valid Palindrome',
      difficulty: 'Easy',
      concepts: ['two pointers', 'strings'],
      prompt: 'A phrase is a palindrome if, after lower-casing it and dropping everything that isn\'t a letter or digit, it reads the same forwards and backwards. Return `True` or `False`.\n\nHint: `ch.isalnum()` and `ch.lower()`.',
      watch: 'Two pointers skip punctuation and compare characters from both ends of the string strip.',
      fn: 'is_palindrome',
      demo: 'print(is_palindrome("Race car!"))',
      starter: `def is_palindrome(s):
    left, right = 0, len(s) - 1
    while left < right:
        # skip non-alphanumeric characters, then compare
        left += 1
        right -= 1
    return True

print(is_palindrome("Race car!"))
`,
      solutions: [
        {
          name: 'Two pointers, skip as you go',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'Compare from both ends directly on the original string; no cleaned copy is ever built.',
          code: `def is_palindrome(s):
    left, right = 0, len(s) - 1
    while left < right:
        if not s[left].isalnum():
            left += 1
        elif not s[right].isalnum():
            right -= 1
        elif s[left].lower() != s[right].lower():
            return False
        else:
            left += 1
            right -= 1
    return True
`,
        },
        {
          name: 'Clean, then compare with reverse',
          tags: ['time'],
          time: 'O(n)', space: 'O(n)',
          idea: 'Build the filtered lower-case string and check it against its reverse. Simple, but allocates two new strings.',
          code: `def is_palindrome(s):
    cleaned = ""
    for ch in s:
        if ch.isalnum():
            cleaned += ch.lower()
    return cleaned == cleaned[::-1]
`,
        },
      ],
      tests: [
        { args: ['Race car!'], expected: true },
        { args: ['A man, a plan, a canal: Panama'], expected: true },
        { args: ['hello'], expected: false },
        { args: [' '], expected: true },
        { args: ['0P'], expected: false },
      ],
    },
    {
      id: 'move-zeroes',
      title: 'Move Zeroes',
      difficulty: 'Easy',
      concepts: ['two pointers', 'in-place'],
      prompt: 'Move every `0` in `nums` to the end **in place**, keeping the order of the other numbers. `[0, 1, 0, 3, 12]` → `[1, 3, 12, 0, 0]`.',
      watch: '`write` marks where the next non-zero belongs; each swap pulls a non-zero forward and pushes a zero back.',
      fn: 'move_zeroes',
      inplace: 0,
      demo: 'nums = [0, 1, 0, 3, 12]\nmove_zeroes(nums)\nprint(nums)',
      starter: `def move_zeroes(nums):
    write = 0
    for read in range(len(nums)):
        pass

nums = [0, 1, 0, 3, 12]
move_zeroes(nums)
print(nums)
`,
      solutions: [
        {
          name: 'Read / write pointers',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: '`read` scans every cell; whenever it finds a non-zero it swaps it down to `write`. Zeros drift to the back for free.',
          code: `def move_zeroes(nums):
    write = 0
    for read in range(len(nums)):
        if nums[read] != 0:
            nums[write], nums[read] = nums[read], nums[write]
            write += 1
`,
        },
        {
          name: 'Collect and refill',
          tags: ['brute'],
          time: 'O(n)', space: 'O(n)',
          idea: 'Copy the non-zeros into a new list, then overwrite `nums` and pad with zeros. Same speed, double the memory.',
          code: `def move_zeroes(nums):
    keep = [x for x in nums if x != 0]
    for i in range(len(nums)):
        nums[i] = keep[i] if i < len(keep) else 0
`,
        },
      ],
      tests: [
        { args: [[0, 1, 0, 3, 12]], expected: [1, 3, 12, 0, 0] },
        { args: [[0]], expected: [0] },
        { args: [[1, 2, 3]], expected: [1, 2, 3] },
        { args: [[0, 0, 1]], expected: [1, 0, 0] },
      ],
    },
    {
      id: 'two-sum-sorted',
      title: 'Two Sum II (Sorted)',
      difficulty: 'Medium',
      concepts: ['two pointers', 'sorted input'],
      prompt: '`numbers` is sorted in increasing order. Find the two numbers that add up to `target` and return their **1-based** positions `[i, j]` with `i < j`. Exactly one answer exists.\n\nBecause the list is sorted: if the sum is too small, move the left pointer right; too big, move the right pointer left.',
      watch: 'The two pointers squeeze inwards — no nested loop needed, just one pass.',
      fn: 'pair_sum_sorted',
      demo: 'print(pair_sum_sorted([2, 7, 11, 15], 9))',
      starter: `def pair_sum_sorted(numbers, target):
    left, right = 0, len(numbers) - 1
    while left < right:
        total = numbers[left] + numbers[right]
        # compare total with target
        break
    return []

print(pair_sum_sorted([2, 7, 11, 15], 9))
`,
      solutions: [
        {
          name: 'Two pointers',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'Sortedness tells you which pointer to move: every step discards one candidate for good.',
          code: `def pair_sum_sorted(numbers, target):
    left, right = 0, len(numbers) - 1
    while left < right:
        total = numbers[left] + numbers[right]
        if total == target:
            return [left + 1, right + 1]
        if total < target:
            left += 1
        else:
            right -= 1
    return []
`,
        },
        {
          name: 'Binary search for the partner',
          tags: [],
          time: 'O(n log n)', space: 'O(1)',
          idea: 'For each number, binary-search the rest of the list for `target - n`. Uses the sorted order, but less cleverly.',
          code: `def pair_sum_sorted(numbers, target):
    for i in range(len(numbers)):
        need = target - numbers[i]
        lo, hi = i + 1, len(numbers) - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            if numbers[mid] == need:
                return [i + 1, mid + 1]
            if numbers[mid] < need:
                lo = mid + 1
            else:
                hi = mid - 1
    return []
`,
        },
        {
          name: 'Check every pair',
          tags: ['brute'],
          time: 'O(n²)', space: 'O(1)',
          idea: 'Try all pairs with two nested loops. Ignores the fact that the input is sorted.',
          code: `def pair_sum_sorted(numbers, target):
    for i in range(len(numbers)):
        for j in range(i + 1, len(numbers)):
            if numbers[i] + numbers[j] == target:
                return [i + 1, j + 1]
    return []
`,
        },
      ],
      tests: [
        { args: [[2, 7, 11, 15], 9], expected: [1, 2] },
        { args: [[2, 3, 4], 6], expected: [1, 3] },
        { args: [[-1, 0], -1], expected: [1, 2] },
        { args: [[1, 2, 3, 4, 4, 9, 56, 90], 8], expected: [4, 5] },
      ],
    },
    {
      id: 'best-time-stock',
      title: 'Best Time to Buy & Sell',
      difficulty: 'Easy',
      concepts: ['single pass', 'running minimum'],
      prompt: '`prices[i]` is a stock\'s price on day `i`. Buy on one day and sell on a later day. Return the biggest profit possible, or `0` if you can\'t make money.',
      watch: 'Two small boxes do all the work: the cheapest price so far and the best profit so far.',
      fn: 'max_profit',
      demo: 'print(max_profit([7, 1, 5, 3, 6, 4]))',
      starter: `def max_profit(prices):
    cheapest = prices[0]
    best = 0
    for price in prices:
        pass
    return best

print(max_profit([7, 1, 5, 3, 6, 4]))
`,
      solutions: [
        {
          name: 'Track the cheapest day',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'The best sale today is today\'s price minus the cheapest price seen before it. Keep both numbers as you walk.',
          code: `def max_profit(prices):
    cheapest = prices[0]
    best = 0
    for price in prices:
        if price < cheapest:
            cheapest = price
        elif price - cheapest > best:
            best = price - cheapest
    return best
`,
        },
        {
          name: 'Every buy/sell pair',
          tags: ['brute'],
          time: 'O(n²)', space: 'O(1)',
          idea: 'Try every buy day with every later sell day.',
          code: `def max_profit(prices):
    best = 0
    for buy in range(len(prices)):
        for sell in range(buy + 1, len(prices)):
            best = max(best, prices[sell] - prices[buy])
    return best
`,
        },
      ],
      tests: [
        { args: [[7, 1, 5, 3, 6, 4]], expected: 5 },
        { args: [[7, 6, 4, 3, 1]], expected: 0 },
        { args: [[2, 4, 1]], expected: 2 },
        { args: [[5]], expected: 0 },
      ],
    },
    {
      id: 'max-subarray',
      title: 'Maximum Subarray',
      difficulty: 'Medium',
      concepts: ['Kadane', 'running sum'],
      prompt: 'Return the largest sum of any **contiguous** run of numbers in `nums` (at least one number).\n\nKadane\'s trick: if your running sum ever drops below zero, it can only hurt — start fresh from the current number.',
      watch: '`current` grows and resets as the cursor walks; `best` only ever ratchets upward.',
      fn: 'max_subarray',
      demo: 'print(max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))',
      starter: `def max_subarray(nums):
    best = nums[0]
    current = 0
    for n in nums:
        pass
    return best

print(max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))
`,
      solutions: [
        {
          name: "Kadane's algorithm",
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'At each number decide: extend the current run, or start a new one here. Remember the best run ever seen.',
          code: `def max_subarray(nums):
    best = nums[0]
    current = 0
    for n in nums:
        current = max(n, current + n)
        best = max(best, current)
    return best
`,
        },
        {
          name: 'Every start, running sum',
          tags: ['brute'],
          time: 'O(n²)', space: 'O(1)',
          idea: 'For each starting index, extend to the right while tracking the sum. Checks all n²/2 subarrays.',
          code: `def max_subarray(nums):
    best = nums[0]
    for start in range(len(nums)):
        running = 0
        for end in range(start, len(nums)):
            running += nums[end]
            best = max(best, running)
    return best
`,
        },
      ],
      tests: [
        { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6 },
        { args: [[1]], expected: 1 },
        { args: [[5, 4, -1, 7, 8]], expected: 23 },
        { args: [[-3, -1, -2]], expected: -1 },
      ],
    },
    {
      id: 'merge-sorted',
      title: 'Merge Two Sorted Lists',
      difficulty: 'Easy',
      concepts: ['two pointers', 'merging'],
      prompt: 'Given two sorted lists `a` and `b`, return a new sorted list containing all their items.\n\nKeep one pointer in each list; always take the smaller front item.',
      watch: 'Blocks from `a` and `b` fly into `merged` one at a time — the pointers show who is up next.',
      fn: 'merge_sorted',
      demo: 'print(merge_sorted([1, 4, 7], [2, 3, 9]))',
      starter: `def merge_sorted(a, b):
    merged = []
    i = j = 0
    # take the smaller of a[i] and b[j] while both have items
    return merged

print(merge_sorted([1, 4, 7], [2, 3, 9]))
`,
      solutions: [
        {
          name: 'Two-pointer merge',
          tags: ['time', 'space'],
          time: 'O(n + m)', space: 'O(n + m)',
          idea: 'Each comparison places one item for good. The output list is the only extra memory, and it is required anyway.',
          code: `def merge_sorted(a, b):
    merged = []
    i = j = 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            merged.append(a[i])
            i += 1
        else:
            merged.append(b[j])
            j += 1
    merged.extend(a[i:])
    merged.extend(b[j:])
    return merged
`,
        },
        {
          name: 'Concatenate and sort',
          tags: ['brute'],
          time: 'O((n + m) log(n + m))', space: 'O(n + m)',
          idea: 'Glue the lists together and sort from scratch — throws away the fact that both halves were already sorted.',
          code: `def merge_sorted(a, b):
    return sorted(a + b)
`,
        },
      ],
      tests: [
        { args: [[1, 4, 7], [2, 3, 9]], expected: [1, 2, 3, 4, 7, 9] },
        { args: [[], [1, 2]], expected: [1, 2] },
        { args: [[1, 1], [1]], expected: [1, 1, 1] },
        { args: [[], []], expected: [] },
      ],
    },
    {
      id: 'container-water',
      title: 'Container With Most Water',
      difficulty: 'Medium',
      concepts: ['two pointers', 'greedy'],
      prompt: '`height[i]` is a vertical wall at position `i`. Pick two walls; the water they hold is `width × the shorter wall`. Return the most water possible.\n\nStart with the widest pair and always move the **shorter** wall inwards — moving the taller one can never help.',
      watch: 'Each step discards the shorter wall: watch which pointer moves and how `best` responds.',
      fn: 'max_area',
      demo: 'print(max_area([1, 8, 6, 2, 5, 4, 8, 3, 7]))',
      starter: `def max_area(height):
    left, right = 0, len(height) - 1
    best = 0
    while left < right:
        # measure, update best, move the shorter wall
        break
    return best

print(max_area([1, 8, 6, 2, 5, 4, 8, 3, 7]))
`,
      solutions: [
        {
          name: 'Shrink from the shorter wall',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'The shorter wall limits every container it is part of, and all of them are narrower than the current one — so it can be discarded safely.',
          code: `def max_area(height):
    left, right = 0, len(height) - 1
    best = 0
    while left < right:
        width = right - left
        water = width * min(height[left], height[right])
        best = max(best, water)
        if height[left] < height[right]:
            left += 1
        else:
            right -= 1
    return best
`,
        },
        {
          name: 'Every pair of walls',
          tags: ['brute'],
          time: 'O(n²)', space: 'O(1)',
          idea: 'Measure every possible container.',
          code: `def max_area(height):
    best = 0
    for i in range(len(height)):
        for j in range(i + 1, len(height)):
            best = max(best, (j - i) * min(height[i], height[j]))
    return best
`,
        },
      ],
      tests: [
        { args: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], expected: 49 },
        { args: [[1, 1]], expected: 1 },
        { args: [[4, 3, 2, 1, 4]], expected: 16 },
      ],
    },
  ],
};
