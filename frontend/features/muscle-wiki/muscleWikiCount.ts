import type { MuscleRegion } from './types';
import { libraryCountForWikiRegion } from './wikiRegionLibraryMuscle';

export { libraryCountForWikiRegion };

/** @deprecated Use libraryCountForWikiRegion */
export function wikiCountForRegion(
  region: MuscleRegion,
  muscleCounts?: Record<string, number> | null,
): number | null {
  return libraryCountForWikiRegion(region, muscleCounts);
}

export function formatWikiExerciseCount(
  count: number | null,
  t: (
    key: 'muscleWiki.exerciseCount' | 'muscleWiki.exerciseCountOne' | 'muscleWiki.exerciseCountLoading',
    vars?: Record<string, string>,
  ) => string,
): string {
  if (count == null) return t('muscleWiki.exerciseCountLoading');
  if (count === 1) return t('muscleWiki.exerciseCountOne');
  return t('muscleWiki.exerciseCount', { count: String(count) });
}
