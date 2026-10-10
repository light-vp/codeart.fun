export default {
  id: 'search-sort',
  title: 'Searching & Sorting',
  blurb: 'Watch blocks get compared, swapped, split and merged into order.',
  levels: [
    {
      id: 'binary-search',
      title: 'Binary Search',
      difficulty: 'Easy',
      concepts: ['binary search', 'halving'],
      prompt: '`nums` is sorted. Return the index of `target`, or `-1` if it isn\'t there.\n\nCheck the middle: if it\'s too small, the answer must be to the right; too big, to the left. Each step throws away half the list.',
      watch: '`lo`, `mid` and `hi` jump around the list — the search window halves every lap.',
      fn: 'binary_search',
      demo: 'print(binary_search([1, 3, 5, 7, 9, 11, 13], 11))',
      starter: `def binary_search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        # compare nums[mid] with target and move lo or hi
        break
    return -1

print(binary_search([1, 3, 5, 7, 9, 11, 13], 11))
`,
      solutions: [
        {
          name: 'Iterative binary search',
          tags: ['time', 'space'],
          time: 'O(log n)', space: 'O(1)',
          idea: 'Each comparison halves the window; three integers are all the memory needed.',
          code: `def binary_search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
`,
        },
        {
          name: 'Recursive binary search',
          tags: ['time'],
          time: 'O(log n)', space: 'O(log n)',
          idea: 'Same halving, expressed as a call on the smaller window. Each half leaves a frame on the stack.',
          code: `def binary_search(nums, target, lo=0, hi=None):
    if hi is None:
        hi = len(nums) - 1
    if lo > hi:
        return -1
    mid = (lo + hi) // 2
    if nums[mid] == target:
        return mid
    if nums[mid] < target:
        return binary_search(nums, target, mid + 1, hi)
    return binary_search(nums, target, lo, mid - 1)
`,
        },
        {
          name: 'Linear scan',
          tags: ['brute'],
          time: 'O(n)', space: 'O(1)',
          idea: 'Check every cell from the left. Ignores the sorted order completely.',
          code: `def binary_search(nums, target):
    for i in range(len(nums)):
        if nums[i] == target:
            return i
    return -1
`,
        },
      ],
      tests: [
        { args: [[1, 3, 5, 7, 9, 11, 13], 11], expected: 5 },
        { args: [[1, 3, 5, 7], 1], expected: 0 },
        { args: [[1, 3, 5, 7], 4], expected: -1 },
        { args: [[], 4], expected: -1 },
      ],
    },
    {
      id: 'bubble-sort',
      title: 'Bubble Sort',
      difficulty: 'Easy',
      concepts: ['nested loops', 'swap', 'sorting'],
      prompt: 'Sort `arr` **in place** in ascending order using bubble sort: repeatedly walk the list and swap neighbours that are in the wrong order. After each pass, the biggest remaining block has "bubbled" to the end.',
      watch: 'Big blocks hop rightwards one SWAP at a time; the sorted tail grows from the right.',
      fn: 'bubble_sort',
      inplace: 0,
      demo: 'arr = [5, 1, 4, 2, 8]\nbubble_sort(arr)\nprint(arr)',
      starter: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - 1 - i):
            pass  # swap arr[j] and arr[j + 1] if they're out of order

arr = [5, 1, 4, 2, 8]
bubble_sort(arr)
print(arr)
`,
      solutions: [
        {
          name: 'Bubble sort with early exit',
          tags: ['time', 'space'],
          time: 'O(n²) · O(n) if sorted', space: 'O(1)',
          idea: 'If a whole pass makes no swaps, the list is already sorted — stop. Same worst case, much faster on nearly-sorted input.',
          code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        swapped = False
        for j in range(n - 1 - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:
            break
`,
        },
        {
          name: 'Plain bubble sort',
          tags: ['brute'],
          time: 'O(n²)', space: 'O(1)',
          idea: 'Always runs every pass, even after the list is sorted.',
          code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - 1 - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
`,
        },
      ],
      tests: [
        { args: [[5, 1, 4, 2, 8]], expected: [1, 2, 4, 5, 8] },
        { args: [[3, 2, 1]], expected: [1, 2, 3] },
        { args: [[]], expected: [] },
        { args: [[2, 2, 1]], expected: [1, 2, 2] },
      ],
    },
    {
      id: 'insertion-sort',
      title: 'Insertion Sort',
      difficulty: 'Easy',
      concepts: ['shifting', 'sorted prefix'],
      prompt: 'Sort `arr` **in place** with insertion sort: take each item in turn and slide it left past every bigger item until it sits in the right spot — like sorting a hand of cards.',
      watch: 'The block being inserted is held in `key` while bigger neighbours shift one cell to the right.',
      fn: 'insertion_sort',
      inplace: 0,
      demo: 'arr = [4, 3, 5, 1, 2]\ninsertion_sort(arr)\nprint(arr)',
      starter: `def insertion_sort(arr):
    for i in range(1, len(arr)):
        key = arr[i]
        j = i - 1
        # shift bigger items right, then drop key in place

arr = [4, 3, 5, 1, 2]
insertion_sort(arr)
print(arr)
`,
      solutions: [
        {
          name: 'Shift, then drop in',
          tags: ['time', 'space'],
          time: 'O(n²) · O(n) if sorted', space: 'O(1)',
          idea: 'Hold the new card in `key` and shift bigger cards right with single writes, instead of swapping pairs.',
          code: `def insertion_sort(arr):
    for i in range(1, len(arr)):
        key = arr[i]
        j = i - 1
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key
`,
        },
        {
          name: 'Swap backwards',
          tags: ['brute'],
          time: 'O(n²)', space: 'O(1)',
          idea: 'Swap the new item with its left neighbour until it is in place — two writes per step instead of one.',
          code: `def insertion_sort(arr):
    for i in range(1, len(arr)):
        j = i
        while j > 0 and arr[j - 1] > arr[j]:
            arr[j - 1], arr[j] = arr[j], arr[j - 1]
            j -= 1
`,
        },
      ],
      tests: [
        { args: [[4, 3, 5, 1, 2]], expected: [1, 2, 3, 4, 5] },
        { args: [[1]], expected: [1] },
        { args: [[9, -1, 0]], expected: [-1, 0, 9] },
      ],
    },
    {
      id: 'merge-sort',
      title: 'Merge Sort',
      difficulty: 'Medium',
      concepts: ['recursion', 'divide and conquer'],
      prompt: 'Return a **new** sorted list using merge sort: split the list in half, sort each half recursively, then merge the two sorted halves.\n\nA list of 0 or 1 items is already sorted — that\'s your base case.',
      watch: 'The stack fills with frames, each holding a smaller slice; merging happens on the way back up.',
      fn: 'merge_sort',
      demo: 'print(merge_sort([5, 2, 4, 1, 3]))',
      starter: `def merge_sort(nums):
    if len(nums) <= 1:
        return nums
    mid = len(nums) // 2
    left = merge_sort(nums[:mid])
    right = merge_sort(nums[mid:])
    merged = []
    # merge left and right
    return merged

print(merge_sort([5, 2, 4, 1, 3]))
`,
      solutions: [
        {
          name: 'Top-down merge sort',
          tags: ['time'],
          time: 'O(n log n)', space: 'O(n)',
          idea: 'log n levels of splitting, and each level does O(n) merging work.',
          code: `def merge_sort(nums):
    if len(nums) <= 1:
        return nums
    mid = len(nums) // 2
    left = merge_sort(nums[:mid])
    right = merge_sort(nums[mid:])
    merged = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
    return merged + left[i:] + right[j:]
`,
        },
        {
          name: 'Selection into a new list',
          tags: ['brute'],
          time: 'O(n²)', space: 'O(n)',
          idea: 'Repeatedly remove the smallest remaining item and append it to the output.',
          code: `def merge_sort(nums):
    remaining = list(nums)
    out = []
    while remaining:
        smallest = min(remaining)
        remaining.remove(smallest)
        out.append(smallest)
    return out
`,
        },
      ],
      tests: [
        { args: [[5, 2, 4, 1, 3]], expected: [1, 2, 3, 4, 5] },
        { args: [[]], expected: [] },
        { args: [[2, 1]], expected: [1, 2] },
        { args: [[3, 3, 1]], expected: [1, 3, 3] },
      ],
    },
  ],
};
