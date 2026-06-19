import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  stableSortPlanFoods,
  stableSortPlanExercises,
} = requireFromHere('../src/lib/plans/planCatalogStableSort');
const {
  shouldApplyPlanStructureLock,
  buildPlanStructureLock,
} = requireFromHere('../src/lib/plans/planStructureLock');

describe('planCatalogStableSort', () => {
  it('sorts foods by stable id keys', () => {
    const sorted = stableSortPlanFoods([
      { name: 'Zucchini', webtebId: 9 },
      { name: 'Apple', id: 'aaa' },
      { name: 'Banana', id: 'bbb' },
    ]);
    expect(sorted.map((f) => f.name)).toEqual(['Apple', 'Banana', 'Zucchini']);
  });

  it('sorts exercises by exercise id', () => {
    const sorted = stableSortPlanExercises([
      { name: 'Squat', id: 'ex-2' },
      { name: 'Bench', id: 'ex-1' },
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['ex-1', 'ex-2']);
  });
});

describe('planStructureLock', () => {
  it('skips lock for fresh onboarding generation', () => {
    expect(shouldApplyPlanStructureLock('onboarding_complete')).toBe(false);
    expect(shouldApplyPlanStructureLock('weekly_refresh')).toBe(true);
  });

  it('builds skeleton and anchors from active plan', () => {
    const lock = buildPlanStructureLock({
      dailyTargets: { calories: 2400, protein: 180, carbs: 250, fat: 70, waterMl: 3000 },
      dietDays: [
        {
          dayIndex: 1,
          label: 'Day 1',
          meals: [
            { slot: 'breakfast', items: [{ name: 'Eggs' }] },
            { slot: 'lunch', items: [{ name: 'Chicken' }] },
          ],
        },
      ],
      workoutWeeks: [
        {
          weekIndex: 1,
          days: [
            { dayIndex: 1, type: 'push', isRest: false, exercises: [{ exerciseId: 'ex-1' }] },
            { dayIndex: 2, type: 'rest', isRest: true, exercises: [] },
          ],
        },
      ],
    });

    expect(lock.dailyTargets.calories).toBe(2400);
    expect(lock.workoutSkeleton).toHaveLength(2);
    expect(lock.dietSkeleton[0].mealSlots).toEqual(['breakfast', 'lunch']);
    expect(lock.anchorFoods).toEqual(['Eggs', 'Chicken']);
    expect(lock.anchorExercises).toEqual(['ex-1']);
  });
});
