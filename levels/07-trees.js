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
      starter: `${NODE}
def max_depth(root):
    if root is None:
        return 0
    # combine the depths of root.left and root.right
    return 1

tree = TreeNode(3, TreeNode(9), TreeNode(20, TreeNode(15), TreeNode(7)))
print(max_depth(tree))
`,
      solution: `${NODE}
def max_depth(root):
    if root is None:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))

tree = TreeNode(3, TreeNode(9), TreeNode(20, TreeNode(15), TreeNode(7)))
print(max_depth(tree))
`,
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
      starter: `${NODE}
def invert_tree(root):
    if root is None:
        return None
    # swap the children, then invert each side
    return root

tree = TreeNode(2, TreeNode(1), TreeNode(3))
tree = invert_tree(tree)
`,
      solution: `${NODE}
def invert_tree(root):
    if root is None:
        return None
    root.left, root.right = root.right, root.left
    invert_tree(root.left)
    invert_tree(root.right)
    return root

tree = TreeNode(2, TreeNode(1), TreeNode(3))
tree = invert_tree(tree)
`,
      tests: [
        { args: [[4, 2, 7, 1, 3, 6, 9]], expected: [4, 7, 2, 9, 6, 3, 1] },
        { args: [[2, 1, 3]], expected: [2, 3, 1] },
        { args: [[]], expected: [] },
      ],
    },
  ],
};
