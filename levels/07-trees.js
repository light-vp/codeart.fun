const NODE = `class TreeNode:
    def __init__(self, val, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

`;

export default {
  id: 'trees',
  title: 'Trees & Recursion',
  blurb: 'Branching structures where every node is the root of a smaller tree.',
  levels: [
    {
      id: 'max-depth',
      title: 'Maximum Depth of a Tree',
      difficulty: 'Easy',
      concepts: ['tree', 'recursion'],
      prompt: 'Return the number of nodes on the longest path from the root down to a leaf. An empty tree has depth `0`.\n\nThe depth of a tree is `1 + ` the deeper of its two subtrees.',
      watch: 'One frame per node piles onto the stack as the recursion dives down, then results bubble back up.',
      fn: 'max_depth',
      argTypes: ['tree'],
      prelude: NODE,
      demo: 'tree = TreeNode(3, TreeNode(9), TreeNode(20, TreeNode(15), TreeNode(7)))\nprint(max_depth(tree))',
      starter: `${NODE}def max_depth(root):
    if root is None:
        return 0
    # combine the depths of root.left and root.right
    return 1

tree = TreeNode(3, TreeNode(9), TreeNode(20, TreeNode(15), TreeNode(7)))
print(max_depth(tree))
`,
      solutions: [
        {
          name: 'Recursive DFS',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(h)',
          idea: 'Visit each node once. The stack only ever holds one root-to-leaf path, so memory is the tree height `h`.',
          code: `def max_depth(root):
    if root is None:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))
`,
        },
        {
          name: 'Level-by-level BFS',
          tags: ['time'],
          time: 'O(n)', space: 'O(w)',
          idea: 'Process the tree one row at a time with a queue and count the rows. Memory is the widest row `w`.',
          code: `def max_depth(root):
    if root is None:
        return 0
    level = [root]
    depth = 0
    while level:
        depth += 1
        nxt = []
        for node in level:
            if node.left:
                nxt.append(node.left)
            if node.right:
                nxt.append(node.right)
        level = nxt
    return depth
`,
        },
      ],
      tests: [
        { args: [[3, 9, 20, null, null, 15, 7]], expected: 3 },
        { args: [[1, null, 2]], expected: 2 },
        { args: [[]], expected: 0 },
      ],
    },
    {
      id: 'invert-tree',
      title: 'Invert a Binary Tree',
      difficulty: 'Easy',
      concepts: ['tree', 'recursion', 'swap'],
      prompt: 'Mirror the tree: every node\'s left and right children swap places, all the way down. Return the root.',
      watch: 'Each LINK step swaps a pair of child arrows; the tree flips one level at a time.',
      fn: 'invert_tree',
      argTypes: ['tree'],
      returnType: 'tree',
      prelude: NODE,
      demo: 'tree = TreeNode(2, TreeNode(1), TreeNode(3))\ntree = invert_tree(tree)',
      starter: `${NODE}def invert_tree(root):
    if root is None:
        return None
    # swap the children, then invert each side
    return root

tree = TreeNode(2, TreeNode(1), TreeNode(3))
tree = invert_tree(tree)
`,
      solutions: [
        {
          name: 'Recursive swap',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(h)',
          idea: 'Swap the two children, then let recursion mirror each subtree.',
          code: `def invert_tree(root):
    if root is None:
        return None
    root.left, root.right = root.right, root.left
    invert_tree(root.left)
    invert_tree(root.right)
    return root
`,
        },
        {
          name: 'Iterative with a queue',
          tags: ['time'],
          time: 'O(n)', space: 'O(w)',
          idea: 'Visit nodes breadth-first and swap each one\'s children — no recursion depth limit to worry about.',
          code: `def invert_tree(root):
    queue = [root] if root else []
    while queue:
        node = queue.pop(0)
        node.left, node.right = node.right, node.left
        if node.left:
            queue.append(node.left)
        if node.right:
            queue.append(node.right)
    return root
`,
        },
      ],
      tests: [
        { args: [[4, 2, 7, 1, 3, 6, 9]], expected: [4, 7, 2, 9, 6, 3, 1] },
        { args: [[2, 1, 3]], expected: [2, 3, 1] },
        { args: [[]], expected: [] },
      ],
    },
  ],
};
