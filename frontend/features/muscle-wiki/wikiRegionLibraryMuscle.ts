import type { ExerciseMuscleBrowseZone } from '../workouts/exerciseMuscleBrowse';
import { EXERCISE_MUSCLE_BROWSE_ZONES } from '../workouts/exerciseMuscleBrowse';
import {
  clearedExerciseLibraryFilters,
  serializeExerciseLibrarySearchParams,
} from '../workouts/exerciseLibraryUrl';
import type { MuscleRegion } from './types';

/** Wiki mesh region → exercise-library browse muscle filter (`set=browse`). */
const WIKI_TO_BROWSE_MUSCLE: Partial<Record<MuscleRegion, ExerciseMuscleBrowseZone>> = {
  hands: 'forearms',
};

/** Coarse wiki regions → sum of browse zone counts (legacy meshes). */
const WIKI_COUNT_AGGREGATE: Partial<Record<MuscleRegion, ExerciseMuscleBrowseZone[]>> = {
  back: ['lats', 'lowerback', 'traps', 'trapsmiddle'],
};

export function libraryMuscleForWikiRegion(region: MuscleRegion): ExerciseMuscleBrowseZone | null {
  if (WIKI_TO_BROWSE_MUSCLE[region]) return WIKI_TO_BROWSE_MUSCLE[region]!;
  if (WIKI_COUNT_AGGREGATE[region]) return null;
  if (EXERCISE_MUSCLE_BROWSE_ZONES.includes(region as ExerciseMuscleBrowseZone)) {
    return region as ExerciseMuscleBrowseZone;
  }
  return null;
}

/** Browse-library count for a wiki mesh region (matches workout filter tiles). */
export function libraryCountForWikiRegion(
  region: MuscleRegion,
  muscleCounts?: Record<string, number> | null,
): number | null {
  if (!muscleCounts) return null;

  const aggregate = WIKI_COUNT_AGGREGATE[region];
  if (aggregate) {
    return aggregate.reduce((sum, zone) => sum + (muscleCounts[zone] ?? 0), 0);
  }

  const muscle = libraryMuscleForWikiRegion(region);
  if (!muscle || muscleCounts[muscle] == null) return null;
  return muscleCounts[muscle];
}

export function isLibraryMuscleFilter(region: string): boolean {
  return EXERCISE_MUSCLE_BROWSE_ZONES.includes(region as ExerciseMuscleBrowseZone);
}

/** Deep link into the exercise library with the same browse muscle filter as Muscle Wiki. */
export function muscleWikiLibraryUrl(region: MuscleRegion, exerciseId?: string | null): string {
  const muscle = libraryMuscleForWikiRegion(region);
  const params = serializeExerciseLibrarySearchParams({
    filters: {
      ...clearedExerciseLibraryFilters(),
      muscle,
    },
    search: '',
    exerciseId: exerciseId ?? null,
  });
  const query = params.toString();
  return `/workouts${query ? `?${query}` : ''}`;
}
