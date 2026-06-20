import type { AthleteHomeDashboard } from '../../services/dashboardService';
import type { TranslationKey } from '../../lib/i18n/translations';
import { readWaterBoostMl, resolveSleepWindow } from './wellnessWidgets';
import { readWorkoutSession, sumSessionStats } from './workoutSessionStore';
import { readLiveDietTotals } from './liveDashboardTotals';

export type FitnessPillarId = 'sleep' | 'meals' | 'water' | 'workout';

const PILLAR_WEIGHTS = {
  sleep: 20,
  meals: 30,
  water: 20,
  workout: 30,
} as const;

export const FITNESS_PILLAR_MAX_POINTS: Record<FitnessPillarId, number> = PILLAR_WEIGHTS;
const SLEEP_MIN_HOURS = 6;
const SLEEP_MAX_HOURS = 11;
const CALORIE_TOLERANCE = 300;
/** kcal beyond tolerance before meal pillar progress reaches 0 */
const CALORIE_PENALTY_RANGE = 600;

export type FitnessPillar = {
  id: FitnessPillarId;
  labelKey: TranslationKey;
  /** 0–1 completion for this pillar */
  progress: number;
  /** Points earned toward daily score (0–pillar weight) */
  points: number;
  /** True when pillar is fully complete */
  met: boolean;
  icon: string;
  detail: string;
};

