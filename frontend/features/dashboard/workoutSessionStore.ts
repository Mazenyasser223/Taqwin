import type { PlanWorkoutExercise, TodayWorkoutExercise } from '../../services/exerciseService';

export type WorkoutSetRow = {
  id: string;
  kg: string;
  reps: string;
  completed: boolean;
  recommendedLabel?: string;
  previousLabel?: string;
};

export type WorkoutSessionExercise = {
  key: string;
  exerciseId?: string;
  name: string;
  nameAr?: string;
  thumbnailUrl?: string;
  primaryMuscles?: string[];
  metaLoaded?: boolean;
  notes: string;
  restTimerSec: number | null;
  sets: WorkoutSetRow[];
  logId?: string;
  planSets?: number;
  planReps?: number;
};

export type WorkoutSession = {
  startedAt: number | null;
  durationSec: number;
  collapsed: boolean;
  exercises: WorkoutSessionExercise[];
  workoutTitle?: string;
};

const FALLBACK_THUMB =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=200';

export const DEFAULT_WORKOUT_SETS = 3;
export const DEFAULT_WORKOUT_REPS = 10;

export type SetDetailPayload = { kg: number | null; reps: number | null; completed: boolean };

/** Catalog/onboarding sometimes stores `{ nameEn, nameAr, ... }` instead of a plain string. */
export function normalizeExerciseName(name: unknown): string {
  if (typeof name === 'string') {
    const trimmed = name.trim();
    return trimmed || 'Exercise';
  }
  if (name && typeof name === 'object') {
    const o = name as Record<string, unknown>;
    for (const key of ['displayName', 'nameEn', 'name', 'nameAr', 'label']) {
      const v = o[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return 'Exercise';
}

/** Planned set count for strength work; missing/invalid values default to 3. */
export function resolveWorkoutSetCount(sets?: number | null): number {
  if (sets != null && Number.isFinite(sets) && sets > 0) {
    return Math.min(50, Math.round(sets));
  }
  return DEFAULT_WORKOUT_SETS;
}

export function buildDefaultSetDetails(
  sets: number,
  reps: number = DEFAULT_WORKOUT_REPS
): SetDetailPayload[] {
  const count = resolveWorkoutSetCount(sets);
  return Array.from({ length: count }, () => ({
    kg: null,
    reps,
    completed: false,
  }));
}

export function sessionStorageKey(userId: string, date: string) {
  return `taqwin-workout-session:${userId}:${date}`;
}

export function previousStorageKey(userId: string, exerciseId: string) {
  return `taqwin-workout-previous:${userId}:${exerciseId}`;
}

function newSetId() {
  return `set-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultSets(
  count: number,
  planReps?: number,
  previousLabel?: string
): WorkoutSetRow[] {
  return Array.from({ length: resolveWorkoutSetCount(count) }, (_, i) => ({
    id: newSetId(),
    kg: '',
    reps: planReps != null ? String(planReps) : '',
    completed: false,
    recommendedLabel: planReps != null ? String(planReps) : undefined,
    previousLabel: i === 0 ? previousLabel : undefined,
  }));
}

function sanitizeWorkoutSession(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises.map((ex) => ({
      ...ex,
      name: normalizeExerciseName(ex.name),
    })),
  };
}

export function readWorkoutSession(userId: string | undefined, date: string): WorkoutSession | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(sessionStorageKey(userId, date));
    return raw ? sanitizeWorkoutSession(JSON.parse(raw) as WorkoutSession) : null;
  } catch {
    return null;
  }
}

export function writeWorkoutSession(userId: string | undefined, date: string, session: WorkoutSession) {
  if (!userId || typeof window === 'undefined') return;
  localStorage.setItem(sessionStorageKey(userId, date), JSON.stringify(session));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('taqwin-workout-session-changed', { detail: { date } }));
  }
}

export function readPreviousLabel(userId: string | undefined, exerciseId?: string): string | undefined {
  if (!userId || !exerciseId || typeof window === 'undefined') return undefined;
  try {
    return localStorage.getItem(previousStorageKey(userId, exerciseId)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writePreviousLabel(userId: string | undefined, exerciseId: string, label: string) {
  if (!userId || typeof window === 'undefined') return;
  localStorage.setItem(previousStorageKey(userId, exerciseId), label);
}

export function planToSessionExercise(
  ex: TodayWorkoutExercise | PlanWorkoutExercise,
  index: number,
  userId?: string,
  meta?: { thumbnailUrl?: string; primaryMuscles?: string[] }
): WorkoutSessionExercise {
  const previousLabel = ex.exerciseId ? readPreviousLabel(userId, ex.exerciseId) : undefined;
  return {
    key: `plan-${index}`,
    exerciseId: ex.exerciseId,
    name: normalizeExerciseName(ex.name),
    nameAr: ex.nameAr,
    thumbnailUrl: meta?.thumbnailUrl ?? FALLBACK_THUMB,
    primaryMuscles: meta?.primaryMuscles,
    notes: '',
    restTimerSec: null,
    sets: createDefaultSets(resolveWorkoutSetCount(ex.sets), ex.reps, previousLabel),
    logId: undefined,
    planSets: resolveWorkoutSetCount(ex.sets),
    planReps: ex.reps,
  };
}

/** True when the athlete has actually begun logging (not just default plan reps). */
export function sessionHasUserProgress(session: WorkoutSession | null | undefined): boolean {
  if (!session?.exercises?.length) return false;
  if (session.startedAt) return true;
  return session.exercises.some(
    (ex) =>
      Boolean(ex.logId) ||
      ex.sets.some(
        (s) =>
          s.completed ||
          s.kg.trim() !== '' ||
          (s.reps.trim() !== '' && (!ex.planReps || s.reps !== String(ex.planReps)))
      )
  );
}

/** Future/past views must not keep a running timer from another day. */
export function sessionForCalendarDay(
  session: WorkoutSession,
  date: string,
  todayKey: string
): WorkoutSession {
  if (date === todayKey) return session;
  return { ...session, startedAt: null };
}

/** Plan-prefill used keys like `plan-0`; user-added keys include a timestamp suffix. */
export function isUntouchedPlanPrefill(session: WorkoutSession | null | undefined): boolean {
  if (!session?.exercises?.length || sessionHasUserProgress(session)) return false;
  return session.exercises.every((ex) => /^plan-\d+$/.test(ex.key));
}

export function createEmptyWorkoutSession(workoutTitle?: string): WorkoutSession {
  return {
    startedAt: null,
    durationSec: 0,
    collapsed: false,
    exercises: [],
    workoutTitle,
  };
}

export function initSessionFromPlan(
  _userId: string | undefined,
  _date: string,
  _planned: Array<TodayWorkoutExercise | PlanWorkoutExercise>,
  existing?: WorkoutSession | null
): WorkoutSession {
  if (existing?.exercises?.length) return existing;
  return createEmptyWorkoutSession(existing?.workoutTitle);
}

/** Build a session from persisted exercise logs (past / completed days). */
export function sessionFromExerciseLogs(
  logs: Array<{
    id: string;
    exerciseId: string;
    sets?: number;
    reps?: number;
    setDetails?: Array<{ kg: number | null; reps: number | null; completed: boolean }>;
    userNotes?: string | null;
    durationSec?: number;
    exercise?: {
      name?: string;
      nameAr?: string | null;
      thumbnailUrl?: string | null;
      primaryMuscles?: string[];
    } | null;
  }>,
  userId?: string
): WorkoutSession {
  const durationSec = logs.reduce((max, log) => Math.max(max, log.durationSec ?? 0), 0);
  const exercises: WorkoutSessionExercise[] = logs.map((log, index) => {
    const details = log.setDetails ?? [];
    const plannedCount = resolveWorkoutSetCount(log.sets);
    let sets: WorkoutSetRow[] =
      details.length > 0
        ? details.map((s, i) => ({
            id: newSetId(),
            kg: s.kg != null ? String(s.kg) : '',
            reps: s.reps != null ? String(s.reps) : '',
            completed: Boolean(s.completed),
            recommendedLabel: log.reps != null ? String(log.reps) : undefined,
            previousLabel:
              i === 0 && log.exerciseId ? readPreviousLabel(userId, log.exerciseId) : undefined,
          }))
        : createDefaultSets(plannedCount, log.reps);
    return {
      key: `log-${log.id}`,
      exerciseId: log.exerciseId,
      name: normalizeExerciseName(log.exercise?.name ?? 'Exercise'),
      nameAr: log.exercise?.nameAr ?? undefined,
      thumbnailUrl: log.exercise?.thumbnailUrl ?? FALLBACK_THUMB,
      primaryMuscles: log.exercise?.primaryMuscles,
      metaLoaded: true,
      notes: log.userNotes?.trim() ?? '',
      restTimerSec: null,
      sets,
      logId: log.id,
      planSets: plannedCount,
      planReps: log.reps,
    };
  });
  return {
    startedAt: null,
    durationSec,
    collapsed: false,
    exercises,
  };
}

export function sumSessionStats(session: WorkoutSession) {
  let completedSets = 0;
  let volumeKg = 0;
  for (const ex of session.exercises) {
    for (const set of ex.sets) {
      if (!set.completed) continue;
      completedSets += 1;
      const kg = Number(set.kg);
      const reps = Number(set.reps);
      if (Number.isFinite(kg) && Number.isFinite(reps)) volumeKg += kg * reps;
    }
  }
  return { completedSets, volumeKg };
}

export function formatDuration(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `${s}s`;
}

export function appendExerciseToSession(
  userId: string,
  date: string,
  item: PlanWorkoutExercise,
  meta?: { thumbnailUrl?: string; primaryMuscles?: string[] }
) {
  let session = readWorkoutSession(userId, date);
  if (!session) {
    session = { startedAt: null, durationSec: 0, collapsed: false, exercises: [] };
  }
  const index = session.exercises.length;
  const setCount = resolveWorkoutSetCount(item.sets);
  const reps = item.reps ?? DEFAULT_WORKOUT_REPS;
  const previousLabel = item.exerciseId ? readPreviousLabel(userId, item.exerciseId) : undefined;
  const nextEx: WorkoutSessionExercise = {
    key: `plan-${index}-${Date.now()}`,
    exerciseId: item.exerciseId,
    name: normalizeExerciseName(item.name),
    nameAr: item.nameAr,
    thumbnailUrl: meta?.thumbnailUrl ?? FALLBACK_THUMB,
    primaryMuscles: meta?.primaryMuscles,
    metaLoaded: Boolean(meta?.thumbnailUrl),
    notes: '',
    restTimerSec: null,
    sets: createDefaultSets(setCount, reps, previousLabel),
    planSets: setCount,
    planReps: reps,
  };
  writeWorkoutSession(userId, date, {
    ...session,
    exercises: [...session.exercises, nextEx],
  });
}

export function sessionExerciseToPayload(ex: WorkoutSessionExercise) {
  const setDetails: SetDetailPayload[] = ex.sets.map((s) => ({
    kg: s.kg.trim() === '' ? null : Number(s.kg),
    reps: s.reps.trim() === '' ? null : Number(s.reps),
    completed: s.completed,
  }));
  const completed = setDetails.filter((s) => s.completed && s.reps != null);
  const sets = ex.sets.length || resolveWorkoutSetCount(ex.planSets);
  const reps =
    completed.length > 0
      ? Math.round(completed.reduce((sum, s) => sum + (s.reps ?? 0), 0) / completed.length)
      : Number(ex.sets[0]?.reps) || ex.planReps || DEFAULT_WORKOUT_REPS;
  return { sets, reps, setDetails, userNotes: ex.notes.trim() };
}

/** Prefer in-progress local edits over API when the athlete is mid-session. */
export function pickWorkoutSessionForDay(
  fromApi: WorkoutSession,
  local: WorkoutSession | null | undefined
): WorkoutSession {
  if (local?.exercises?.length && sessionHasUserProgress(local)) {
    return {
      ...fromApi,
      ...local,
      exercises: local.exercises,
      durationSec: Math.max(fromApi.durationSec, local.durationSec),
      workoutTitle: local.workoutTitle ?? fromApi.workoutTitle,
    };
  }
  return fromApi;
}
