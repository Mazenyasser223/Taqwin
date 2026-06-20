import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import exerciseService, {
  type TodayWorkoutExercise,
} from '../../services/exerciseService';
import plansService from '../../services/plansService';
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
  createEmptyWorkoutSession,
  formatDuration,
  initSessionFromPlan,
  isUntouchedPlanPrefill,
  mergeInProgressLocalSession,
  pickWorkoutSessionForDay,
  readWorkoutSession,
  resolveWorkoutSetCount,
  sessionForCalendarDay,
  sessionFromExerciseLogs,
  sessionExerciseToPayload,
  sumSessionStats,
  persistPersonalRecordsAfterWorkout,
  syncExercisePersonalRecordsFromLogs,
  applyPersonalRecordLabelsToSession,
  writeWorkoutSession,
  type WorkoutSession,
  type WorkoutSessionExercise,
} from './workoutSessionStore';
import { canLogPlanDate, isFuturePlanDate, isViewOnlyPlanDate } from './weekPlanNavigation';
import { emitWellnessChanged } from './wellnessWidgets';
import type { PlanViewMode } from './PlanViewModeToggle';
import { requestPlanLogsView } from './planViewMode';
import { materializeWorkoutSessionToLogs } from './materializePlanToLogs';
import { scheduleIdleTask } from '../../lib/scheduleIdle';

const FALLBACK_THUMB =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=200';