export type FitnessScoreResult = {
  score: number;
  pillars: FitnessPillar[];
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Planned rest day — workout pillar and completion KPI treat as 100% without logging. */
export function isRestDayForDate(data: AthleteHomeDashboard, dateKey: string): boolean {
  if (dateKey === data.today.date) {
    return Boolean(data.todayWorkout?.isRest ?? data.analytics?.todayWorkoutPlan?.isRest);
  }
  const weekDay = data.analytics?.weekPlan?.find((d) => d.date === dateKey);
  return weekDay?.status === 'rest';
}

function caloriesForDate(
  data: AthleteHomeDashboard,
  dateKey: string,
  userId?: string,
  todayMealCalories?: number | null
): number {
  if (dateKey === data.today.date) {
    if (todayMealCalories != null) return todayMealCalories;
    const live = readLiveDietTotals(userId, dateKey);
    if (live != null) return live.calories;
    return data.today.nutrition.calories;
  }
  return data.weekly.find((d) => d.date === dateKey)?.caloriesEaten ?? 0;
}

/** 1 when within ±CALORIE_TOLERANCE of target; decays when farther (over or under). */
export function mealProgressFromCalories(eaten: number, target: number): number {
  if (eaten <= 0 || target <= 0) return 0;
  const deviation = Math.abs(eaten - target);
  if (deviation <= CALORIE_TOLERANCE) return 1;
  const excess = deviation - CALORIE_TOLERANCE;
  return clamp01(1 - excess / CALORIE_PENALTY_RANGE);
}

/** Full credit between SLEEP_MIN_HOURS and SLEEP_MAX_HOURS; penalized outside. */
export function sleepProgressFromHours(hours: number): number {
  if (hours >= SLEEP_MIN_HOURS && hours <= SLEEP_MAX_HOURS) return 1;
  if (hours < SLEEP_MIN_HOURS) return clamp01((hours / SLEEP_MIN_HOURS) * 0.75);
  const excess = hours - SLEEP_MAX_HOURS;
  return clamp01(1 - excess / 4);
}

function localWorkoutProgress(userId: string | undefined, dateKey: string): number {
  const session = readWorkoutSession(userId, dateKey);
  if (!session?.exercises?.length) return 0;
  let totalSets = 0;
  for (const ex of session.exercises) {
    totalSets += ex.sets.length;
  }
  if (totalSets === 0) return 0;
  const { completedSets } = sumSessionStats(session);
  return clamp01(completedSets / totalSets);
}

function workoutProgressForDate(
  data: AthleteHomeDashboard,
  userId: string | undefined,
  dateKey: string
): number {
  if (isRestDayForDate(data, dateKey)) return 1;

  const isToday = dateKey === data.today.date;
  const localProg = isToday ? localWorkoutProgress(userId, dateKey) : 0;

  if (isToday) {
    const apiPct = data.analytics?.workoutCompletionToday;
    const hasServerLog =
      data.today.workouts.length > 0 || Boolean(data.analytics?.todayWorkoutPlan?.hasLoggedToday);
    if (apiPct != null && hasServerLog) {
      return clamp01(apiPct / 100);
    }
    if (localProg > 0) return localProg;
    return apiPct != null ? clamp01(apiPct / 100) : 0;
  }

  const weeklyDay = data.weekly.find((d) => d.date === dateKey);
  if (weeklyDay && weeklyDay.workouts > 0) return 1;

  const heat = data.heatmap?.find((h) => h.date === dateKey);
  if (heat && heat.workouts > 0) return 1;

  const session = readWorkoutSession(userId, dateKey);
  if (!session?.exercises?.length) return 0;

  let totalSets = 0;
  for (const ex of session.exercises) {
    totalSets += ex.sets.length;
  }
  if (totalSets === 0) return 0;

  const { completedSets } = sumSessionStats(session);
  return clamp01(completedSets / totalSets);
}

function buildFitnessPillars(
  data: AthleteHomeDashboard,
  dateKey: string,
  options: {
    userId?: string;
    sleepPreference?: string | null;
    t: (key: TranslationKey, params?: Record<string, string>) => string;
    /** My logs meal-slot calories for today (matches Calories KPI). */
    todayMealCalories?: number | null;
  }
): FitnessPillar[] {
  const { userId, sleepPreference, t, todayMealCalories } = options;
  const isToday = dateKey === data.today.date;

  const sleepWindow = resolveSleepWindow(sleepPreference, userId);
  const sleepHours = sleepWindow.hours;
  const sleepProgress = sleepProgressFromHours(sleepHours);
  const sleepInRange = sleepHours >= SLEEP_MIN_HOURS && sleepHours <= SLEEP_MAX_HOURS;

  const calorieTarget = data.targets.calorieTarget;
  const caloriesEaten = caloriesForDate(data, dateKey, userId, todayMealCalories);
  const calorieDeviation = Math.abs(caloriesEaten - calorieTarget);
  const mealsProgress = mealProgressFromCalories(caloriesEaten, calorieTarget);
  const mealsOnTarget =
    caloriesEaten > 0 && calorieTarget > 0 && calorieDeviation <= CALORIE_TOLERANCE;

  const waterTarget =
    data.analytics?.dietToday?.water.targetMl ??
    data.personalization?.waterTargetMl ??
    2500;
  const waterBase = isToday ? (data.analytics?.dietToday?.water.currentMl ?? 0) : 0;
  const waterBoost = readWaterBoostMl(userId, dateKey);
  const waterCurrent = waterBase + waterBoost;
  const waterProgress = waterTarget > 0 ? clamp01(waterCurrent / waterTarget) : 0;

  const workoutProg = workoutProgressForDate(data, userId, dateKey);
  const isRestDay = isRestDayForDate(data, dateKey);

  return [
    {
      id: 'sleep',
      labelKey: 'dashboard.fitnessPillarSleep',
      progress: sleepProgress,
      points: sleepProgress * PILLAR_WEIGHTS.sleep,
      met: sleepInRange,
      icon: 'bedtime',
      detail: sleepInRange
        ? t('dashboard.fitnessPillarSleepInRange', {
            hours: String(sleepHours),
            min: String(SLEEP_MIN_HOURS),
            max: String(SLEEP_MAX_HOURS),
          })
        : sleepHours < SLEEP_MIN_HOURS
          ? t('dashboard.fitnessPillarSleepBelow', {
              hours: String(sleepHours),
              min: String(SLEEP_MIN_HOURS),
            })
          : t('dashboard.fitnessPillarSleepAbove', {
              hours: String(sleepHours),
              max: String(SLEEP_MAX_HOURS),
            }),
    },
    {
      id: 'meals',
      labelKey: 'dashboard.fitnessPillarMeals',
      progress: mealsProgress,
      points: mealsProgress * PILLAR_WEIGHTS.meals,
      met: mealsOnTarget,
      icon: 'restaurant',
      detail:
        caloriesEaten <= 0
          ? t('dashboard.fitnessPillarMealsNone')
          : mealsOnTarget
            ? t('dashboard.fitnessPillarMealsCalorieOk', {
                current: String(Math.round(caloriesEaten)),
                target: String(Math.round(calorieTarget)),
              })
            : caloriesEaten > calorieTarget
              ? t('dashboard.fitnessPillarMealsCalorieOver', {
                  current: String(Math.round(caloriesEaten)),
                  target: String(Math.round(calorieTarget)),
                  delta: String(Math.round(calorieDeviation)),
                })
              : t('dashboard.fitnessPillarMealsCalorieUnder', {
                  current: String(Math.round(caloriesEaten)),
                  target: String(Math.round(calorieTarget)),
                  delta: String(Math.round(calorieDeviation)),
                }),
    },
    {
      id: 'water',
      labelKey: 'dashboard.fitnessPillarWater',
      progress: waterProgress,
      points: waterProgress * PILLAR_WEIGHTS.water,
      met: waterProgress >= 1,
      icon: 'water_drop',
      detail: t('dashboard.fitnessPillarWaterDetail', {
        current: String(Math.round(waterCurrent)),
        target: String(Math.round(waterTarget)),
      }),
    },
    {
      id: 'workout',
      labelKey: 'dashboard.fitnessPillarWorkout',
      progress: workoutProg,
      points: workoutProg * PILLAR_WEIGHTS.workout,
      met: Math.round(workoutProg * 100) >= 100,
      icon: 'fitness_center',
      detail: isRestDay
        ? t('dashboard.fitnessPillarWorkoutRest')
        : Math.round(workoutProg * 100) >= 100
          ? t('dashboard.fitnessPillarWorkoutDone')
          : workoutProg > 0
            ? t('dashboard.fitnessPillarWorkoutPartial', {
                percent: String(Math.round(workoutProg * 100)),
              })
            : t('dashboard.fitnessPillarWorkoutPending'),
    },
  ];
}

export function computeFitnessScoreBreakdownForDate(
  data: AthleteHomeDashboard,
  date: string,
  options: {
    userId?: string;
    sleepPreference?: string | null;
    t: (key: TranslationKey, params?: Record<string, string>) => string;
    todayMealCalories?: number | null;
  }
): FitnessScoreResult {
  const pillars = buildFitnessPillars(data, date, options);
  const score = Math.round(pillars.reduce((sum, pillar) => sum + pillar.points, 0));
  return { score, pillars };
}

export function computeFitnessScore(
  data: AthleteHomeDashboard,
  options: {
    userId?: string;
    sleepPreference?: string | null;
    t: (key: TranslationKey, params?: Record<string, string>) => string;
    todayMealCalories?: number | null;
  }
): FitnessScoreResult {
  const { userId } = options;
  const dateKey = data.today.date;
  const result = computeFitnessScoreBreakdownForDate(data, dateKey, options);
  writeFitnessScoreSnapshot(userId, dateKey, result.score);
  return result;
}

export function scoreFromPillarProgress(progress: {
  sleep: number;
  meals: number;
  water: number;
  workout: number;
}): number {
  return Math.round(
    clamp01(progress.sleep) * PILLAR_WEIGHTS.sleep +
      clamp01(progress.meals) * PILLAR_WEIGHTS.meals +
      clamp01(progress.water) * PILLAR_WEIGHTS.water +
      clamp01(progress.workout) * PILLAR_WEIGHTS.workout
  );
}

const FITNESS_SNAP_PREFIX = 'taqwin-fitness-score-snap';

export function writeFitnessScoreSnapshot(
  userId: string | undefined,
  date: string,
  score: number
) {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${FITNESS_SNAP_PREFIX}:${userId}:${date}`, String(score));
  } catch {
    /* ignore */
  }
}

export function readFitnessScoreSnapshot(
  userId: string | undefined,
  date: string
): number | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${FITNESS_SNAP_PREFIX}:${userId}:${date}`);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : null;
  } catch {
    return null;
  }
}

