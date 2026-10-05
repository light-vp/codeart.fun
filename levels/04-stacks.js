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
      starter: `def is_valid(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        pass
    return len(stack) == 0

print(is_valid("([]{})"))
`,
      solution: `def is_valid(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        if ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
        else:
            stack.append(ch)
    return len(stack) == 0

print(is_valid("([]{})"))
`,
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
      solution: `def eval_rpn(tokens):
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

print(eval_rpn(["2", "1", "+", "3", "*"]))
`,
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
      starter: `def daily_temperatures(temps):
    answer = [0] * len(temps)
    waiting = []   # indices of days still waiting
    for i in range(len(temps)):
        pass
    return answer

print(daily_temperatures([73, 74, 75, 71, 69, 72, 76, 73]))
`,
      solution: `def daily_temperatures(temps):
    answer = [0] * len(temps)
    waiting = []   # indices of days still waiting
    for i in range(len(temps)):
        while waiting and temps[waiting[-1]] < temps[i]:
            day = waiting.pop()
            answer[day] = i - day
        waiting.append(i)
    return answer

print(daily_temperatures([73, 74, 75, 71, 69, 72, 76, 73]))
`,
      tests: [
        { args: [[73, 74, 75, 71, 69, 72, 76, 73]], expected: [1, 1, 4, 2, 1, 1, 0, 0] },
        { args: [[30, 40, 50, 60]], expected: [1, 1, 1, 0] },
        { args: [[30, 60, 90]], expected: [1, 1, 0] },
      ],
    },
  ],
};
