import type { PlanWorkoutExercise } from '../../services/exerciseService';
import type { Exercise } from '../../types';
import {
  DEFAULT_WORKOUT_REPS,
  DEFAULT_WORKOUT_SETS,
  buildDefaultSetDetails,
  normalizeExerciseName,
  resolveWorkoutSetCount,
} from './workoutSessionStore';

export type WorkoutAddContext = {
  date: string;
  isLogged: boolean;
  userId: string;
  existingDraftItems?: PlanWorkoutExercise[];
};

const CONTEXT_KEY = 'taqwin-workout-add-context';
const REOPEN_EDIT_KEY = 'taqwin-workout-reopen-edit';

export function setWorkoutAddContext(context: WorkoutAddContext) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
}

export function getWorkoutAddContext(): WorkoutAddContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CONTEXT_KEY);
    return raw ? (JSON.parse(raw) as WorkoutAddContext) : null;
  } catch {
    return null;
  }
}

export function clearWorkoutAddContext() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CONTEXT_KEY);
}

export function markWorkoutEditReopen(date: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(REOPEN_EDIT_KEY, JSON.stringify({ date }));
}

export function consumeWorkoutEditReopen(): { date: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(REOPEN_EDIT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(REOPEN_EDIT_KEY);
    return JSON.parse(raw) as { date: string };
  } catch {
    return null;
  }
}

export function exerciseToPlanItem(
  exercise: Exercise,
  sets = DEFAULT_WORKOUT_SETS,
  reps = DEFAULT_WORKOUT_REPS
): PlanWorkoutExercise {
  return {
    exerciseId: exercise.id,
    name: normalizeExerciseName(exercise.displayName ?? exercise.name),
    nameAr: exercise.nameAr ?? undefined,
    sets: resolveWorkoutSetCount(sets),
    reps,
    category: exercise.category,
    difficulty: exercise.difficulty ?? undefined,
  };
}

/** Ensures API logs include one row per planned set (default 3). */
export function planItemWithDefaultSetRows(item: PlanWorkoutExercise): PlanWorkoutExercise {
  const sets = resolveWorkoutSetCount(item.sets);
  const reps = item.reps ?? DEFAULT_WORKOUT_REPS;
  if (item.setDetails?.length) return { ...item, sets, reps };
  return { ...item, sets, reps, setDetails: buildDefaultSetDetails(sets, reps) };
}

function readWorkoutChecks(userId: string, date: string) {
  try {
    const raw = localStorage.getItem(`taqwin-workout-checks:${userId}:${date}`);
    if (!raw) return { checked: [] as string[], logIdsByKey: {} as Record<string, string> };
    const parsed = JSON.parse(raw) as { checked?: string[]; logIdsByKey?: Record<string, string> };
    return {
      checked: parsed.checked ?? [],
      logIdsByKey: parsed.logIdsByKey ?? {},
    };
  } catch {
    return { checked: [] as string[], logIdsByKey: {} as Record<string, string> };
  }
}

export function appendLogToWorkout(userId: string, date: string, entryKey: string, logId: string) {
  const store = readWorkoutChecks(userId, date);
  const logIdsByKey = { ...store.logIdsByKey, [entryKey]: logId };
  const checked = new Set(store.checked);
  checked.add(entryKey);
  localStorage.setItem(
    `taqwin-workout-checks:${userId}:${date}`,
    JSON.stringify({ checked: [...checked], logIdsByKey })
  );
}

export function appendDraftExerciseToWorkout(
  userId: string,
  date: string,
  item: PlanWorkoutExercise,
  existingDraftItems?: PlanWorkoutExercise[]
) {
  let current = existingDraftItems;
  if (!current) {
    try {
      const raw = localStorage.getItem(`taqwin-workout-plan-items:${userId}:${date}`);
      const parsed = raw ? (JSON.parse(raw) as Record<string, PlanWorkoutExercise[]>) : {};
      current = parsed.workout ?? [];
    } catch {
      current = [];
    }
  }
  try {
    const raw = localStorage.getItem(`taqwin-workout-plan-items:${userId}:${date}`);
    const parsed = raw ? (JSON.parse(raw) as Record<string, PlanWorkoutExercise[]>) : {};
    parsed.workout = [...current, item];
    localStorage.setItem(`taqwin-workout-plan-items:${userId}:${date}`, JSON.stringify(parsed));
  } catch {
    localStorage.setItem(
      `taqwin-workout-plan-items:${userId}:${date}`,
      JSON.stringify({ workout: [...current, item] })
    );
  }
}