export function computeFitnessScoreForDate(
  data: AthleteHomeDashboard,
  date: string,
  options: {
    userId?: string;
    sleepPreference?: string | null;
    t?: (key: TranslationKey, params?: Record<string, string>) => string;
  }
): number {
  const { userId, sleepPreference, t } = options;
  const snapshot = readFitnessScoreSnapshot(userId, date);
  if (snapshot != null && !t) return snapshot;

  if (t) {
    return computeFitnessScoreBreakdownForDate(data, date, { userId, sleepPreference, t }).score;
  }

  const sleepWindow = resolveSleepWindow(sleepPreference, userId);
  const sleepProg = sleepProgressFromHours(sleepWindow.hours);

  const mealsProg = mealProgressFromCalories(
    caloriesForDate(data, date, userId),
    data.targets.calorieTarget
  );

  const waterTarget =
    data.analytics?.dietToday?.water.targetMl ??
    data.personalization?.waterTargetMl ??
    2500;
  const waterBoost = readWaterBoostMl(userId, date);
  const waterProg = waterTarget > 0 ? clamp01(waterBoost / waterTarget) : 0;

  const workoutProg = workoutProgressForDate(data, userId, date);

  return scoreFromPillarProgress({
    sleep: sleepProg,
    meals: mealsProg,
    water: waterProg,
    workout: workoutProg,
  });
}
