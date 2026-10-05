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
      starter: `${NODE}
def reverse_list(head):
    prev = None
    while head:
        nxt = head.next
        # point head.next backwards, then step forward
        head = nxt
    return prev

head = reverse_list(build([1, 2, 3]))
`,
      solution: `${NODE}
def reverse_list(head):
    prev = None
    while head:
        nxt = head.next
        head.next = prev
        prev = head
        head = nxt
    return prev

head = reverse_list(build([1, 2, 3]))
`,
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
      starter: `${NODE}
def middle_node(head):
    slow = fast = head
    # move slow by 1 and fast by 2 until fast reaches the end
    return slow

mid = middle_node(build([1, 2, 3, 4, 5]))
print(mid.val)
`,
      solution: `${NODE}
def middle_node(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow

mid = middle_node(build([1, 2, 3, 4, 5]))
print(mid.val)
`,
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
      starter: `${NODE}
def merge_lists(a, b):
    dummy = ListNode(0)
    tail = dummy
    # attach the smaller of a and b to tail, repeatedly
    return dummy.next

merged = merge_lists(build([1, 3]), build([2, 4]))
`,
      solution: `${NODE}
def merge_lists(a, b):
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

merged = merge_lists(build([1, 3]), build([2, 4]))
`,
      tests: [
        { args: [[1, 2, 4], [1, 3, 4]], expected: [1, 1, 2, 3, 4, 4] },
        { args: [[], []], expected: [] },
        { args: [[], [0]], expected: [0] },
      ],
    },
  ],
};
