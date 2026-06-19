import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { resolveTrainingDayIndexes } = requireFromHere('../src/lib/plans/planTrainingSchedule.js');
const { buildWorkoutStructureBlueprint } = requireFromHere('../src/lib/plans/planWorkoutBlueprint.js');
const {
  applyWorkoutStructureFromBlueprint,
  expandWorkoutWeeksToFour,
} = requireFromHere('../src/lib/plans/planNormalize.js');

describe('planTrainingSchedule', () => {
  it('uses coach pattern for 4 training days', () => {
    expect(resolveTrainingDayIndexes({ trainingDaysPerWeek: '4', restDaysPreference: 'coach' })).toEqual([
      1, 2, 4, 6,
    ]);
  });

  it('respects fixed rest days from onboarding', () => {
    const train = resolveTrainingDayIndexes({
      trainingDaysPerWeek: '4',
      restDaysPreference: 'fixed',
      fixedRestDays: ['sun', 'wed', 'sat'],
    });
    expect(train).toEqual([2, 3, 5, 6]);
  });
});

describe('planWorkoutBlueprint', () => {
  it('builds 7-day skeleton matching training day count', () => {
    const bp = buildWorkoutStructureBlueprint({
      trainingDaysPerWeek: '3',
      preferredSplit: 'ppl',
    });
    expect(bp.workoutSkeleton).toHaveLength(7);
    expect(bp.workoutSkeleton.filter((d) => !d.isRest)).toHaveLength(3);
  });
});

describe('applyWorkoutStructureFromBlueprint', () => {
  it('forces rest days and expands to 4 identical weeks', () => {
    const blueprint = buildWorkoutStructureBlueprint({
      trainingDaysPerWeek: '3',
      preferredSplit: 'full_body',
    });
    const plan = {
      workoutWeeks: [
        {
          weekIndex: 1,
          days: Array.from({ length: 7 }, (_, i) => ({
            dayIndex: i + 1,
            isRest: false,
            type: 'full',
            exercises: [{ name: 'Squat' }],
          })),
        },
      ],
    };
    applyWorkoutStructureFromBlueprint(plan, blueprint);
    expandWorkoutWeeksToFour(plan);
    expect(plan.workoutWeeks).toHaveLength(4);
    const restDays = plan.workoutWeeks[0].days.filter((d) => d.isRest);
    expect(restDays.length).toBe(4);
    expect(restDays.every((d) => d.exercises.length === 0)).toBe(true);
    expect(JSON.stringify(plan.workoutWeeks[0].days)).toBe(JSON.stringify(plan.workoutWeeks[3].days));
  });
});
