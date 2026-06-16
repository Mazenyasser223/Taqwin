import type { TranslationKey } from '../../lib/i18n/translations';

/** Exercise library muscle tiles (granular). Keep in sync with backend exerciseMuscleBrowse.js */
export type ExerciseMuscleBrowseZone =
  | 'chest'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'glutes'
  | 'lats'
  | 'lowerback'
  | 'traps'
  | 'trapsmiddle'
  | 'frontshoulders'
  | 'rearshoulders'
  | 'abdominals'
  | 'obliques';

export const EXERCISE_MUSCLE_BROWSE_ZONES: ExerciseMuscleBrowseZone[] = [
  'chest',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'quads',
  'hamstrings',
  'calves',
  'glutes',
  'lats',
  'lowerback',
  'traps',
  'trapsmiddle',
  'frontshoulders',
  'rearshoulders',
  'abdominals',
  'obliques',
];

export type ExerciseMuscleBrowseSection = {
  id: string;
  titleKey: TranslationKey;
  zones: ExerciseMuscleBrowseZone[];
};

export const EXERCISE_MUSCLE_BROWSE_SECTIONS: ExerciseMuscleBrowseSection[] = [
  {
    id: 'push',
    titleKey: 'exercises.muscleSection.push',
    zones: ['chest', 'shoulders', 'frontshoulders', 'rearshoulders'],
  },
  {
    id: 'pull',
    titleKey: 'exercises.muscleSection.pull',
    zones: ['lats', 'lowerback', 'traps', 'trapsmiddle'],
  },
  {
    id: 'arms',
    titleKey: 'exercises.muscleSection.arms',
    zones: ['biceps', 'triceps', 'forearms'],
  },
  {
    id: 'core',
    titleKey: 'exercises.muscleSection.core',
    zones: ['abs', 'abdominals', 'obliques'],
  },
  {
    id: 'legs',
    titleKey: 'exercises.muscleSection.legs',
    zones: ['quads', 'hamstrings', 'calves', 'glutes'],
  },
];

export function exerciseMuscleBrowseKey(zone: ExerciseMuscleBrowseZone): TranslationKey {
  return `exercises.muscle.${zone}` as TranslationKey;
}

/** Fallback tile image when no dedicated photo exists. */
export const EXERCISE_MUSCLE_IMAGE_FALLBACK: Partial<Record<ExerciseMuscleBrowseZone, string>> = {
  lats: 'back',
  lowerback: 'back',
  traps: 'back',
  trapsmiddle: 'back',
  frontshoulders: 'shoulders',
  rearshoulders: 'shoulders',
  abdominals: 'abs',
  obliques: 'abs',
  glutes: 'hamstrings',
};

export function exerciseMuscleImageId(zone: ExerciseMuscleBrowseZone): string {
  return EXERCISE_MUSCLE_IMAGE_FALLBACK[zone] ?? zone;
}
