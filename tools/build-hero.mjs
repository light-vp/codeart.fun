// Pre-records the landing-page demo so the hero animates without loading Python.
// Usage: node codeart-fun/tools/build-hero.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trace } from './test-model.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const source = `def bubble_sort(nums):
    for end in range(len(nums) - 1, 0, -1):
        for i in range(end):
            if nums[i] > nums[i + 1]:
                nums[i], nums[i + 1] = nums[i + 1], nums[i]
    return nums

result = bubble_sort([5, 2, 8, 1, 9, 3])
`;
const t = trace(source);
if (!t.ok) throw new Error(JSON.stringify(t.error));
writeFileSync(join(here, '..', 'data', 'hero-trace.json'), JSON.stringify({ source, ...t }));
console.log(`hero trace: ${t.steps.length} steps`);
