import { describe, it, expect } from 'vitest';
import { expandWorkoutWeeksToFour } from '../src/lib/plans/planNormalize.js';

describe('planNormalize', () => {
  it('expands one workout week to four', () => {
    const plan = {
      workoutWeeks: [
        {
          weekIndex: 1,
          days: [{ dayIndex: 1, isRest: false, exercises: [{ name: 'Squat' }] }],
        },
      ],
    };
    expandWorkoutWeeksToFour(plan);
    expect(plan.workoutWeeks).toHaveLength(4);
    expect(plan.workoutWeeks[3].weekIndex).toBe(4);
  });
});
