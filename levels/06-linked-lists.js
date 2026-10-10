const NODE = `class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next

def build(values):
    head = None
    for v in reversed(values):
        head = ListNode(v, head)
    return head

`;

export default {
  id: 'linked-lists',
  title: 'Linked Lists',
  blurb: 'Nodes scattered around memory, held together only by arrows.',
  levels: [
    {
      id: 'reverse-linked-list',
      title: 'Reverse Linked List',
      difficulty: 'Easy',
      concepts: ['linked list', 'pointers'],
      prompt: 'Reverse a singly linked list and return the new head.\n\nWalk the list with three names: `prev`, `head` and `nxt`. At each node, flip its `.next` arrow to point backwards.',
      watch: 'Each LINK step rewires one `.next` arrow. The nodes never move in memory — only the arrows do.',
      fn: 'reverse_list',
      argTypes: ['linked'],
      returnType: 'linked',
      prelude: NODE,
      demo: 'head = reverse_list(build([1, 2, 3]))',
      starter: `${NODE}def reverse_list(head):
    prev = None
    while head:
        nxt = head.next
        # point head.next backwards, then step forward
        head = nxt
    return prev

head = reverse_list(build([1, 2, 3]))
`,
      solutions: [
        {
          name: 'Iterative re-linking',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'Three pointers walk the list once, flipping one arrow per node.',
          code: `def reverse_list(head):
    prev = None
    while head:
        nxt = head.next
        head.next = prev
        prev = head
        head = nxt
    return prev
`,
        },
        {
          name: 'Recursion',
          tags: ['time'],
          time: 'O(n)', space: 'O(n)',
          idea: 'Reverse the rest of the list, then hook the current node onto its tail. One frame per node.',
          code: `def reverse_list(head):
    if head is None or head.next is None:
        return head
    new_head = reverse_list(head.next)
    head.next.next = head
    head.next = None
    return new_head
`,
        },
        {
          name: 'Copy values, rebuild',
          tags: ['brute'],
          time: 'O(n)', space: 'O(n)',
          idea: 'Read the values into a Python list and build brand-new nodes in reverse. Doesn\'t reuse a single node.',
          code: `def reverse_list(head):
    values = []
    while head:
        values.append(head.val)
        head = head.next
    new_head = None
    for v in values:
        new_head = ListNode(v, new_head)
    return new_head
`,
        },
      ],
      tests: [
        { args: [[1, 2, 3, 4, 5]], expected: [5, 4, 3, 2, 1] },
        { args: [[1, 2]], expected: [2, 1] },
        { args: [[]], expected: [] },
      ],
    },
    {
      id: 'middle-of-list',
      title: 'Middle of the List',
      difficulty: 'Easy',
      concepts: ['fast & slow pointers'],
      prompt: 'Return the middle node of a linked list. With two middles, return the second one.\n\nSend a `fast` pointer two steps for every one step of `slow`. When `fast` falls off the end, `slow` is in the middle.',
      watch: 'Two arrows race along the chain of nodes at different speeds.',
      fn: 'middle_node',
      argTypes: ['linked'],
      returnType: 'linked',
      prelude: NODE,
      demo: 'mid = middle_node(build([1, 2, 3, 4, 5]))\nprint(mid.val)',
      starter: `${NODE}def middle_node(head):
    slow = fast = head
    # move slow by 1 and fast by 2 until fast reaches the end
    return slow

mid = middle_node(build([1, 2, 3, 4, 5]))
print(mid.val)
`,
      solutions: [
        {
          name: 'Fast & slow pointers',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'One pass: when the runner going twice as fast finishes, the walker is halfway.',
          code: `def middle_node(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow
`,
        },
        {
          name: 'Count, then walk',
          tags: ['space'],
          time: 'O(n)', space: 'O(1)',
          idea: 'Measure the length in one pass, then walk `length // 2` steps in a second pass.',
          code: `def middle_node(head):
    length = 0
    node = head
    while node:
        length += 1
        node = node.next
    node = head
    for _ in range(length // 2):
        node = node.next
    return node
`,
        },
        {
          name: 'Copy nodes into a list',
          tags: ['brute'],
          time: 'O(n)', space: 'O(n)',
          idea: 'Turn the chain into an array of nodes so you can index the middle directly.',
          code: `def middle_node(head):
    nodes = []
    while head:
        nodes.append(head)
        head = head.next
    return nodes[len(nodes) // 2]
`,
        },
      ],
      tests: [
        { args: [[1, 2, 3, 4, 5]], expected: [3, 4, 5] },
        { args: [[1, 2, 3, 4, 5, 6]], expected: [4, 5, 6] },
        { args: [[1]], expected: [1] },
      ],
    },
    {
      id: 'merge-two-lists',
      title: 'Merge Two Sorted Lists',
      difficulty: 'Easy',
      concepts: ['linked list', 'dummy node'],
      prompt: 'Merge two sorted linked lists into one sorted list by re-linking their nodes, and return its head.\n\nA throwaway `dummy` node at the front saves you from special-casing the first node.',
      watch: '`tail` walks forward, stitching the smaller node onto the growing chain each time.',
      fn: 'merge_lists',
      argTypes: ['linked', 'linked'],
      returnType: 'linked',
      prelude: NODE,
      demo: 'merged = merge_lists(build([1, 3]), build([2, 4]))',
      starter: `${NODE}def merge_lists(a, b):
    dummy = ListNode(0)
    tail = dummy
    # attach the smaller of a and b to tail, repeatedly
    return dummy.next

merged = merge_lists(build([1, 3]), build([2, 4]))
`,
      solutions: [
        {
          name: 'Dummy head, splice in place',
          tags: ['time', 'space'],
          time: 'O(n + m)', space: 'O(1)',
          idea: 'Re-link the existing nodes; the only new node is the dummy anchor.',
          code: `def merge_lists(a, b):
    dummy = ListNode(0)
    tail = dummy
    while a and b:
        if a.val <= b.val:
            tail.next = a
            a = a.next
        else:
            tail.next = b
            b = b.next
        tail = tail.next
    tail.next = a or b
    return dummy.next
`,
        },
        {
          name: 'Recursive merge',
          tags: ['time'],
          time: 'O(n + m)', space: 'O(n + m)',
          idea: 'The smaller head wins, and its `.next` is the merge of everything else. One frame per node.',
          code: `def merge_lists(a, b):
    if a is None:
        return b
    if b is None:
        return a
    if a.val <= b.val:
        a.next = merge_lists(a.next, b)
        return a
    b.next = merge_lists(a, b.next)
    return b
`,
        },
        {
          name: 'Collect, sort, rebuild',
          tags: ['brute'],
          time: 'O((n + m) log(n + m))', space: 'O(n + m)',
          idea: 'Dump every value into a list, sort it, and build fresh nodes.',
          code: `def merge_lists(a, b):
    values = []
    for node in (a, b):
        while node:
            values.append(node.val)
            node = node.next
    head = None
    for v in sorted(values, reverse=True):
        head = ListNode(v, head)
    return head
`,
        },
      ],
      tests: [
        { args: [[1, 2, 4], [1, 3, 4]], expected: [1, 1, 2, 3, 4, 4] },
        { args: [[], []], expected: [] },
        { args: [[], [0]], expected: [0] },
      ],
    },
  ],
};
