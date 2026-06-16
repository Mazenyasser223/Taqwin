import {
  EXTENDED_EQUIPMENT_FILTER_CATEGORIES,
  PRIMARY_EQUIPMENT_FILTER_CATEGORIES,
} from './exerciseCategories';
import { EXERCISE_FITNESS_GOALS } from './exerciseFitnessGoals';
import { EXERCISE_MUSCLE_BROWSE_ZONES } from './exerciseMuscleBrowse';
import {
  EMPTY_EXERCISE_FILTERS,
  type ExerciseLibraryFilters,
} from './exerciseLibraryFilters';

const ALLOWED_EQUIPMENT = new Set<string>([
  ...PRIMARY_EQUIPMENT_FILTER_CATEGORIES,
  ...EXTENDED_EQUIPMENT_FILTER_CATEGORIES,
]);

const EQUIPMENT_ALIASES: Record<string, string> = {
  dumbbell: 'dumbbells',
  dumbbells: 'dumbbells',
  barbells: 'barbell',
  kettlebell: 'kettlebells',
  kettlebells: 'kettlebells',
  smith: 'smith-machine',
  'smith-machine': 'smith-machine',
  body: 'bodyweight',
  bodyweight: 'bodyweight',
};

const ALLOWED_MUSCLES = new Set<string>(EXERCISE_MUSCLE_BROWSE_ZONES);
const ALLOWED_GOALS = new Set<string>(EXERCISE_FITNESS_GOALS);

function parseCsv(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean))];
}

function normalizeEquipment(raw: string): string | null {
  const key = raw.toLowerCase().trim();
  const mapped = EQUIPMENT_ALIASES[key] ?? key;
  return ALLOWED_EQUIPMENT.has(mapped) ? mapped : null;
}

function normalizeMuscle(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const key = raw.toLowerCase().trim();
  return ALLOWED_MUSCLES.has(key) ? key : null;
}

function normalizeDifficulty(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  if (/^(beginner|intermediate|advanced|novice|expert)$/i.test(value)) {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }
  return value;
}

export function parseExerciseLibrarySearchParams(
  params: URLSearchParams,
): { filters: ExerciseLibraryFilters; search: string; savedView: boolean; exerciseId: string | null } {
  const equipmentRaw =
    params.get('equipment') ?? params.get('categories') ?? params.get('category') ?? '';
  const categories = parseCsv(equipmentRaw)
    .map(normalizeEquipment)
    .filter((value): value is string => Boolean(value));

  const goals = parseCsv(params.get('goals')).filter((goal) => ALLOWED_GOALS.has(goal));

  const search = (params.get('q') ?? params.get('search') ?? '').trim();
  const savedRaw = (params.get('saved') ?? '').trim().toLowerCase();
  const savedView = savedRaw === '1' || savedRaw === 'true' || savedRaw === 'yes';
  const exerciseRaw = (params.get('exercise') ?? '').trim();

  return {
    filters: {
      categories: [...new Set(categories)],
      difficulty: normalizeDifficulty(params.get('difficulty')),
      muscle: normalizeMuscle(params.get('muscle')),
      goals: [...new Set(goals)],
    },
    search,
    savedView,
    exerciseId: exerciseRaw.length > 0 ? exerciseRaw : null,
  };
}

export function serializeExerciseLibrarySearchParams(input: {
  filters: ExerciseLibraryFilters;
  search: string;
  savedView?: boolean;
  exerciseId?: string | null;
}): URLSearchParams {
  const params = new URLSearchParams();
  const { filters, search } = input;

  if (filters.categories.length) {
    params.set('equipment', filters.categories.join(','));
  }
  if (filters.muscle) {
    params.set('muscle', filters.muscle);
  }
  if (filters.difficulty) {
    params.set('difficulty', filters.difficulty);
  }
  if (filters.goals.length) {
    params.set('goals', filters.goals.join(','));
  }
  if (search.trim().length >= 2) {
    params.set('q', search.trim());
  }
  if (input.savedView) {
    params.set('saved', '1');
  }
  if (input.exerciseId?.trim()) {
    params.set('exercise', input.exerciseId.trim());
  }

  return params;
}

export function exerciseLibraryUrlHasState(params: URLSearchParams): boolean {
  const { filters, search, savedView, exerciseId } = parseExerciseLibrarySearchParams(params);
  return (
    savedView ||
    Boolean(exerciseId) ||
    Boolean(search.trim()) ||
    Boolean(filters.categories.length) ||
    Boolean(filters.difficulty) ||
    Boolean(filters.muscle) ||
    Boolean(filters.goals.length)
  );
}

export function clearedExerciseLibraryFilters(): ExerciseLibraryFilters {
  return { ...EMPTY_EXERCISE_FILTERS };
}
