import type { TranslationKey } from '../../lib/i18n/translations';
import {
  countActiveExerciseFilters,
  type ExerciseLibraryFilters,
} from './exerciseLibraryFilters';

type Hint = {
  key: TranslationKey;
  action?: 'clearDifficulty' | 'clearEquipment' | 'clearMuscle' | 'clearGoals';
};

export function buildExerciseEmptyStateHints(
  filters: ExerciseLibraryFilters,
  searchActive: boolean,
): Hint[] {
  const hints: Hint[] = [];
  const activeFilters = countActiveExerciseFilters(filters);

  if (searchActive && activeFilters === 0) {
    return [{ key: 'exercises.emptyHint.tryDifferentSearch' }];
  }

  if (activeFilters >= 2) {
    hints.push({ key: 'exercises.emptyHint.multiFilter' });
  }

  if (filters.difficulty) {
    hints.push({ key: 'exercises.emptyHint.removeDifficulty', action: 'clearDifficulty' });
  }

  if (filters.categories.length) {
    hints.push({ key: 'exercises.emptyHint.changeEquipment', action: 'clearEquipment' });
  }

  if (filters.muscle) {
    hints.push({ key: 'exercises.emptyHint.changeMuscle', action: 'clearMuscle' });
  }

  if (filters.goals.length) {
    hints.push({ key: 'exercises.emptyHint.changeGoals', action: 'clearGoals' });
  }

  if (hints.length === 0) {
    hints.push({ key: 'exercises.emptyHint.browseAll' });
  }

  return hints.slice(0, 3);
}

export function applyExerciseEmptyHintAction(
  filters: ExerciseLibraryFilters,
  action: Hint['action'],
): ExerciseLibraryFilters {
  switch (action) {
    case 'clearDifficulty':
      return { ...filters, difficulty: null };
    case 'clearEquipment':
      return { ...filters, categories: [] };
    case 'clearMuscle':
      return { ...filters, muscle: null };
    case 'clearGoals':
      return { ...filters, goals: [] };
    default:
      return filters;
  }
}
