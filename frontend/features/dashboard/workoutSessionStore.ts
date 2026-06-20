import type { PlanWorkoutExercise, TodayWorkoutExercise } from '../../services/exerciseService';

export type WorkoutSetRow = {
  id: string;
  kg: string;
  reps: string;
  completed: boolean;
  /** All-time personal best (kg × reps), shown in the Best column. */
  bestLabel?: string;
  /** Last logged performance before today, shown in the Previous column. */
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

function bestStorageKey(userId: string, exerciseId: string) {
  return `taqwin-workout-best:${userId}:${exerciseId}`;
}

function lastStorageKey(userId: string, exerciseId: string) {
  return `taqwin-workout-last:${userId}:${exerciseId}`;
}

export function formatPerformanceLabel(kg: number, reps: number): string {
  const k = Number.isInteger(kg) ? String(kg) : String(kg);
  return `${k}kg x ${reps}`;
}

export function parsePerformanceLabel(label?: string): { kg: number; reps: number } | null {
  if (!label?.trim()) return null;
  const match = label.trim().match(/(\d+(?:\.\d+)?)\s*kg\s*x\s*(\d+)/i);
  if (!match) return null;
  const kg = Number(match[1]);
  const reps = Number(match[2]);
  if (!Number.isFinite(kg) || !Number.isFinite(reps)) return null;
  return { kg, reps };
}

/** Volume-based score for comparing sets (higher = better). */
export function performanceScore(kg: number, reps: number): number {
  if (!Number.isFinite(kg) || !Number.isFinite(reps) || kg <= 0 || reps <= 0) return 0;
  return kg * reps;
}

export function bestFromSetDetails(details: SetDetailPayload[]): { kg: number; reps: number } | null {
  let best: { kg: number; reps: number; score: number } | null = null;
  for (const row of details) {
    if (!row.completed || row.kg == null || row.reps == null) continue;
    const score = performanceScore(row.kg, row.reps);
    if (!best || score > best.score || (score === best.score && row.kg > best.kg)) {
      best = { kg: row.kg, reps: row.reps, score };
    }
  }
  return best ? { kg: best.kg, reps: best.reps } : null;
}

export function mergeBestPerformance(
  candidate: { kg: number; reps: number } | null,
  storedLabel?: string
): { kg: number; reps: number } | null {
  const stored = parsePerformanceLabel(storedLabel);
  if (!candidate && !stored) return null;
  if (!candidate) return stored;
  if (!stored) return candidate;
  return performanceScore(candidate.kg, candidate.reps) >= performanceScore(stored.kg, stored.reps)
    ? candidate
    : stored;
}

export function readBestLabel(userId: string | undefined, exerciseId?: string): string | undefined {
  if (!userId || !exerciseId || typeof window === 'undefined') return undefined;
  try {
    const best = localStorage.getItem(bestStorageKey(userId, exerciseId));
    if (best) return best;
    return localStorage.getItem(previousStorageKey(userId, exerciseId)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeBestLabel(userId: string | undefined, exerciseId: string, label: string) {
  if (!userId || typeof window === 'undefined') return;
  localStorage.setItem(bestStorageKey(userId, exerciseId), label);
}

export function readLastLabel(userId: string | undefined, exerciseId?: string): string | undefined {
  if (!userId || !exerciseId || typeof window === 'undefined') return undefined;
  try {
    return localStorage.getItem(lastStorageKey(userId, exerciseId)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeLastLabel(userId: string | undefined, exerciseId: string, label: string) {
  if (!userId || typeof window === 'undefined') return;
  localStorage.setItem(lastStorageKey(userId, exerciseId), label);
}

/** @deprecated Use readBestLabel */
export function readPreviousLabel(userId: string | undefined, exerciseId?: string): string | undefined {
  return readBestLabel(userId, exerciseId);
}

/** @deprecated Use writeBestLabel */
export function writePreviousLabel(userId: string | undefined, exerciseId: string, label: string) {
  writeBestLabel(userId, exerciseId, label);
}

type ApiExerciseLogLike = {
  exerciseId: string;
  loggedAt: string;
  sets?: number;
  reps?: number;
  setDetails?: Array<{ kg: number | null; reps: number | null; completed: boolean }>;
};

function extractBestSetFromLog(log: ApiExerciseLogLike): { kg: number; reps: number } | null {
  if (log.setDetails?.length) {
    return bestFromSetDetails(
      log.setDetails.map((s) => ({
        kg: s.kg,
        reps: s.reps,
        completed: s.completed,
      }))
    );
  }
  return null;
}

/** Hydrate all-time best and last-session labels from exercise log history. */
export function syncExercisePersonalRecordsFromLogs(
  userId: string,
  logs: ApiExerciseLogLike[],
  currentDateKey: string
): void {
  const bestByExercise = new Map<string, { kg: number; reps: number; score: number }>();
  const sorted = [...logs].sort(
    (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
  );

  const lastByExercise = new Map<string, { kg: number; reps: number }>();

  for (const log of sorted) {
    if (!log.exerciseId) continue;
    const perf = extractBestSetFromLog(log);
    if (!perf) continue;

    const score = performanceScore(perf.kg, perf.reps);
    const curBest = bestByExercise.get(log.exerciseId);
    if (!curBest || score > curBest.score) {
      bestByExercise.set(log.exerciseId, { ...perf, score });
    }

    const logDate = log.loggedAt.slice(0, 10);
    if (logDate < currentDateKey && !lastByExercise.has(log.exerciseId)) {
      lastByExercise.set(log.exerciseId, perf);
    }
  }

  for (const [exerciseId, perf] of bestByExercise) {
    const merged = mergeBestPerformance(perf, readBestLabel(userId, exerciseId));
    if (merged) writeBestLabel(userId, exerciseId, formatPerformanceLabel(merged.kg, merged.reps));
  }
  for (const [exerciseId, perf] of lastByExercise) {
    writeLastLabel(userId, exerciseId, formatPerformanceLabel(perf.kg, perf.reps));
  }
}

function newSetId() {
  return `set-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultSets(
  count: number,
  planReps?: number,
  labels?: { best?: string; last?: string }
): WorkoutSetRow[] {
  return Array.from({ length: resolveWorkoutSetCount(count) }, (_, i) => ({
    id: newSetId(),
    kg: '',
    reps: planReps != null ? String(planReps) : '',
    completed: false,
    bestLabel: i === 0 ? labels?.best : undefined,
    previousLabel: i === 0 ? labels?.last : undefined,
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

function readSetLabels(userId: string | undefined, exerciseId?: string) {
  return {
    best: exerciseId ? readBestLabel(userId, exerciseId) : undefined,
    last: exerciseId ? readLastLabel(userId, exerciseId) : undefined,
  };
}

export function planToSessionExercise(
  ex: TodayWorkoutExercise | PlanWorkoutExercise,
  index: number,
  userId?: string,
  meta?: { thumbnailUrl?: string; primaryMuscles?: string[] }
): WorkoutSessionExercise {
  const labels = readSetLabels(userId, ex.exerciseId);
  return {
    key: `plan-${index}`,
    exerciseId: ex.exerciseId,
    name: normalizeExerciseName(ex.name),
    nameAr: ex.nameAr,
    thumbnailUrl: meta?.thumbnailUrl ?? FALLBACK_THUMB,
    primaryMuscles: meta?.primaryMuscles,
    notes: '',
    restTimerSec: null,
    sets: createDefaultSets(resolveWorkoutSetCount(ex.sets), ex.reps, labels),
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
  userId: string | undefined,
  _date: string,
  planned: Array<TodayWorkoutExercise | PlanWorkoutExercise>,
  existing?: WorkoutSession | null,
  workoutTitle?: string
): WorkoutSession {
  if (existing?.exercises?.length && !isUntouchedPlanPrefill(existing)) {
    return existing;
  }
  if (!planned.length) {
    return createEmptyWorkoutSession(existing?.workoutTitle ?? workoutTitle);
  }
  return {
    startedAt: existing?.startedAt ?? null,
    durationSec: existing?.durationSec ?? 0,
    collapsed: existing?.collapsed ?? false,
    workoutTitle: existing?.workoutTitle ?? workoutTitle,
    exercises: planned.map((ex, index) => planToSessionExercise(ex, index, userId)),
  };
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
    const labels = readSetLabels(userId, log.exerciseId);
    let sets: WorkoutSetRow[] =
      details.length > 0
        ? details.map((s, i) => ({
            id: newSetId(),
            kg: s.kg != null ? String(s.kg) : '',
            reps: s.reps != null ? String(s.reps) : '',
            completed: Boolean(s.completed),
            bestLabel: i === 0 ? labels.best : undefined,
            previousLabel: i === 0 ? labels.last : undefined,
          }))
        : createDefaultSets(plannedCount, log.reps, labels);
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

/** Completed sets ÷ total sets in the local session (0–100). */
export function computeSessionSetCompletionPct(session: WorkoutSession | null | undefined): number {
  if (!session?.exercises.length) return 0;
  let completed = 0;
  let total = 0;
  for (const ex of session.exercises) {
    for (const set of ex.sets) {
      total += 1;
      if (set.completed) completed += 1;
    }
  }
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
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
  const labels = readSetLabels(userId, item.exerciseId);
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
    sets: createDefaultSets(setCount, reps, labels),
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

export function applyPersonalRecordLabelsToSession(
  session: WorkoutSession,
  userId?: string
): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((set, index) =>
        index === 0
          ? {
              ...set,
              bestLabel: ex.exerciseId ? readBestLabel(userId, ex.exerciseId) : undefined,
              previousLabel: ex.exerciseId ? readLastLabel(userId, ex.exerciseId) : undefined,
            }
          : set
      ),
    })),
  };
}

/** Update stored best (all-time PR) and last-session labels after a workout is saved. */
export function persistPersonalRecordsAfterWorkout(
  userId: string | undefined,
  exerciseId: string | undefined,
  setDetails: SetDetailPayload[]
): void {
  if (!userId || !exerciseId) return;
  const sessionBest = bestFromSetDetails(setDetails);
  if (!sessionBest) return;
  writeLastLabel(userId, exerciseId, formatPerformanceLabel(sessionBest.kg, sessionBest.reps));
  const merged = mergeBestPerformance(sessionBest, readBestLabel(userId, exerciseId));
  if (merged) writeBestLabel(userId, exerciseId, formatPerformanceLabel(merged.kg, merged.reps));
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

/** Preserve an in-progress timer and local edits when async loads finish late. */
export function mergeInProgressLocalSession(
  base: WorkoutSession,
  local: WorkoutSession | null | undefined,
  dateKey: string,
  todayKey: string
): WorkoutSession {
  if (dateKey !== todayKey || !local) return base;
  let merged = pickWorkoutSessionForDay(base, local);
  if (local.startedAt) {
    merged = {
      ...merged,
      startedAt: local.startedAt,
      durationSec: Math.max(merged.durationSec, local.durationSec),
    };
  }
  return merged;
}
