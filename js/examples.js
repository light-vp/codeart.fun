// Short programs for the Playground, each showing off one visual idea.
export const EXAMPLES = [
  {
    title: 'Variables & re-binding',
    note: 'Numbers are immutable: x = x + 1 makes a new value block.',
    code: `x = 5
y = x
x = x + 1
name = "Ada"
greeting = "Hi " + name
print(x, y, greeting)
`,
  },
  {
    title: 'List operations',
    note: 'append, insert, pop, index writes and slicing.',
    code: `nums = [3, 1, 4]
nums.append(1)
nums.insert(0, 9)
last = nums.pop()
first = nums.pop(0)
nums[1] = 7
nums.sort()
print(nums, first, last)
`,
  },
  {
    title: 'Aliasing trap',
    note: '[[0] * 3] * 3 copies the reference three times, not the row.',
    code: `grid = [[0] * 3] * 3
grid[0][0] = 1
print(grid)

safe = [[0] * 3 for _ in range(3)]
safe[0][0] = 1
print(safe)
`,
  },
  {
    title: 'Dictionary as a phone book',
    note: 'Insert, update and delete keys.',
    code: `phone = {}
phone["ana"] = 1234
phone["bo"] = 5678
phone["ana"] = 4321
del phone["bo"]
for name in phone:
    print(name, phone[name])
`,
  },
  {
    title: 'Stack & queue',
    note: 'A list used as a stack, and collections.deque as a queue.',
    code: `from collections import deque

stack = []
for ch in "abc":
    stack.append(ch)
top = stack.pop()

queue = deque([1, 2, 3])
queue.append(4)
front = queue.popleft()
print(top, front)
`,
  },
  {
    title: 'Recursive Fibonacci with memo',
    note: 'Watch the stack grow and the memo dict fill.',
    code: `memo = {}

def fib(n):
    if n <= 1:
        return n
    if n in memo:
        return memo[n]
    memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]

print(fib(6))
`,
  },
  {
    title: 'Objects & references',
    note: 'A tiny class: instances live on the heap with their fields.',
    code: `class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def move(self, dx):
        self.x += dx

p = Point(1, 2)
q = p
q.move(5)
print(p.x)
`,
  },
  {
    title: 'Selection sort',
    note: 'Find the minimum, swap it to the front, repeat.',
    code: `arr = [29, 10, 14, 37, 13]
for i in range(len(arr)):
    smallest = i
    for j in range(i + 1, len(arr)):
        if arr[j] < arr[smallest]:
            smallest = j
    arr[i], arr[smallest] = arr[smallest], arr[i]
print(arr)
`,
  },
];
