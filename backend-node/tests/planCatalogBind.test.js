import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { stripBindMetadata } = requireFromHere('../src/lib/plans/planCatalogBind.js');

describe('planCatalogBind', () => {
  it('stripBindMetadata removes _bind fields', () => {
    const plan = {
      dietDays: [
        {
          dayIndex: 1,
          meals: [
            {
              slot: 'breakfast',
              items: [{ name: 'Oats', grams: 50, _bind: { method: 'webteb' } }],
            },
          ],
        },
      ],
      workoutWeeks: [
        {
          weekIndex: 1,
          days: [
            {
              dayIndex: 1,
              isRest: false,
              exercises: [{ name: 'Squat', sets: 3, reps: 10, _bind: { method: 'name_exact' } }],
            },
          ],
        },
      ],
    };
    stripBindMetadata(plan);
    expect(plan.dietDays[0].meals[0].items[0]._bind).toBeUndefined();
    expect(plan.workoutWeeks[0].days[0].exercises[0]._bind).toBeUndefined();
  });
});
