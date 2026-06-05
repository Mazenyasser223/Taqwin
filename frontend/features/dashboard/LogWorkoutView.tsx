import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import exerciseService, {
  type TodayWorkoutExercise,
} from '../../services/exerciseService';
import type { Exercise } from '../../types';
import { resolveExerciseDisplayName } from '../workouts/exerciseLocale';
import { ExerciseDetailModal } from '../workouts/ExerciseDetailModal';
import { PlanItemInfoButton } from './PlanItemInfoButton';
import {
  consumeWorkoutEditReopen,
  markWorkoutEditReopen,
  setWorkoutAddContext,
} from './workoutAddContext';
import {
  createDefaultSets,
  createEmptyWorkoutSession,
  formatDuration,
  isUntouchedPlanPrefill,
  pickWorkoutSessionForDay,
  readWorkoutSession,
  resolveWorkoutSetCount,
  sessionForCalendarDay,
  sessionFromExerciseLogs,
  sessionExerciseToPayload,
  sumSessionStats,
  writePreviousLabel,
  writeWorkoutSession,
  type WorkoutSession,
  type WorkoutSessionExercise,
  type WorkoutSetRow,
} from './workoutSessionStore';
import { canLogPlanDate, isFuturePlanDate, isViewOnlyPlanDate } from './weekPlanNavigation';

const FALLBACK_THUMB =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=200';

