import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  loadManifest,
  getWorkoutPdfExerciseNameList,
  scoreExerciseNameMatch,
} = requireFromHere('../src/lib/rag/planWorkoutPdfCatalog');

describe('planWorkoutPdfCatalog', () => {
  it('loads manifest with exercises from Workout 1–4', () => {
    const manifest = loadManifest();
    expect(manifest.version).toBeGreaterThanOrEqual(1);
    expect(manifest.exercises.length).toBeGreaterThan(40);
    expect(manifest.workouts['1']?.length).toBeGreaterThan(0);
  });

  it('manifest exercises are bound to exerciseId after catalog match', () => {
    const manifest = loadManifest();
    const bound = (manifest.exercises || []).filter((e) => e.exerciseId);
    expect(bound.length).toBe(manifest.exercises.length);
  });

  it('getWorkoutPdfExerciseNameList returns English exercise names', () => {
    const names = getWorkoutPdfExerciseNameList();
    expect(names.length).toBeGreaterThan(40);
    expect(names.some((n) => /press|curl|row|squat/i.test(n))).toBe(true);
  });

  it('scoreExerciseNameMatch prefers close English hits', () => {
    const score = scoreExerciseNameMatch('Incline Dumbbell Press', {
      name: 'Dumbbell Incline Bench Press',
      nameAr: null,
    });
    expect(score).toBeGreaterThanOrEqual(45);
  });
});