function ExerciseSetTableReadOnly({ exercise }: { exercise: WorkoutSessionExercise }) {
  const { t } = useI18n();

  return (
    <div className="mt-2.5">
      <div className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        <span>{t('dashboard.workoutColSet')}</span>
        <span>{t('dashboard.workoutColBest')}</span>
        <span className="text-right">{t('dashboard.workoutColPrevious')}</span>
      </div>
      <ul className="mt-1 space-y-0.5">
        {exercise.sets.map((set, index) => (
          <li
            key={set.id}
            className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-0.5 py-0.5"
          >
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{index + 1}</span>
            <span className="truncate text-[11px] font-semibold text-brand-600 dark:text-brand-400">
              {set.bestLabel ?? '—'}
            </span>
            <span className="truncate text-right text-[11px] font-semibold text-brand-600 dark:text-brand-400">
              {set.previousLabel ?? '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExerciseCard({
  exercise,
  resolveName,
  onDetails,
  detailsLoading,
}: {
  exercise: WorkoutSessionExercise;
  resolveName: (ex: WorkoutSessionExercise) => string;
  onDetails?: () => void;
  detailsLoading?: boolean;
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
            <h5 className="truncate text-sm font-bold text-brand-600 dark:text-brand-400">
              {resolveName(exercise)}
            </h5>
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
      </div>

      <ExerciseSetTableReadOnly exercise={exercise} />
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
  viewMode = 'ai',
  onRequestViewMode,
  onRefresh,
}: {
  workoutPlan: { title: string; durationMin: number; hasLoggedToday: boolean };
  plannedExercises: TodayWorkoutExercise[];
  date: string;
  todayKey: string;
  dayLabel?: string;
  isRestDay?: boolean;
  userId?: string;
  viewMode?: PlanViewMode;
  onRequestViewMode?: (mode: PlanViewMode) => void;
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
  const [syncing, setSyncing] = useState(false);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routineSaveMessage, setRoutineSaveMessage] = useState<string | null>(null);
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
  const isAiView = viewMode === 'ai';
  const interactionDisabled = viewOnly || isAiView;

  const plannedPlanKey = useMemo(
    () => plannedExercises.map((e) => `${e.exerciseId ?? ''}:${e.name}:${e.sets}:${e.reps}`).join('|'),
    [plannedExercises]
  );

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
    if (interactionDisabled) return;
    setTitleDraft(displayWorkoutTitle);
    setEditingTitle(true);
  };

  const commitTitleEdit = () => {
    if (interactionDisabled) {
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
    setRoutineSaveMessage(null);

    const hydrateFromLocalOrPlan = () => {
      if (isRestDay) {
        setSession(createEmptyWorkoutSession());
        return;
      }
      if (isAiView) {
        if (plannedExercises.length > 0) {
          setSession(
            normalizeSession(
              initSessionFromPlan(userId, date, plannedExercises, undefined, defaultWorkoutTitle)
            )
          );
        } else {
          setSession(createEmptyWorkoutSession(defaultWorkoutTitle));
        }
        return;
      }
      const local = readWorkoutSession(userId, date);
      if (local?.exercises?.length) {
        setSession(normalizeSession(local));
      } else if (plannedExercises.length > 0) {
        setSession(
          normalizeSession(
            initSessionFromPlan(userId, date, plannedExercises, local ?? undefined, defaultWorkoutTitle)
          )
        );
      }
    };

    hydrateFromLocalOrPlan();

    const loadDay = async () => {
      if (isRestDay) {
        if (!cancelled) setLoadingDay(false);
        return;
      }
      if (isAiView) {
        if (!cancelled) setLoadingDay(false);
        return;
      }

      try {
        const res = await exerciseService.getMyLogs(date);
        if (cancelled) return;

        if (res.error) {
          setError(res.error);
          const local = readWorkoutSession(userId, date);
          if (local?.exercises?.length) {
            setSession(normalizeSession(local));
          } else if (plannedExercises.length > 0) {
            setSession(
              normalizeSession(
                initSessionFromPlan(userId, date, plannedExercises, local ?? undefined, defaultWorkoutTitle)
              )
            );
          } else {
            setSession(createEmptyWorkoutSession(local?.workoutTitle ?? defaultWorkoutTitle));
          }
          return;
        }

        const local = readWorkoutSession(userId, date);
        const apiLogs = res.data ?? [];
        if (userId && apiLogs.length > 0) {
          syncExercisePersonalRecordsFromLogs(userId, apiLogs, date);
        }
        const hasApiLogs = apiLogs.length > 0;

        let loaded: WorkoutSession;
        if (hasApiLogs) {
          const fromApi = sessionFromExerciseLogs(apiLogs, userId);
          loaded = pickWorkoutSessionForDay(fromApi, local);
        } else if (local?.exercises?.length && !isUntouchedPlanPrefill(local)) {
          loaded = local;
        } else if (plannedExercises.length > 0) {
          loaded = initSessionFromPlan(
            userId,
            date,
            plannedExercises,
            local ?? undefined,
            defaultWorkoutTitle
          );
        } else {
          loaded = createEmptyWorkoutSession(local?.workoutTitle ?? defaultWorkoutTitle);
        }

        let normalized = normalizeSession(
          mergeInProgressLocalSession(
            applyPersonalRecordLabelsToSession(loaded, userId),
            readWorkoutSession(userId, date),
            date,
            todayKey
          )
        );
        writeWorkoutSession(userId, date, normalized);
        setSession(normalized);

        const needsMaterialize =
          canLogDay &&
          normalized.exercises.length > 0 &&
          normalized.exercises.some((e) => !e.logId);

        if (needsMaterialize) {
          scheduleIdleTask(() => {
            if (cancelled) return;
            void materializeWorkoutSessionToLogs(date, normalized).then((materialized) => {
              if (cancelled) return;
              const local = readWorkoutSession(userId, date);
              const next = normalizeSession(
                mergeInProgressLocalSession(materialized, local, date, todayKey)
              );
              writeWorkoutSession(userId, date, next);
              setSession(next);
            });
          });
        }
      } finally {
        if (!cancelled) setLoadingDay(false);
      }
    };

    void loadDay();
    return () => {
      cancelled = true;
    };
  }, [date, todayKey, userId, isRestDay, isAiView, normalizeSession, plannedPlanKey, defaultWorkoutTitle, viewMode]);

  useEffect(() => {
    if (isAiView) return;
    const onSessionChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ date?: string }>).detail;
      if (detail?.date !== date || !userId) return;
      const local = readWorkoutSession(userId, date);
      if (!local?.exercises?.length) return;
      setSession(normalizeSession(local));
    };
    window.addEventListener('taqwin-workout-session-changed', onSessionChanged);
    return () => window.removeEventListener('taqwin-workout-session-changed', onSessionChanged);
  }, [date, userId, normalizeSession, isAiView]);

  useEffect(() => {
    if (isAiView) return;
    const reopen = consumeWorkoutEditReopen();
    if (!reopen || reopen.date !== date) return;
    const existing = readWorkoutSession(userId, date);
    const next = existing
      ? normalizeSession(existing)
      : normalizeSession(createEmptyWorkoutSession());
    setSession(next);
    writeWorkoutSession(userId, date, next);
  }, [date, userId, normalizeSession, todayKey, isAiView]);

  useEffect(() => {
    if (isAiView) return;
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

  useEffect(() => {
    if (loadingDay || isRestDay || isAiView || !isToday || !canLogDay || viewOnly) return;
    if (session.exercises.length === 0 || session.startedAt) return;
    persist(ensureStarted(session));
  }, [
    loadingDay,
    isRestDay,
    isAiView,
    isToday,
    canLogDay,
    viewOnly,
    session.exercises.length,
    session.startedAt,
    persist,
    ensureStarted,
    session,
  ]);

  const liveDurationSec = useMemo(() => {
    void tick;
    return (
      session.durationSec +
      (isToday && session.startedAt ? Math.floor((Date.now() - session.startedAt) / 1000) : 0)
    );
  }, [session.durationSec, session.startedAt, isToday, tick]);
  const stats = useMemo(() => sumSessionStats(session), [session, tick]);

  const finishWorkout = async () => {
    if (!userId || syncing || !canLogDay) return;
    setSyncing(true);
    setError(null);
    const finalDuration = liveDurationSec;
    const snapshot = session;

    persist({
      ...snapshot,
      startedAt: null,
      durationSec: finalDuration,
    });
    emitWellnessChanged();
    requestPlanLogsView();
    setSyncing(false);
    void onRefresh?.();

    void (async () => {
      try {
        const updatedExercises: WorkoutSessionExercise[] = [];

        for (const raw of snapshot.exercises) {
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
            persistPersonalRecordsAfterWorkout(userId, raw.exerciseId, payload.setDetails);
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
          persistPersonalRecordsAfterWorkout(userId, raw.exerciseId, payload.setDetails);
          updatedExercises.push({ ...raw, logId });
        }

        persist({
          ...snapshot,
          exercises: updatedExercises,
          startedAt: null,
          durationSec: finalDuration,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t('dashboard.editWorkoutSaveFailed'));
      }
    })();
  };

  const openWorkoutLibrary = () => {
    if (!userId || interactionDisabled) return;
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
    requestPlanLogsView();
    navigate('/workouts');
  };

  const saveRoutineDay = async () => {
    const exercises = session.exercises.filter((exercise) => exercise.exerciseId);
    if (!exercises.length || savingRoutine) return;
    const name =
      typeof window !== 'undefined'
        ? window.prompt('Routine name', displayWorkoutTitle)
        : displayWorkoutTitle;
    if (!name?.trim()) return;
    setSavingRoutine(true);
    setError(null);
    setRoutineSaveMessage(null);
    const res = await plansService.createRoutine({
      name: name.trim(),
      focus: displayWorkoutTitle,
      sourceDate: date,
      exercises: exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId!,
        sets: exercise.planSets ?? exercise.sets.length,
        reps: exercise.planReps ?? (Number.parseInt(exercise.sets[0]?.reps || '10', 10) || 10),
        restSec: exercise.restTimerSec,
        notes: exercise.notes || null,
      })),
    });
    setSavingRoutine(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setRoutineSaveMessage(`${res.data?.name ?? name.trim()} · ${t('dashboard.routineSaved')}`);
    setTimeout(() => setRoutineSaveMessage(null), 3000);
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
      <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/50">
        <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50/80 px-6 py-10 text-center dark:from-white/[0.03] dark:via-gray-900/40 dark:to-white/[0.02]">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
            <span className="material-symbols-outlined text-3xl text-gray-400">spa</span>
          </div>
          <p className="mt-4 text-base font-semibold text-gray-800 dark:text-gray-100">
            {t('dashboard.planDayStatusRest')}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            {dayLabel
              ? t('dashboard.workoutRestDayDetail', { day: dayLabel })
              : t('dashboard.workoutRestDayGeneric')}
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-gray-400 dark:text-gray-500">
            {t('dashboard.workoutRestRecoveryHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/50">
      {routineSaveMessage ? (
        <div
          role="status"
          className="absolute right-3 top-3 z-10 flex max-w-[min(100%-1.5rem,20rem)] items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm dark:text-emerald-300"
        >
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span className="truncate">{routineSaveMessage}</span>
        </div>
      ) : null}
      <div className="border-b border-gray-200 px-3 py-2.5 dark:border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
              {isAiView ? t('dashboard.todayWorkout') : t('dashboard.logWorkout')}
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
              isAiView ? (
                <p className="mt-1 truncate text-sm font-semibold text-brand-600 dark:text-brand-400">
                  {displayWorkoutTitle}
                </p>
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
              )
            )}
          </div>
          {!isAiView ? (
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
          ) : null}
        </div>

        {!isAiView ? (
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
        ) : null}
      </div>

      <div className="space-y-3 p-3">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
              <span className="material-symbols-outlined shrink-0 text-base">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {session.exercises.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-8 text-center dark:border-gray-700 dark:bg-white/[0.02]">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-brand-500/10">
                <span className="material-symbols-outlined text-2xl text-brand-600 dark:text-brand-400">
                  {isAiView ? 'auto_awesome' : 'history'}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {isAiView ? t('dashboard.workoutEmptyTitle') : t('dashboard.planViewLogsEmptyWorkout')}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {isAiView ? t('dashboard.workoutEmptyHintAi') : t('dashboard.planViewSwitchToLogs')}
              </p>
              {!isAiView && onRequestViewMode ? (
                <button
                  type="button"
                  onClick={() => onRequestViewMode('ai')}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-500/5 px-3 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-500/10 dark:text-brand-400"
                >
                  <span className="material-symbols-outlined text-base">auto_awesome</span>
                  {t('dashboard.planViewSwitchToAi')}
                </button>
              ) : null}
            </div>
          ) : null}

          {session.exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.key}
              exercise={exercise}
              resolveName={resolveName}
              onDetails={() => void openExerciseDetails(exercise)}
              detailsLoading={detailLoading}
            />
          ))}

          {!isAiView ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={syncing || viewOnly}
              onClick={openWorkoutLibrary}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:brightness-110 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">add</span>
              {t('dashboard.addFromWorkouts')}
            </button>
            <button
              type="button"
              disabled={syncing || viewOnly || savingRoutine || session.exercises.length === 0}
              onClick={() => void saveRoutineDay()}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:border-brand-500/35 hover:text-brand-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:text-brand-400"
            >
              <span className="material-symbols-outlined text-base">bookmark_add</span>
              {savingRoutine ? t('dashboard.savingRoutine') : t('dashboard.saveToRoutineLibrary')}
            </button>
          </div>
          ) : onRequestViewMode ? (
            <button
              type="button"
              onClick={() => onRequestViewMode('logs')}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-500/35 bg-brand-500/5 px-4 py-2.5 text-xs font-semibold text-brand-600 hover:bg-brand-500/10 dark:text-brand-400"
            >
              <span className="material-symbols-outlined text-base">history</span>
              {t('dashboard.planViewSwitchToLogs')}
            </button>
          ) : null}
      </div>

      <AnimatePresence>
        {detailExercise ? (
          <ExerciseDetailModal exercise={detailExercise} onClose={() => setDetailExercise(null)} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
