export type ExerciseLibraryFilters = {
  /** Selected equipment categories (barbell, dumbbells, …). */
  categories: string[];
  difficulty: string | null;
  muscle: string | null;
  /** Fitness goals (lose-weight, gain-strength, gain-muscle). */
  goals: string[];
};

export const EMPTY_EXERCISE_FILTERS: ExerciseLibraryFilters = {
  categories: [],
  difficulty: null,
  muscle: null,
  goals: [],
};

export function exerciseFiltersActive(filters: ExerciseLibraryFilters): boolean {
  return Boolean(
    filters.categories.length || filters.difficulty || filters.muscle || filters.goals.length,
  );
}

export function countActiveExerciseFilters(filters: ExerciseLibraryFilters): number {
  let n = 0;
  if (filters.categories.length) n++;
  if (filters.difficulty) n++;
  if (filters.muscle) n++;
  if (filters.goals.length) n++;
  return n;
}
