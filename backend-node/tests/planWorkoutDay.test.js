import { describe, it, expect } from 'vitest';
import { inferIsRestWorkoutDay } from '../src/lib/plans/planWorkoutDay.js';

describe('planWorkoutDay.inferIsRestWorkoutDay', () => {
  it('treats focus push/legs as training when exercises missing but flag was rest', () => {
    expect(
      inferIsRestWorkoutDay({
        dayIndex: 2,
        isRestDay: true,
        focus: 'push',
        exercises: [],
      })
    ).toBe(false);
  });

  it('keeps true rest days', () => {
    expect(
      inferIsRestWorkoutDay({
        dayIndex: 3,
        isRestDay: true,
        focus: 'rest',
        exercises: [],
      })
    ).toBe(true);
  });

  it('training when exercises linked', () => {
    expect(
      inferIsRestWorkoutDay({
        isRestDay: true,
        focus: 'pull',
        exercises: [{ exerciseId: 'abc' }],
      })
    ).toBe(false);
  });
});
