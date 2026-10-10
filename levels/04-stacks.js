export default {
  id: 'stacks',
  title: 'Stacks',
  blurb: 'Last in, first out: the data structure behind undo buttons, parsers and the call stack itself.',
  levels: [
    {
      id: 'valid-parentheses',
      title: 'Valid Parentheses',
      difficulty: 'Easy',
      concepts: ['stack', 'matching'],
      prompt: 'A string of brackets `()[]{}` is valid if every opener is closed by the same type, in the right order. Return `True` or `False`.\n\nPush openers onto a stack; every closer must match the block on top.',
      watch: 'Openers APPEND to the end of `stack`; each closer POPs the top block and checks it.',
      fn: 'is_valid',
      demo: 'print(is_valid("([]{})"))',
      starter: `def is_valid(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        pass
    return len(stack) == 0

print(is_valid("([]{})"))
`,
      solutions: [
        {
          name: 'Stack of openers',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(n)',
          idea: 'The most recent unmatched opener is always on top, which is exactly the one the next closer must match.',
          code: `def is_valid(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        if ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
        else:
            stack.append(ch)
    return len(stack) == 0
`,
        },
        {
          name: 'Erase matched pairs',
          tags: ['brute'],
          time: 'O(n²)', space: 'O(n)',
          idea: 'Keep deleting `()`, `[]` and `{}` until nothing changes. Every pass rebuilds the whole string.',
          code: `def is_valid(s):
    while "()" in s or "[]" in s or "{}" in s:
        s = s.replace("()", "").replace("[]", "").replace("{}", "")
    return s == ""
`,
        },
      ],
      tests: [
        { args: ['()'], expected: true },
        { args: ['([]{})'], expected: true },
        { args: ['(]'], expected: false },
        { args: ['(('], expected: false },
        { args: [')'], expected: false },
      ],
    },
    {
      id: 'eval-rpn',
      title: 'Reverse Polish Calculator',
      difficulty: 'Medium',
      concepts: ['stack', 'parsing'],
      prompt: 'Evaluate an expression in Reverse Polish Notation, e.g. `["2", "1", "+", "3", "*"]` = `(2 + 1) * 3` = `9`.\n\nNumbers get pushed; an operator pops two numbers, combines them and pushes the result. Division truncates toward zero: use `int(a / b)`.',
      watch: 'The stack is a little pile of numbers: operators eat the top two blocks and push one back.',
      fn: 'eval_rpn',
      demo: 'print(eval_rpn(["2", "1", "+", "3", "*"]))',
      starter: `def eval_rpn(tokens):
    stack = []
    for tok in tokens:
        if tok in "+-*/":
            b = stack.pop()
            a = stack.pop()
            # push the result of a <tok> b
        else:
            stack.append(int(tok))
    return stack[0]

print(eval_rpn(["2", "1", "+", "3", "*"]))
`,
      solutions: [
        {
          name: 'Operand stack',
          tags: ['time', 'space'],
          time: 'O(n)', space: 'O(n)',
          idea: 'RPN was designed for stacks: every token is handled once and operands are always on top when needed.',
          code: `def eval_rpn(tokens):
    stack = []
    for tok in tokens:
        if tok in "+-*/":
            b = stack.pop()
            a = stack.pop()
            if tok == "+":
                stack.append(a + b)
            elif tok == "-":
                stack.append(a - b)
            elif tok == "*":
                stack.append(a * b)
            else:
                stack.append(int(a / b))
        else:
            stack.append(int(tok))
    return stack[0]
`,
        },
        {
          name: 'Rewrite the list until one token is left',
          tags: ['brute'],
          time: 'O(n²)', space: 'O(n)',
          idea: 'Find the first operator, replace it and its two operands with the result, and start over.',
          code: `def eval_rpn(tokens):
    tokens = list(tokens)
    while len(tokens) > 1:
        i = 0
        while tokens[i] not in ("+", "-", "*", "/"):
            i += 1
        a, b, op = int(tokens[i - 2]), int(tokens[i - 1]), tokens[i]
        if op == "+":
            value = a + b
        elif op == "-":
            value = a - b
        elif op == "*":
            value = a * b
        else:
            value = int(a / b)
        tokens[i - 2:i + 1] = [str(value)]
    return int(tokens[0])
`,
        },
      ],
      tests: [
        { args: [['2', '1', '+', '3', '*']], expected: 9 },
        { args: [['4', '13', '5', '/', '+']], expected: 6 },
        { args: [['10', '6', '9', '3', '+', '-11', '*', '/', '*', '17', '+', '5', '+']], expected: 22 },
      ],
    },
    {
      id: 'daily-temperatures',
      title: 'Daily Temperatures',
      difficulty: 'Medium',
      concepts: ['monotonic stack'],
      prompt: 'For each day, return how many days you must wait for a warmer temperature (or `0` if it never comes).\n\nKeep a stack of day indices still waiting for a warmer day. When a warm day arrives, it resolves every colder day on top of the stack.',
      watch: 'Indices pile up while it gets colder, then a warm day pops a whole run of them at once.',
      fn: 'daily_temperatures',
      demo: 'print(daily_temperatures([73, 74, 75, 71, 69, 72, 76, 73]))',
      starter: `def daily_temperatures(temps):
    answer = [0] * len(temps)
    waiting = []   # indices of days still waiting
    for i in range(len(temps)):
        pass
    return answer

print(daily_temperatures([73, 74, 75, 71, 69, 72, 76, 73]))
`,
      solutions: [
        {
          name: 'Monotonic stack',
          tags: ['time'],
          time: 'O(n)', space: 'O(n)',
          idea: 'Every index is pushed once and popped at most once, so the total work is linear even with the inner while loop.',
          code: `def daily_temperatures(temps):
    answer = [0] * len(temps)
    waiting = []
    for i in range(len(temps)):
        while waiting and temps[waiting[-1]] < temps[i]:
            day = waiting.pop()
            answer[day] = i - day
        waiting.append(i)
    return answer
`,
        },
        {
          name: 'Look ahead from every day',
          tags: ['brute', 'space'],
          time: 'O(n²)', space: 'O(1)',
          idea: 'For each day scan forward until a warmer one appears. No helper structure besides the answer.',
          code: `def daily_temperatures(temps):
    answer = [0] * len(temps)
    for i in range(len(temps)):
        for j in range(i + 1, len(temps)):
            if temps[j] > temps[i]:
                answer[i] = j - i
                break
    return answer
`,
        },
      ],
      tests: [
        { args: [[73, 74, 75, 71, 69, 72, 76, 73]], expected: [1, 1, 4, 2, 1, 1, 0, 0] },
        { args: [[30, 40, 50, 60]], expected: [1, 1, 1, 0] },
        { args: [[30, 60, 90]], expected: [1, 1, 0] },
      ],
    },
  ],
};
