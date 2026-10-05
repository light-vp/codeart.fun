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
      watch: 'The `seen` dict fills up row by row. The marker beside a row shows which key the code is looking up.',
      fn: 'two_sum',
      starter: `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        need = target - n
        # if need is in seen, we're done; otherwise remember n
    return []

print(two_sum([2, 7, 11, 15], 9))
`,
      solution: `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        need = target - n
        if need in seen:
            return [seen[need], i]
        seen[n] = i
    return []

print(two_sum([2, 7, 11, 15], 9))
`,
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
      starter: `def has_duplicate(nums):
    seen = set()
    for n in nums:
        pass
    return False

print(has_duplicate([1, 2, 3, 1]))
`,
      solution: `def has_duplicate(nums):
    seen = set()
    for n in nums:
        if n in seen:
            return True
        seen.add(n)
    return False

print(has_duplicate([1, 2, 3, 1]))
`,
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
      starter: `def is_anagram(s, t):
    if len(s) != len(t):
        return False
    counts = {}
    # +1 for each letter of s, -1 for each letter of t
    return True

print(is_anagram("listen", "silent"))
`,
      solution: `def is_anagram(s, t):
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

print(is_anagram("listen", "silent"))
`,
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
      starter: `def group_anagrams(words):
    groups = {}
    for word in words:
        key = "".join(sorted(word))
        # add word to groups[key]
    return list(groups.values())

print(group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"]))
`,
      solution: `def group_anagrams(words):
    groups = {}
    for word in words:
        key = "".join(sorted(word))
        if key not in groups:
            groups[key] = []
        groups[key].append(word)
    return list(groups.values())

print(group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"]))
`,
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
      starter: `def first_unique(s):
    counts = {}
    for ch in s:
        counts[ch] = counts.get(ch, 0) + 1
    # second pass: find the first ch with count 1
    return -1

print(first_unique("leetcode"))
`,
      solution: `def first_unique(s):
    counts = {}
    for ch in s:
        counts[ch] = counts.get(ch, 0) + 1
    for i in range(len(s)):
        if counts[s[i]] == 1:
            return i
    return -1

print(first_unique("leetcode"))
`,
      tests: [
        { args: ['leetcode'], expected: 0 },
        { args: ['loveleetcode'], expected: 2 },
        { args: ['aabb'], expected: -1 },
      ],
    },
  ],
};
