import { describe, it, expect } from 'vitest';
import {
  clearedExerciseLibraryFilters,
  exerciseLibraryUrlHasState,
  parseExerciseLibrarySearchParams,
  serializeExerciseLibrarySearchParams,
} from './exerciseLibraryUrl';

describe('exerciseLibraryUrl', () => {
  it('parses equipment, muscle, search, saved, and exercise deep link', () => {
    const params = new URLSearchParams(
      'equipment=dumbbells,barbell&muscle=chest&difficulty=Beginner&goals=gain-strength&q=bench&saved=1&exercise=abc-123',
    );
    const parsed = parseExerciseLibrarySearchParams(params);
    expect(parsed.filters.categories).toEqual(['dumbbells', 'barbell']);
    expect(parsed.filters.muscle).toBe('chest');
    expect(parsed.filters.difficulty).toBe('Beginner');
    expect(parsed.filters.goals).toEqual(['gain-strength']);
    expect(parsed.search).toBe('bench');
    expect(parsed.savedView).toBe(true);
    expect(parsed.exerciseId).toBe('abc-123');
  });

  it('serializes filters and round-trips core fields', () => {
    const params = serializeExerciseLibrarySearchParams({
      filters: {
        ...clearedExerciseLibraryFilters(),
        categories: ['bodyweight'],
        muscle: 'abs',
        difficulty: 'Intermediate',
        goals: ['gain-muscle'],
      },
      search: 'plank',
      savedView: true,
      exerciseId: 'ex-99',
    });
    expect(params.get('equipment')).toBe('bodyweight');
    expect(params.get('muscle')).toBe('abs');
    expect(params.get('difficulty')).toBe('Intermediate');
    expect(params.get('goals')).toBe('gain-muscle');
    expect(params.get('q')).toBe('plank');
    expect(params.get('saved')).toBe('1');
    expect(params.get('exercise')).toBe('ex-99');
  });

  it('detects URL state including exercise param', () => {
    expect(exerciseLibraryUrlHasState(new URLSearchParams('exercise=1'))).toBe(true);
    expect(exerciseLibraryUrlHasState(new URLSearchParams(''))).toBe(false);
  });
});
