import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { truncateContextBundle, getCagMaxChars } = requireFromHere('../src/lib/cag/truncateBundle');

describe('cag truncateBundle', () => {
  it('returns bundle unchanged when under budget', () => {
    const small = { locale: 'ar', profile: { displayName: 'Test' } };
    expect(truncateContextBundle(small)).toEqual(small);
  });

  it('shrinks large nutrition and memory arrays', () => {
    const huge = {
      locale: 'ar',
      nutritionToday: {
        foods: Array.from({ length: 30 }, (_, i) => ({ name: `food-${i}` })),
        logged: { mealCount: 30 },
      },
      aiMemories: Array.from({ length: 20 }, (_, i) => ({ key: `k${i}`, summary: 'x'.repeat(200) })),
      weekPlanSummary: {
        workoutDays: Array.from({ length: 14 }, (_, i) => ({ dayIndex: i })),
      },
    };
    const out = truncateContextBundle(huge);
    expect(out.nutritionToday.foods.length).toBeLessThanOrEqual(8);
    expect(out.aiMemories.length).toBeLessThanOrEqual(5);
  });

  it('getCagMaxChars defaults sanely', () => {
    expect(getCagMaxChars()).toBeGreaterThan(2000);
  });
});
