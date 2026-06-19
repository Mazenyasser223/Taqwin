import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  suggestFirstSetWeightKg,
  classifyExercise,
  pct1rmForReps,
  roundToPlate,
} = requireFromHere('../src/lib/plans/workoutWeightSuggestion.js');

describe('workoutWeightSuggestion', () => {
  const onboarding = { benchMax: 100, deadliftMax: 140, fitnessLevel: 'intermediate' };

  it('suggests bench press weight from benchMax and reps', () => {
    const kg = suggestFirstSetWeightKg(
      { name: 'Barbell Bench Press', reps: 10, category: 'chest' },
      onboarding
    );
    expect(kg).toBeGreaterThan(0);
    expect(kg % 2.5).toBe(0);
    expect(kg).toBeLessThanOrEqual(100);
  });

  it('suggests deadlift from deadliftMax', () => {
    const kg = suggestFirstSetWeightKg({ name: 'Barbell Deadlift', reps: 8, category: 'legs' }, onboarding);
    expect(kg).toBeGreaterThan(80);
    expect(kg).toBeLessThanOrEqual(140);
  });

  it('returns null for bodyweight exercises', () => {
    expect(suggestFirstSetWeightKg({ name: 'Push Up', reps: 12 }, onboarding)).toBeNull();
  });

  it('classifies dumbbell bench lower than barbell', () => {
    const bar = suggestFirstSetWeightKg({ name: 'Barbell Bench Press', reps: 10 }, onboarding);
    const db = suggestFirstSetWeightKg({ name: 'Dumbbell Bench Press', reps: 10 }, onboarding);
    expect(db).toBeLessThan(bar);
  });

  it('pct1rmForReps decreases with higher reps', () => {
    expect(pct1rmForReps(8)).toBeGreaterThan(pct1rmForReps(12));
  });

  it('roundToPlate snaps to 2.5kg', () => {
    expect(roundToPlate(17.3)).toBe(17.5);
    expect(roundToPlate(18.8)).toBe(20);
  });

  it('classifies romanian deadlift as deadlift anchor', () => {
    expect(classifyExercise('Barbell Romanian Deadlift', 'legs')?.anchor).toBe('deadlift');
  });
});