function ExerciseSetTable({
  exercise,
  activeSetId,
  onActiveSet,
  onChangeSet,
  onToggleComplete,
  onRemoveSet,
  onAddSet,
  disabled,
}: {
  exercise: WorkoutSessionExercise;
  activeSetId: string | null;
  onActiveSet: (setId: string) => void;
  onChangeSet: (setId: string, patch: Partial<WorkoutSetRow>) => void;
  onToggleComplete: (setId: string) => void;
  onRemoveSet: (setId: string) => void;
  onAddSet: () => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const canRemoveSet = exercise.sets.length > 1;

  return (
    <div className="mt-2">
      <div className="grid grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_52px_44px_32px_28px] gap-1 px-1 text-[9px] font-bold uppercase tracking-wide text-gray-400">
        <span>{t('dashboard.workoutColSet')}</span>
        <span>{t('dashboard.workoutColRecommended')}</span>
        <span>{t('dashboard.workoutColPrevious')}</span>
        <span className="text-center">
          <span className="material-symbols-outlined align-middle text-[11px]">fitness_center</span>{' '}
          {t('dashboard.workoutColKg')}
        </span>
        <span className="text-center">{t('dashboard.workoutColReps')}</span>
        <span />
        <span />
      </div>
      <ul className="mt-1 space-y-0.5">
        {exercise.sets.map((set, index) => {
          const isActive = activeSetId === set.id;
          return (
            <li
              key={set.id}
              className={cn(
                'grid grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_52px_44px_32px_28px] items-center gap-1 rounded-md px-1 py-1',
                isActive && 'bg-brand-500/10',
                set.completed && 'opacity-90'
              )}
            >
              <span className="text-center text-xs font-semibold text-gray-500">{index + 1}</span>
              <span className="truncate text-[10px] text-gray-500">
                {set.recommendedLabel ?? (exercise.planReps != null ? String(exercise.planReps) : '—')}
              </span>
              <span className="truncate text-[10px] text-gray-400">{set.previousLabel ?? '—'}</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                disabled={disabled}
                value={set.kg}
                onFocus={() => onActiveSet(set.id)}
                onChange={(e) => onChangeSet(set.id, { kg: e.target.value })}
                placeholder="0"
                className="h-8 w-full rounded-md border border-gray-200 bg-white px-1 text-center text-xs font-semibold tabular-nums outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900"
              />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                disabled={disabled}
                value={set.reps}
                onFocus={() => onActiveSet(set.id)}
                onChange={(e) => onChangeSet(set.id, { reps: e.target.value })}
                placeholder="0"
                className="h-8 w-full rounded-md border border-gray-200 bg-white px-1 text-center text-xs font-semibold tabular-nums outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggleComplete(set.id)}
                className={cn(
                  'mx-auto flex h-7 w-7 items-center justify-center rounded-full border',
                  set.completed
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-gray-300 bg-white text-gray-300 dark:border-gray-600 dark:bg-gray-900'
                )}
                aria-label={t('dashboard.workoutCompleteSet')}
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
              </button>
              <button
                type="button"
                disabled={disabled || !canRemoveSet}
                onClick={() => onRemoveSet(set.id)}
                className={cn(
                  'mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-error-500/30 text-error-500 hover:bg-error-500/10 disabled:opacity-30'
                )}
                aria-label={t('dashboard.removeSet')}
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={disabled}
        onClick={onAddSet}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-gray-100 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]"
      >
        <span className="material-symbols-outlined text-base">add</span>
        {t('dashboard.workoutAddSet')}
      </button>
    </div>
  );
}

function ExerciseCard({
  exercise,
  resolveName,
  activeSetId,
  onActiveSet,
  onChangeSet,
  onToggleComplete,
  onRemoveSet,
  onAddSet,
  onRemove,
  onDetails,
  detailsLoading,
  disabled,
}: {
  exercise: WorkoutSessionExercise;
  resolveName: (ex: WorkoutSessionExercise) => string;
  activeSetId: string | null;
  onActiveSet: (setId: string) => void;
  onChangeSet: (setId: string, patch: Partial<WorkoutSetRow>) => void;
  onToggleComplete: (setId: string) => void;
  onRemoveSet: (setId: string) => void;
  onAddSet: () => void;
  onRemove: () => void;
  onDetails?: () => void;
  detailsLoading?: boolean;
  disabled?: boolean;
}) {
  const { t } = useI18n();

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/80">
      <div className="flex items-start gap-2.5">
        <img
          src={exercise.thumbnailUrl || FALLBACK_THUMB}
          alt=""
          className="h-11 w-11 shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h5 className="truncate text-sm font-bold text-brand-600 dark:text-brand-400">{resolveName(exercise)}</h5>
            {onDetails ? (
              <PlanItemInfoButton
                size="sm"
                disabled={!exercise.exerciseId || detailsLoading}
                onClick={onDetails}
                ariaLabel={t('exercises.details')}
              />
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-error-500/30 text-error-500 hover:bg-error-500/10 disabled:opacity-50"
          aria-label={t('dashboard.removeExercise')}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <ExerciseSetTable
        exercise={exercise}
        activeSetId={activeSetId}
        onActiveSet={onActiveSet}
        onChangeSet={onChangeSet}
        onToggleComplete={onToggleComplete}
        onRemoveSet={onRemoveSet}
        onAddSet={onAddSet}
        disabled={disabled}
      />
    </article>
  );
}

export function LogWorkoutView({
  workoutPlan,
  plannedExercises,
  date,
  todayKey,
  dayLabel,
  isRestDay,
  userId,
  onRefresh,
}: {
  workoutPlan: { title: string; durationMin: number; hasLoggedToday: boolean };
  plannedExercises: TodayWorkoutExercise[];
  date: string;
  todayKey: string;
  dayLabel?: string;
  isRestDay?: boolean;
  userId?: string;
  onRefresh?: () => Promise<void>;
}) {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const timerRef = useRef<number | null>(null);
  const [session, setSession] = useState<WorkoutSession>({
    startedAt: null,
    durationSec: 0,
    collapsed: false,
    exercises: [],
  });
  const [loadingDay, setLoadingDay] = useState(true);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const exerciseCacheRef = useRef<Map<string, Exercise>>(new Map());

  const dayOffset = date < todayKey ? -1 : date > todayKey ? 1 : 0;

  const defaultWorkoutTitle =
    workoutPlan.title &&
    workoutPlan.title !== 'Training session' &&
    workoutPlan.title !== 'جلسة تدريب'
      ? workoutPlan.title
      : dayOffset === 0
        ? t('dashboard.todayWorkout')
        : dayLabel
          ? t('dashboard.workoutDaySession', { day: dayLabel })
          : t('dashboard.logWorkout');

  const displayWorkoutTitle = session.workoutTitle?.trim() || defaultWorkoutTitle;

  const resolveName = (ex: WorkoutSessionExercise) =>
    resolveExerciseDisplayName({ name: ex.name, nameAr: ex.nameAr }, language);

  const openExerciseDetails = async (exercise: WorkoutSessionExercise) => {
    if (!exercise.exerciseId || detailLoading) return;
    const cached = exerciseCacheRef.current.get(exercise.exerciseId);
    if (cached) {
      setDetailExercise(cached);
      return;
    }
    setDetailLoading(true);
    try {
      const res = await exerciseService.getExercise(exercise.exerciseId, language);
      if (res.data) {
        exerciseCacheRef.current.set(exercise.exerciseId, res.data);
        setDetailExercise(res.data);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const isToday = date === todayKey;
  const canLogDay = canLogPlanDate(date, todayKey);
  const isFutureDay = isFuturePlanDate(date, todayKey);
  const viewOnly = isViewOnlyPlanDate(date, todayKey);

  const normalizeSession = useCallback(
    (next: WorkoutSession) => sessionForCalendarDay(next, date, todayKey),
    [date, todayKey]
  );

  const ensureStarted = useCallback(
    (next: WorkoutSession) => {
      if (!isToday || next.startedAt) return next;
      return { ...next, startedAt: Date.now() };
    },
    [isToday]
  );

  const persist = useCallback(
    (next: WorkoutSession) => {
      const normalized = normalizeSession(next);
      setSession(normalized);
      writeWorkoutSession(userId, date, normalized);
    },
    [userId, date, normalizeSession]
  );

  const startTitleEdit = () => {
    if (viewOnly) return;
    setTitleDraft(displayWorkoutTitle);
    setEditingTitle(true);
  };

  const commitTitleEdit = () => {
    if (viewOnly) {
      setEditingTitle(false);
      return;
    }
    const nextTitle = titleDraft.trim() || defaultWorkoutTitle;
    persist({ ...session, workoutTitle: nextTitle });
    setEditingTitle(false);
  };

  useEffect(() => {
    if (!isToday || !session.startedAt) return;
    timerRef.current = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isToday, session.startedAt]);

  useEffect(() => {
    let cancelled = false;
    setLoadingDay(true);
    setError(null);
    setActiveSetId(null);
    setSession(createEmptyWorkoutSession());

    const loadDay = async () => {
      if (isRestDay) {
        if (!cancelled) {
          setSession(createEmptyWorkoutSession());
          setLoadingDay(false);
        }
        return;
      }

      try {
        const res = await exerciseService.getMyLogs(date);
        if (cancelled) return;

        const local = readWorkoutSession(userId, date);
        const apiLogs = res.data ?? [];
        const hasApiLogs = apiLogs.length > 0;

        let loaded: WorkoutSession;
        if (hasApiLogs) {
          const fromApi = sessionFromExerciseLogs(apiLogs, userId);
          loaded = pickWorkoutSessionForDay(fromApi, local);
        } else if (local?.exercises?.length && !isUntouchedPlanPrefill(local)) {
          loaded = local;
        } else {
          loaded = createEmptyWorkoutSession(local?.workoutTitle);
        }

        const normalized = normalizeSession(loaded);
        writeWorkoutSession(userId, date, normalized);
        setSession(normalized);
      } finally {
        if (!cancelled) setLoadingDay(false);
      }
    };

    void loadDay();
    return () => {
      cancelled = true;
    };
  }, [date, todayKey, userId, isRestDay, normalizeSession]);

  useEffect(() => {
    const onSessionChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ date?: string }>).detail;
      if (detail?.date !== date || !userId) return;
      const local = readWorkoutSession(userId, date);
      if (!local?.exercises?.length) return;
      setSession(normalizeSession(local));
    };
    window.addEventListener('taqwin-workout-session-changed', onSessionChanged);
    return () => window.removeEventListener('taqwin-workout-session-changed', onSessionChanged);
  }, [date, userId, normalizeSession]);

  useEffect(() => {
    const reopen = consumeWorkoutEditReopen();
    if (!reopen || reopen.date !== date) return;
    const existing = readWorkoutSession(userId, date);
    const next = existing
      ? normalizeSession(existing)
      : normalizeSession(createEmptyWorkoutSession());
    setSession(next);
    writeWorkoutSession(userId, date, next);
  }, [date, userId, normalizeSession, todayKey]);

  useEffect(() => {
    let cancelled = false;
    const pending = session.exercises.filter((ex) => ex.exerciseId && !ex.metaLoaded);
    if (!pending.length) return;
    const loadMeta = async () => {
      const metaByKey = new Map<
        string,
        { thumbnailUrl?: string; primaryMuscles?: string[] }
      >();
      for (const ex of pending) {
        const res = await exerciseService.getExercise(ex.exerciseId!, language);
        if (cancelled) return;
        metaByKey.set(ex.key, {
          thumbnailUrl: res.data?.thumbnailUrl ?? ex.thumbnailUrl ?? FALLBACK_THUMB,
          primaryMuscles: res.data?.primaryMuscles ?? ex.primaryMuscles,
        });
      }
      setSession((prev) => {
        const next = normalizeSession({
          ...prev,
          exercises: prev.exercises.map((ex) => {
            const meta = metaByKey.get(ex.key);
            if (!meta) return ex;
            return {
              ...ex,
              metaLoaded: true,
              thumbnailUrl: meta.thumbnailUrl ?? ex.thumbnailUrl,
              primaryMuscles: meta.primaryMuscles ?? ex.primaryMuscles,
            };
          }),
        });
        writeWorkoutSession(userId, date, next);
        return next;
      });
    };
    void loadMeta();
    return () => {
      cancelled = true;
    };
  }, [session.exercises, language, userId, date, normalizeSession]);

  const liveDurationSec =
    session.durationSec +
    (isToday && session.startedAt
      ? Math.floor((Date.now() - session.startedAt) / 1000)
      : 0);
  const stats = useMemo(() => sumSessionStats(session), [session, tick]);

  const updateExercise = (key: string, updater: (ex: WorkoutSessionExercise) => WorkoutSessionExercise) => {
    if (viewOnly) return;
    setSession((prev) => {
      const next = normalizeSession(
        ensureStarted({
          ...prev,
          exercises: prev.exercises.map((ex) => (ex.key === key ? updater(ex) : ex)),
        })
      );
      writeWorkoutSession(userId, date, next);
      return next;
    });
  };

  const finishWorkout = async () => {
    if (!userId || syncing || !canLogDay) return;
    setSyncing(true);
    setError(null);
    try {
      const finalDuration = liveDurationSec;
      const updatedExercises: WorkoutSessionExercise[] = [];

      for (const raw of session.exercises) {
        const payload = sessionExerciseToPayload(raw);

        if (raw.logId) {
          const res = await exerciseService.updateLog(raw.logId, {
            sets: payload.sets,
            reps: payload.reps,
            setDetails: payload.setDetails,
            userNotes: payload.userNotes,
            durationSec: finalDuration,
          });
          if (res.error) throw new Error(res.error);
          const best = payload.setDetails.find((s) => s.completed && s.kg != null && s.reps != null);
          if (raw.exerciseId && best) {
            writePreviousLabel(userId, raw.exerciseId, `${best.kg}kg x ${best.reps}`);
          }
          updatedExercises.push({ ...raw, logId: raw.logId });
          continue;
        }

        const res = await exerciseService.logPlanExercises({
          date,
          items: [
            {
              exerciseId: raw.exerciseId,
              name: raw.name,
              sets: payload.sets,
              reps: payload.reps,
              setDetails: payload.setDetails,
              userNotes: payload.userNotes,
              durationSec: finalDuration,
            },
          ],
        });
        if (res.error || !res.data?.logIds.length) throw new Error(res.error || 'Failed to log');
        const logId = res.data.logIds[0];
        const best = payload.setDetails.find((s) => s.completed && s.kg != null && s.reps != null);
        if (raw.exerciseId && best) {
          writePreviousLabel(userId, raw.exerciseId, `${best.kg}kg x ${best.reps}`);
        }
        updatedExercises.push({ ...raw, logId });
      }

      persist({
        ...session,
        exercises: updatedExercises,
        startedAt: null,
        durationSec: finalDuration,
      });
      await onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.editWorkoutSaveFailed'));
    } finally {
      setSyncing(false);
    }
  };

  const openWorkoutLibrary = () => {
    if (!userId || viewOnly) return;
    setWorkoutAddContext({
      date,
      isLogged: stats.completedSets > 0,
      userId,
      existingDraftItems: session.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        name: e.name,
        nameAr: e.nameAr,
        sets: resolveWorkoutSetCount(e.planSets ?? e.sets.length),
        reps: e.planReps ?? (Number(e.sets[0]?.reps) || 10),
      })),
    });
    markWorkoutEditReopen(date);
    navigate('/workouts');
  };

  if (loadingDay) {
    return (
      <div className="mt-3 flex min-h-[120px] items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/50">
        <p className="animate-pulse text-sm font-medium text-brand-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (isRestDay) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-6 text-center dark:border-gray-700 dark:bg-white/[0.03]">
        <span className="material-symbols-outlined text-3xl text-gray-400">bedtime</span>
        <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          {t('dashboard.restDay')}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {dayLabel
            ? t('dashboard.workoutRestDayDetail', { day: dayLabel })
            : t('dashboard.workoutRestDayGeneric')}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/50">
      {dayOffset !== 0 && dayLabel ? (
        <div
          className={cn(
            'border-b px-3 py-2 text-center text-xs font-semibold',
            dayOffset < 0
              ? 'border-gray-200 bg-gray-100/90 text-gray-600 dark:border-gray-700 dark:bg-white/[0.06] dark:text-gray-300'
              : 'border-brand-500/25 bg-brand-500/10 text-brand-700 dark:text-brand-300'
          )}
        >
          {dayOffset < 0
            ? t('dashboard.workoutViewingPast', { day: dayLabel })
            : t('dashboard.workoutViewingUpcoming', { day: dayLabel })}
          {!canLogDay ? (
            <span className="mt-0.5 block font-normal normal-case text-[10px] opacity-90">
              {isFutureDay ? t('dashboard.futureDayEditNoCheck') : t('dashboard.planViewOnlyHint')}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="border-b border-gray-200 px-3 py-2.5 dark:border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
              {t('dashboard.logWorkout')}
            </h2>
            {editingTitle ? (
              <input
                type="text"
                value={titleDraft}
                autoFocus
                maxLength={80}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => commitTitleEdit()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTitleEdit();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                className="mt-1 w-full max-w-xs rounded-lg border border-brand-500/40 bg-white px-2 py-1 text-sm font-semibold text-gray-800 outline-none focus:border-brand-500 dark:bg-gray-900 dark:text-white"
                aria-label={t('dashboard.changeWorkoutTitle')}
              />
            ) : (
              <button
                type="button"
                onClick={startTitleEdit}
                disabled={viewOnly}
                className={cn(
                  'mt-1 inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300',
                  viewOnly && 'cursor-default opacity-70 hover:text-brand-600 dark:hover:text-brand-400'
                )}
                title={viewOnly ? t('dashboard.planViewOnlyHint') : t('dashboard.changeWorkoutTitle')}
              >
                <span className="truncate">{displayWorkoutTitle}</span>
                <span className="material-symbols-outlined shrink-0 text-base">edit</span>
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="material-symbols-outlined text-brand-500 text-lg">timer</span>
            <button
              type="button"
              disabled={syncing || !canLogDay}
              title={!canLogDay ? (isFutureDay ? t('dashboard.futureDayEditNoCheck') : t('dashboard.planViewOnlyHint')) : undefined}
              onClick={() => void finishWorkout()}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-white hover:brightness-110 disabled:opacity-60"
            >
              {syncing ? t('common.loading') : t('dashboard.workoutFinish')}
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-end gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              {t('dashboard.workoutDuration')}
            </p>
            <p className="text-sm font-bold text-brand-600 tabular-nums dark:text-brand-400">
              {formatDuration(liveDurationSec)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              {t('dashboard.workoutSets')}
            </p>
            <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{stats.completedSets}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3">
          {error ? <p className="text-xs font-medium text-error-500">{error}</p> : null}

          {session.exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.key}
              exercise={exercise}
              resolveName={resolveName}
              activeSetId={activeSetId}
              disabled={syncing || viewOnly}
              onActiveSet={setActiveSetId}
              onChangeSet={(setId, patch) =>
                updateExercise(exercise.key, (e) => ({
                  ...e,
                  sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
                }))
              }
              onToggleComplete={(setId) =>
                updateExercise(exercise.key, (e) => ({
                  ...e,
                  sets: e.sets.map((s) =>
                    s.id === setId ? { ...s, completed: !s.completed } : s
                  ),
                }))
              }
              onRemoveSet={(setId) =>
                updateExercise(exercise.key, (e) => ({
                  ...e,
                  sets: e.sets.length > 1 ? e.sets.filter((s) => s.id !== setId) : e.sets,
                }))
              }
              onAddSet={() =>
                updateExercise(exercise.key, (e) => ({
                  ...e,
                  sets: [...e.sets, ...createDefaultSets(1, e.planReps)],
                }))
              }
              onRemove={() =>
                persist(
                  ensureStarted({
                    ...session,
                    exercises: session.exercises.filter((e) => e.key !== exercise.key),
                  })
                )
              }
              onDetails={() => void openExerciseDetails(exercise)}
              detailsLoading={detailLoading}
            />
          ))}

          <button
            type="button"
            disabled={syncing || viewOnly}
            onClick={openWorkoutLibrary}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-500/35 py-2.5 text-xs font-semibold text-brand-600 dark:text-brand-400"
          >
            <span className="material-symbols-outlined text-base">add</span>
            {t('dashboard.addFromWorkouts')}
        </button>
      </div>

      <AnimatePresence>
        {detailExercise ? (
          <ExerciseDetailModal exercise={detailExercise} onClose={() => setDetailExercise(null)} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
