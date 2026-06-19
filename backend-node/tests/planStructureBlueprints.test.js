import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { buildNutritionStructureBlueprint } = requireFromHere('../src/lib/plans/planNutritionBlueprint');
const { buildWorkoutStructureBlueprint } = requireFromHere('../src/lib/plans/planWorkoutBlueprint');

describe('planStructureBlueprints', () => {
  it('buildNutritionStructureBlueprint returns 7-day meal skeleton', () => {
    const bp = buildNutritionStructureBlueprint({ mealsPerDay: 3, snacksPerDay: 1 });
    expect(bp.dietSkeleton).toHaveLength(7);
    expect(bp.dietSkeleton[0].meals.map((m) => m.slot)).toContain('breakfast');
    expect(bp.dietSkeleton[0].meals[0]).toHaveProperty('targetItemCount');
  });

  it('buildWorkoutStructureBlueprint respects training days', () => {
    const bp = buildWorkoutStructureBlueprint({
      trainingDaysPerWeek: 4,
      preferredSplit: 'upper_lower',
      fitnessLevel: 'intermediate',
    });
    expect(bp.workoutSkeleton).toHaveLength(7);
    const training = bp.workoutSkeleton.filter((d) => !d.isRest);
    expect(training).toHaveLength(4);
    expect(training[0].targetExerciseCount).toBeGreaterThanOrEqual(5);
  });
});
