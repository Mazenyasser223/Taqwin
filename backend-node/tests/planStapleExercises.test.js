import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { isBarDumbbellCableExercise } = requireFromHere('../src/lib/plans/planStapleExercises.js');

describe('planStapleExercises BDC filter', () => {
  it('allows barbell, dumbbell, and cable', () => {
    expect(isBarDumbbellCableExercise({ name: 'Barbell Bench Press' })).toBe(true);
    expect(isBarDumbbellCableExercise({ name: 'Dumbbell Curl' })).toBe(true);
    expect(isBarDumbbellCableExercise({ name: 'Cable Face Pull' })).toBe(true);
    expect(isBarDumbbellCableExercise({ name: 'EZ Bar Curl' })).toBe(true);
  });

  it('blocks band, machine, and bodyweight', () => {
    expect(isBarDumbbellCableExercise({ name: 'Band Row' })).toBe(false);
    expect(isBarDumbbellCableExercise({ name: 'Leg Press Machine' })).toBe(false);
    expect(isBarDumbbellCableExercise({ name: 'Push Up' })).toBe(false);
    expect(isBarDumbbellCableExercise({ name: 'Kettlebell Swing' })).toBe(false);
  });
});
