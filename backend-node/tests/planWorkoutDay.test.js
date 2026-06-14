import { describe, it, expect } from 'vitest';
import {
  inferIsRestWorkoutDay,
  isScaffoldWorkoutDay,
  resolveIsRestWorkoutDay,
} from '../src/lib/plans/planWorkoutDay.js';

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

describe('planWorkoutDay.isScaffoldWorkoutDay', () => {
  it('flags empty shell days without focus', () => {
    expect(isScaffoldWorkoutDay({ isRestDay: true, focus: null, exercises: [] })).toBe(true);
  });

  it('is not scaffold when focus is set', () => {
    expect(isScaffoldWorkoutDay({ focus: 'push', exercises: [] })).toBe(false);
  });

  it('is not scaffold when exercises exist', () => {
    expect(isScaffoldWorkoutDay({ focus: null, exercises: [{ exerciseId: 'x' }] })).toBe(false);
  });
});

describe('planWorkoutDay.resolveIsRestWorkoutDay', () => {
  it('does not treat scaffold shells as intentional rest', () => {
    expect(
      resolveIsRestWorkoutDay({ isRestDay: true, focus: null, exercises: [] })
    ).toBe(false);
  });

  it('respects explicit rest focus', () => {
    expect(
      resolveIsRestWorkoutDay({ isRestDay: true, focus: 'rest', exercises: [] })
    ).toBe(true);
  });
});
