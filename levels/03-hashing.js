export default {
  id: 'hashing',
  title: 'Hash Maps & Sets',
  blurb: 'Trade memory for speed: remember what you have seen so you never search twice.',
  levels: [
    {
      id: 'two-sum',
      title: 'Two Sum',
      difficulty: 'Easy',
      concepts: ['dict', 'complement lookup'],
      prompt: 'Return the indices `[i, j]` of the two numbers in `nums` that add up to `target` (`i < j`). Exactly one answer exists.\n\nInstead of checking every pair, remember each number\'s index in a dict and ask: *have I already seen `target - n`?*',
      watch: 'The `seen` dict fills up row by row. The tag beside a row shows which key the code is looking up.',
      fn: 'two_sum',
      demo: 'print(two_sum([2, 7, 11, 15], 9))',
      starter: `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        need = target - n
        # if need is in seen, we're done; otherwise remember n
    return []

print(two_sum([2, 7, 11, 15], 9))
`,
      solutions: [
        {
          name: 'One-pass hash map',
          tags: ['time'],
          time: 'O(n)', space: 'O(n)',
          idea: 'A dict answers "have I seen `target - n`?" in constant time, so a single pass is enough. The price is memory for the dict.',
          code: `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        need = target - n
        if need in seen:
            return [seen[need], i]
        seen[n] = i
    return []
`,
        },
        {
          name: 'Check every pair',
          tags: ['brute', 'space'],
          time: 'O(n²)', space: 'O(1)',
          idea: 'Two nested loops try each pair once. No extra memory, but the work grows with the square of the input.',
          code: `def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
`,
        },
      ],
      tests: [
        { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
        { args: [[3, 2, 4], 6], expected: [1, 2] },
        { args: [[3, 3], 6], expected: [0, 1] },
      ],
    },
    {
      id: 'contains-duplicate',
      title: 'Contains Duplicate',
      difficulty: 'Easy',
      concepts: ['set', 'membership'],
      prompt: 'Return `True` if any value appears at least twice in `nums`, otherwise `False`.',
      watch: 'A set only keeps one copy of each value. The moment a value is already in the set, you have your answer.',
      fn: 'has_duplicate',
      demo: 'print(has_duplicate([1, 2, 3, 1]))',
      starter: `def has_duplicate(nums):
    seen = set()
    for n in nums:
        pass
    return False

print(has_duplicate([1, 2, 3, 1]))
`,
      solutions: [
        {
          name: 'Hash set',
          tags: ['time'],
          time: 'O(n)', space: 'O(n)',
          idea: 'Set membership is constant time on average, so one pass decides it.',
          code: `def has_duplicate(nums):
    seen = set()
    for n in nums:
        if n in seen:
            return True
        seen.add(n)
    return False
`,
        },
        {
          name: 'Sort, then check neighbours',
          tags: ['space'],
          time: 'O(n log n)', space: 'O(1)',
          idea: 'After an in-place sort, duplicates sit next to each other. No extra structure needed (beyond the sort itself).',
          code: `def has_duplicate(nums):
    nums.sort()
    for i in range(1, len(nums)):
        if nums[i] == nums[i - 1]:
            return True
    return False
`,
        },
        {
          name: 'Compare every pair',
          tags: ['brute'],
          time: 'O(n²)', space: 'O(1)',
          idea: 'Check each value against every later value.',
          code: `def has_duplicate(nums):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] == nums[j]:
                return True
    return False
`,
        },
      ],
      tests: [
        { args: [[1, 2, 3, 1]], expected: true },
        { args: [[1, 2, 3, 4]], expected: false },
        { args: [[]], expected: false },
      ],
    },
    {
      id: 'valid-anagram',
      title: 'Valid Anagram',
      difficulty: 'Easy',
      concepts: ['dict', 'counting'],
      prompt: 'Return `True` if `t` uses exactly the same letters as `s`, the same number of times each (`"listen"` / `"silent"`).',
      watch: 'Count up with `s`, count down with `t`. If every bucket lands back on 0, the words match.',
      fn: 'is_anagram',
      demo: 'print(is_anagram("listen", "silent"))',
      starter: `def is_anagram(s, t):
    if len(s) != len(t):
        return False
    counts = {}
    # +1 for each letter of s, -1 for each letter of t
    return True

print(is_anagram("listen", "silent"))
`,
      solutions: [
        {
          name: 'Count up, count down',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(k)',
          idea: 'One dict of letter counts. `k` is the alphabet size, so the memory is effectively constant for letters.',
          code: `def is_anagram(s, t):
    if len(s) != len(t):
        return False
    counts = {}
    for ch in s:
        counts[ch] = counts.get(ch, 0) + 1
    for ch in t:
        counts[ch] = counts.get(ch, 0) - 1
        if counts[ch] < 0:
            return False
    return True
`,
        },
        {
          name: 'Sort both words',
          tags: ['brute'],
          time: 'O(n log n)', space: 'O(n)',
          idea: 'Anagrams become identical once their letters are sorted.',
          code: `def is_anagram(s, t):
    return sorted(s) == sorted(t)
`,
        },
      ],
      tests: [
        { args: ['listen', 'silent'], expected: true },
        { args: ['rat', 'car'], expected: false },
        { args: ['aacc', 'ccac'], expected: false },
        { args: ['', ''], expected: true },
      ],
    },
    {
      id: 'group-anagrams',
      title: 'Group Anagrams',
      difficulty: 'Medium',
      concepts: ['dict of lists', 'keys'],
      prompt: 'Group the words that are anagrams of each other. Return a list of groups (any order).\n\nTwo words are anagrams if their sorted letters match, so `"".join(sorted(word))` makes a great dict key.',
      watch: 'Each dict value is its own list block. New words get appended into the group their key points at.',
      fn: 'group_anagrams',
      compare: 'unordered_nested',
      demo: 'print(group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"]))',
      starter: `def group_anagrams(words):
    groups = {}
    for word in words:
        key = "".join(sorted(word))
        # add word to groups[key]
    return list(groups.values())

print(group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"]))
`,
      solutions: [
        {
          name: 'Letter-count key',
          tags: ['time'],
          time: 'O(n·k)', space: 'O(n·k)',
          idea: 'A tuple of 26 letter counts identifies an anagram family without sorting. `k` is the word length.',
          code: `def group_anagrams(words):
    groups = {}
    for word in words:
        counts = [0] * 26
        for ch in word:
            counts[ord(ch) - ord("a")] += 1
        key = tuple(counts)
        groups.setdefault(key, []).append(word)
    return list(groups.values())
`,
        },
        {
          name: 'Sorted-letters key',
          tags: ['space'],
          time: 'O(n·k log k)', space: 'O(n·k)',
          idea: 'Sorting each word gives a short, readable key. Slightly slower per word, smaller keys.',
          code: `def group_anagrams(words):
    groups = {}
    for word in words:
        key = "".join(sorted(word))
        if key not in groups:
            groups[key] = []
        groups[key].append(word)
    return list(groups.values())
`,
        },
        {
          name: 'Compare with every group',
          tags: ['brute'],
          time: 'O(n²·k log k)', space: 'O(n·k)',
          idea: 'For each word, scan the existing groups looking for one it is an anagram of.',
          code: `def group_anagrams(words):
    groups = []
    for word in words:
        for group in groups:
            if sorted(group[0]) == sorted(word):
                group.append(word)
                break
        else:
            groups.append([word])
    return groups
`,
        },
      ],
      tests: [
        { args: [['eat', 'tea', 'tan', 'ate', 'nat', 'bat']], expected: [['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']] },
        { args: [['']], expected: [['']] },
        { args: [['a']], expected: [['a']] },
      ],
    },
    {
      id: 'first-unique-char',
      title: 'First Unique Character',
      difficulty: 'Easy',
      concepts: ['dict', 'two passes'],
      prompt: 'Return the index of the first character in `s` that appears only once, or `-1` if there is none.',
      watch: 'Pass one fills the counts dict; pass two walks the string again and checks each character\'s count.',
      fn: 'first_unique',
      demo: 'print(first_unique("leetcode"))',
      starter: `def first_unique(s):
    counts = {}
    for ch in s:
        counts[ch] = counts.get(ch, 0) + 1
    # second pass: find the first ch with count 1
    return -1

print(first_unique("leetcode"))
`,
      solutions: [
        {
          name: 'Count, then scan',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'Two linear passes. The dict holds at most one entry per letter of the alphabet — constant space.',
          code: `def first_unique(s):
    counts = {}
    for ch in s:
        counts[ch] = counts.get(ch, 0) + 1
    for i in range(len(s)):
        if counts[s[i]] == 1:
            return i
    return -1
`,
        },
        {
          name: 'Count each character on demand',
          tags: ['brute'],
          time: 'O(n²)', space: 'O(1)',
          idea: '`s.count(ch)` rescans the whole string for every position.',
          code: `def first_unique(s):
    for i in range(len(s)):
        if s.count(s[i]) == 1:
            return i
    return -1
`,
        },
      ],
      tests: [
        { args: ['leetcode'], expected: 0 },
        { args: ['loveleetcode'], expected: 2 },
        { args: ['aabb'], expected: -1 },
      ],
    },
  ],
};
