import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import dashboardService, {
  type AthleteHomeDashboard,
  type AthletePersonalization,
} from '../../../services/dashboardService';
import nutritionService, { type PlanMealLogItem } from '../../../services/nutritionService';
import gymService from '../../../services/gymService';
import type { FoodLog, GymMembership, User } from '../../../types';
import { Badge } from '../../../components/tailadmin/Badge';
import { cn } from '../../../lib/cn';
import type { TranslationKey } from '../../../lib/i18n/translations';
import {
  formatFitnessLevel,
  formatMinutesShort,
  formatTimelineSubtitle,
  formatWeekdayLabel,
  localeTag,
  localizeActivityType,
} from '../dashboardLocale';
import { localizeOnboardingDisplayValue, localizePersonalizationChipLabel } from '../../onboarding/localizeOnboardingDisplay';
import { resolveExerciseDisplayName } from '../../workouts/exerciseLocale';
import { WorkoutExerciseChecklist } from '../WorkoutExerciseChecklist';
import { MealSlotInlineEditor, type MealEditEntry } from '../MealSlotInlineEditor';
import { mealEntryHasDetails, mealEntryToNutritionRow } from '../mealEntryDetails';
import { PlanItemInfoButton } from '../PlanItemInfoButton';
import { NutritionDetailsModal } from '../../nutrition/NutritionDetailsModal';
import type { NutritionFoodRow } from '../../nutrition/NutritionFoodList';
import {
  consumeMealEditReopen,
  markMealEditReopen,
  setMealAddContext,
  setMealPlanSlotsContext,
} from '../mealAddContext';
import { MealSlotPickerModal } from '../MealSlotPickerModal';
import { entryKcal, macrosFromPer100, planItemToPer100, sumEntryMacros, type MacrosPer100 } from '../mealEntryMacros';
import {
  buildVisibleWeekPlan,
  formatWeekRangeLabel,
  sameWeekdayInWeek,
  buildRollingWeekDays,
  canShiftWeekOffset,
  canEditPlanDate,
  canLogPlanDate,
  isBeforeSignupDate,
  isFuturePlanDate,
  isViewOnlyPlanDate,
  maxFutureWeekOffset,
  minPastWeekOffset,
} from '../weekPlanNavigation';
import { useCalendarTodayKey } from '../useCalendarTodayKey';
import {
  formatDashboardAlertText,
  isAiSummaryMarkedRead,
  isDashboardAlertCritical,
  toggleAiSummaryMarkedRead,
  resolveDashboardAiAlerts,
  type DashboardAiAlert,
  type DashboardAiAlertsPayload,
} from '../aiAlerts';
import { CaloriesKpiFlipCard } from '../CaloriesKpiFlipCard';
import { CurrentWeightKpiCard } from '../CurrentWeightKpiCard';
import { FitnessScoreKpiCard } from '../FitnessScoreKpiCard';
import { WorkoutCompletionKpiCard } from '../WorkoutCompletionKpiCard';
import { computeFitnessScore } from '../fitnessScore';
import { SleepRhythmCard } from '../SleepRhythmCard';
import {
  addWaterBoostMl,
  readWaterBoostMl,
  useWellnessRevision,
  emitWellnessChanged,
} from '../wellnessWidgets';

const CARD =
  'rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]';

const BRAND = '#158b8d';

const RECOMMENDATION_SECTION =
  'border-emerald-500/35 bg-gradient-to-br from-emerald-500/12 via-emerald-500/6 to-transparent dark:border-emerald-500/40 dark:from-emerald-950/40 dark:via-emerald-950/25 dark:to-transparent';
const ALERT_SECTION =
  'border-red-500/40 bg-gradient-to-br from-red-500/14 via-red-500/8 to-red-950/5 dark:border-red-500/45 dark:from-red-950/45 dark:via-red-950/30 dark:to-red-950/15';
const READ_SECTION =
  'border-[#f37021]/45 bg-gradient-to-br from-[#f37021]/16 via-[#f37021]/8 to-transparent dark:border-[#f37021]/50 dark:from-orange-950/40 dark:via-orange-950/25 dark:to-transparent';

type Analytics = NonNullable<AthleteHomeDashboard['analytics']>;

function personalizationFallback(data: AthleteHomeDashboard): AthletePersonalization {
  if (data.personalization) return data.personalization;
  const goal = data.profile.fitnessGoal;
  return {
    goal,
    goalLabel: goal,
    trainingDaysPerWeek: 4,
    preferredSplit: null,
    preferredSplitRaw: null,
    workoutDurationMin: 45,
    workoutLocation: null,
    workoutTime: null,
    dietType: null,
    mealsPerDay: null,
    sleep: null,
    sleepLabel: null,
    waterTargetMl: 2500,
    injuries: [],
    bodyFocus: [],
    fitnessLevel: data.profile.fitnessLevel,
    targetWeight: null,
    chips: goal ? [{ icon: 'flag', label: goal }] : [],
    planTitle: goal ? `${goal} session` : 'Training session',
  };
}

function buildAnalyticsFallback(data: AthleteHomeDashboard): Analytics {
  const calorieAdherenceToday =
    data.targets.calorieTarget > 0
      ? Math.round((data.today.nutrition.calories / data.targets.calorieTarget) * 100)
      : 0;
  const proteinAdherenceToday =
    data.targets.proteinTarget > 0
      ? Math.round((data.today.nutrition.protein / data.targets.proteinTarget) * 100)
      : 0;
  const workoutDaysWeek = data.weekly.filter((d) => d.workouts > 0).length;
  const baseWeight = data.profile.weight;
  const weightTrend = data.weekly.map((d, i) => ({
    label: d.day,
    weight:
      baseWeight != null
        ? Math.round((baseWeight - (6 - i) * 0.2) * 10) / 10
        : null,
  }));
  return {
    calorieAdherenceToday,
    proteinAdherenceToday,
    workoutCompletionWeek: Math.round((workoutDaysWeek / 7) * 100),
    workoutCompletionToday: 0,
    weightLog: [],
    weightDeltaWeek: 0,
    bodyScore: data.today.readinessScore,
    weightTrend,
    weeklyAdherence: {
      categories: ['Workout', 'Calories', 'Protein', 'Activity', 'Consistency'],
      values: [
        Math.round((workoutDaysWeek / 7) * 100),
        calorieAdherenceToday,
        proteinAdherenceToday,
        Math.min(100, Math.round((data.totals.minutes / 150) * 100)),
        Math.min(100, data.streak * 14),
      ],
    },
    volumeProgress: data.weekly.map((d) => ({
      label: d.day,
      volume: d.minutes * Math.max(1, d.workouts),
    })),
    prediction: data.weekly.map((d, i) => ({
      label: d.day,
      actual: weightTrend[i]?.weight ?? null,
    })),
    todayWorkoutPlan: {
      hasLoggedToday: data.today.workouts.length > 0,
      title: data.today.workouts[0]?.title ?? 'Training session',
      durationMin: data.today.workouts[0]?.durationMin ?? 45,
      exercisesCount: data.today.workouts.length || 3,
      exercises: [
        { name: 'Bench Press', sets: 4, reps: 12 },
        { name: 'Squats', sets: 4, reps: 12 },
        { name: 'Deadlifts', sets: 3, reps: 8 },
      ],
    },
    weekPlan: data.weekly.map((d) => ({
      day: d.day,
      date: d.date,
      status: (d.workouts > 0 ? 'done' : 'planned') as 'done' | 'planned' | 'today',
    })),
    dietToday: {
      calories: { current: data.today.nutrition.calories, target: data.targets.calorieTarget },
      protein: { current: data.today.nutrition.protein, target: data.targets.proteinTarget },
      carbs: { current: data.today.nutrition.carbs, target: data.targets.carbTarget },
      fat: { current: data.today.nutrition.fat, target: data.targets.fatTarget },
      water: { currentMl: 0, targetMl: 2500 },
    },
    todayMealPlan: {
      mealsPerDay: 4,
      mainMeals: 3,
      snacks: 1,
      slots: [
        {
          id: 'meal-0',
          label: 'Breakfast',
          kind: 'meal',
          items: [{ name: 'Eggs', role: 'protein', grams: 120 }, { name: 'Oats', role: 'carb', grams: 70 }],
          targetCalories: Math.round(data.targets.calorieTarget / 4),
          targetProtein: Math.round(data.targets.proteinTarget / 3),
        },
        {
          id: 'meal-1',
          label: 'Lunch',
          kind: 'meal',
          items: [{ name: 'Chicken', role: 'protein', grams: 150 }, { name: 'Rice', role: 'carb', grams: 180 }],
          targetCalories: Math.round(data.targets.calorieTarget / 4),
          targetProtein: Math.round(data.targets.proteinTarget / 3),
        },
        {
          id: 'meal-2',
          label: 'Dinner',
          kind: 'meal',
          items: [
            { name: 'Fish', role: 'protein', grams: 140 },
            { name: 'Vegetables', role: 'carb', grams: 150 },
          ],
          targetCalories: Math.round(data.targets.calorieTarget / 4),
          targetProtein: Math.round(data.targets.proteinTarget / 3),
        },
        {
          id: 'meal-3',
          label: 'Snack 1',
          kind: 'snack',
          items: [{ name: 'Fruit', role: 'fruit', grams: 130 }],
          targetCalories: Math.round(data.targets.calorieTarget / 4),
          targetProtein: null,
        },
      ],
    },
  };
}

const REWARD_LEVEL_STEP = 1500;

function computeRewardPoints(data: AthleteHomeDashboard, bodyScore: number): number {
  return (
    data.totals.workouts * 120 +
    data.streak * 40 +
    bodyScore * 8 +
    data.today.nutrition.logCount * 15 +
    data.heatmap.filter((h) => h.workouts > 0).length * 10
  );
}

function CoachPlanStrip({ plan }: { plan: AthletePersonalization }) {
  const { t, language } = useI18n();
  if (!plan.chips.length) return null;

  const goalLabel = plan.goalLabel
    ? localizeOnboardingDisplayValue('primaryGoal', plan.goalLabel, language)
    : null;

  return (
    <section
      className={cn(
        CARD,
        'mb-4 overflow-hidden p-4 sm:p-5',
        'bg-gradient-to-r from-brand-500/[0.06] via-white to-indigo-500/[0.05] dark:from-brand-500/10 dark:via-[#0c1220] dark:to-indigo-950/20'
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
            {t('dashboard.yourPlan')}
          </p>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{t('dashboard.planFromAnswers')}</p>
          {goalLabel && (
            <p className="mt-2 truncate text-lg font-bold text-gray-900 dark:text-white sm:text-xl">
              {goalLabel}
            </p>
          )}
        </div>
        <Link
          to="/profile"
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs font-bold text-brand-700 dark:text-brand-300"
        >
          <span className="material-symbols-outlined text-base">edit_note</span>
          {t('dashboard.completeProfile')}
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {plan.chips.map((chip) => (
          <span
            key={`${chip.icon}-${chip.label}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200/90 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-white/[0.06] dark:text-gray-200"
          >
            <span className="material-symbols-outlined text-sm text-brand-500">{chip.icon}</span>
            <span className="truncate">{localizePersonalizationChipLabel(chip.label, language, t)}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

function AthleteProfileHeaderCard({
  authUser,
  data,
  analytics,
  plan,
  fitnessScore,
  onRefresh,
}: {
  authUser: User | null;
  data: AthleteHomeDashboard;
  analytics: Analytics;
  plan: AthletePersonalization;
  fitnessScore: number;
  onRefresh: () => void;
}) {
  const { t, language } = useI18n();
  const [membership, setMembership] = useState<GymMembership | null>(null);

  useEffect(() => {
    let cancelled = false;
    void gymService.getMyMemberships().then((res) => {
      if (cancelled || !res.data) return;
      const now = Date.now();
      const active = res.data.find(
        (m) => m.isActive && (!m.expiresAt || new Date(m.expiresAt).getTime() > now)
      );
      setMembership(active ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName =
    data.profile.displayName ||
    authUser?.profile?.displayName ||
    authUser?.email?.split('@')[0] ||
    t('dashboard.defaultAthlete');
  const email = authUser?.email ?? '';
  const avatarUrl = authUser?.profile?.avatarUrl ?? authUser?.avatar ?? null;
  const levelLabel = formatFitnessLevel(plan.fitnessLevel || data.profile.fitnessLevel, language, t);
  const rewardPoints = computeRewardPoints(data, fitnessScore);
  const ptsInLevel = rewardPoints % REWARD_LEVEL_STEP;
  const ptsToNext = REWARD_LEVEL_STEP - ptsInLevel;
  const isPro = Boolean(membership) || rewardPoints >= 500;

  const renewalLabel = membership?.expiresAt
    ? new Date(membership.expiresAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div
      className={cn(
        'mb-4 overflow-hidden rounded-xl border border-sky-200/70 shadow-sm',
        'bg-gradient-to-r from-sky-50/90 via-white to-orange-50/80',
        'dark:border-sky-500/20 dark:from-sky-950/35 dark:via-[#0c1220]/90 dark:to-orange-950/20'
      )}
      style={{ boxShadow: '0 4px 20px -10px rgba(21, 139, 141, 0.18), inset 0 1px 0 rgba(255,255,255,0.4)' }}
    >
      <div className="flex flex-wrap items-center gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative shrink-0">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center overflow-hidden rounded-full sm:h-14 sm:w-14',
                'bg-gradient-to-br from-[#1e3a8a] via-brand-500 to-[#f37021] shadow-md shadow-brand-500/25 ring-2 ring-white/40 dark:ring-white/15'
              )}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-2xl text-white sm:text-3xl">person</span>
              )}
            </div>
            {isPro && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#f37021] to-[#ea580c] px-1.5 py-px text-[8px] font-bold uppercase text-white shadow-sm">
                {t('dashboard.profilePro')}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-gray-900 dark:text-white sm:text-lg">{displayName}</h1>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{email}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {plan.goalLabel && (
                <span className="inline-flex max-w-[14rem] items-center gap-0.5 truncate rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">
                  <span className="material-symbols-outlined text-[12px]">flag</span>
                  {localizeOnboardingDisplayValue('primaryGoal', plan.goalLabel, language)}
                </span>
              )}
              <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-[#f37021] to-[#ea580c] px-2 py-0.5 text-[10px] font-bold text-white">
                <span className="material-symbols-outlined text-[12px]">military_tech</span>
                {t('dashboard.profileLevel', { level: levelLabel })}
              </span>
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                {t('dashboard.profileMembership')}:{' '}
                <span className="font-semibold text-gray-800 dark:text-white/90">
                  {membership ? t('dashboard.profileMembershipActive') : t('dashboard.profileMembershipFree')}
                </span>
              </span>
              {renewalLabel && (
                <span className="hidden rounded-full border border-gray-200/80 bg-white/70 px-2 py-0.5 text-[10px] text-gray-600 dark:border-gray-700 dark:bg-white/[0.05] sm:inline">
                  {t('dashboard.profileRenewal')}: {renewalLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-lg border border-[#f37021]/45 bg-white/75 px-2.5 py-1.5 sm:px-3 sm:py-2',
            'dark:border-[#f37021]/35 dark:bg-white/[0.04]'
          )}
        >
          <span className="material-symbols-outlined text-lg text-[#f37021]">star</span>
          <div className="leading-tight">
            <p className="text-base font-extrabold text-[#f37021] sm:text-lg">{rewardPoints.toLocaleString()}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">
              {t('dashboard.profileRewardPoints')}
            </p>
          </div>
          <span className="hidden h-8 w-px bg-gray-200 dark:bg-gray-700 sm:block" />
          <p className="hidden text-[10px] font-semibold text-[#f37021] sm:block">
            {t('dashboard.profilePtsToNext', { pts: String(ptsToNext) })}
          </p>
        </div>

        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
          <button
            type="button"
            onClick={onRefresh}
            title={t('dashboard.refresh')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white/90 text-gray-700 transition hover:border-brand-500/40 dark:border-gray-700 dark:bg-white/[0.06] dark:text-gray-200 sm:h-9 sm:w-auto sm:gap-1 sm:px-3"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            <span className="hidden text-xs font-semibold sm:inline">{t('dashboard.refresh')}</span>
          </button>
          <Link
            to="/workouts"
            className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-3 text-xs font-bold text-white shadow-sm shadow-brand-500/25 transition hover:brightness-110 sm:flex-none sm:px-4"
          >
            <span className="material-symbols-outlined text-base">bolt</span>
            {t('dashboard.startWorkout')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function AiRecommendationSection({
  titleRecommendation,
  titleAlert,
  icon,
  items,
  markedRead,
}: {
  titleRecommendation: string;
  titleAlert: string;
  icon: string;
  items: DashboardAiAlert[];
  markedRead: boolean;
}) {
  const { t } = useI18n();
  const hasCritical = items.some(isDashboardAlertCritical);
  const isAlertMode = !markedRead && hasCritical;
  const title = isAlertMode ? titleAlert : titleRecommendation;

  const sectionClass = markedRead ? READ_SECTION : hasCritical ? ALERT_SECTION : RECOMMENDATION_SECTION;
  const titleClass = markedRead
    ? 'text-[#f37021] dark:text-orange-400'
    : hasCritical
      ? 'text-red-600 dark:text-red-400'
      : 'text-emerald-700 dark:text-emerald-400';
  const headerIconClass = markedRead
    ? 'text-[#f37021]'
    : hasCritical
      ? 'text-red-500'
      : 'text-emerald-500';

  return (
    <div
      className={cn('rounded-xl border p-3.5 sm:p-4', sectionClass)}
      data-recommendation-section={title}
      data-section-mode={markedRead ? 'read' : isAlertMode ? 'alert' : 'recommendation'}
    >
      <div className="flex items-center gap-2">
        <span className={cn('material-symbols-outlined text-lg', headerIconClass)}>{icon}</span>
        <h4 className={cn('text-xs font-bold uppercase tracking-wide sm:text-sm', titleClass)}>{title}</h4>
      </div>
      <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-gray-800 dark:text-gray-200 sm:text-sm">
        {items.map((alert) => {
          const text = formatDashboardAlertText(alert, t);
          const critical = isDashboardAlertCritical(alert);
          const itemIcon = markedRead ? 'check_circle' : critical ? 'error' : 'check_circle';
          const itemIconClass = markedRead
            ? 'text-[#f37021]'
            : critical
              ? 'text-red-500'
              : 'text-emerald-500';
          const row = (
            <>
              <span className={cn('material-symbols-outlined mt-0.5 shrink-0 text-base', itemIconClass)}>
                {itemIcon}
              </span>
              <span>{text}</span>
            </>
          );
          return (
            <li key={alert.id} className="flex items-start gap-2">
              {alert.link ? (
                <Link to={alert.link} className="flex items-start gap-2 hover:underline">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AiDailySummaryCard({ alerts }: { alerts: DashboardAiAlertsPayload }) {
  const { t } = useI18n();
  const userId = useAuthStore((s) => s.user?.id);
  const [markedRead, setMarkedRead] = useState(() => isAiSummaryMarkedRead(userId, alerts.generatedAt));

  useEffect(() => {
    setMarkedRead(isAiSummaryMarkedRead(userId, alerts.generatedAt));
  }, [userId, alerts.generatedAt]);

  const handleMarkReadToggle = () => {
    const next = toggleAiSummaryMarkedRead(userId, alerts.generatedAt);
    setMarkedRead(next);
  };

  const hasRecommendations =
    alerts.nutrition.length > 0 || alerts.workout.length > 0 || alerts.health.length > 0;

  return (
    <div
      className={cn(
        'kpi-card-premium ai-summary-card group relative flex min-h-[220px] flex-col justify-between overflow-x-hidden rounded-2xl border border-brand-500/30 lg:min-h-0',
        'bg-gradient-to-br from-brand-500/[0.12] via-white to-white/95 backdrop-blur-xl',
        'dark:border-brand-500/35 dark:from-brand-500/20 dark:via-[#0c1220]/95 dark:to-[#0a0f18]/90'
      )}
      style={{
        boxShadow:
          '0 12px 40px -12px rgba(21, 139, 141, 0.45), 0 0 0 1px rgba(21, 139, 141, 0.08), inset 0 1px 0 rgba(255,255,255,0.15)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-50 blur-3xl transition-opacity duration-500 group-hover:opacity-70"
        style={{ background: BRAND }}
      />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-indigo-500/30 opacity-30 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 10%, rgba(21,139,141,0.15) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(99,102,241,0.12) 0%, transparent 40%)',
        }}
      />

      <div className="relative z-[1] flex h-full flex-col justify-between p-5 md:p-6 lg:p-5">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'ai-summary-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
                  'bg-gradient-to-br from-brand-500 to-brand-600 text-white ring-2 ring-white/30 dark:ring-white/15'
                )}
              >
                <span className="material-symbols-outlined text-[28px]">auto_awesome</span>
              </div>
              <div>
                <span className="inline-flex items-center gap-1 rounded-full border border-brand-500/30 bg-brand-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                  {t('dashboard.aiBadge')}
                </span>
                <p className="mt-1.5 text-sm font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
                  {t('dashboard.aiSummary')}
                </p>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">{t('dashboard.aiSummarySub')}</p>
              </div>
            </div>
            <span
              className="material-symbols-outlined hidden text-5xl text-brand-500/15 lg:hidden dark:text-brand-400/10"
              aria-hidden
            >
              psychology_alt
            </span>
          </div>

          <div
            className="mt-4 space-y-2.5"
            data-ai-alerts
            data-ai-alerts-source={alerts.source}
            data-ai-alerts-generated-at={alerts.generatedAt}
            data-ai-alerts-read={markedRead ? 'true' : 'false'}
          >
            <AiRecommendationSection
              titleRecommendation={t('dashboard.recNutrition')}
              titleAlert={t('dashboard.alertNutrition')}
              icon="restaurant"
              items={alerts.nutrition}
              markedRead={markedRead}
            />
            <AiRecommendationSection
              titleRecommendation={t('dashboard.recWorkout')}
              titleAlert={t('dashboard.alertWorkout')}
              icon="fitness_center"
              items={alerts.workout}
              markedRead={markedRead}
            />
            <AiRecommendationSection
              titleRecommendation={t('dashboard.recGeneralHealth')}
              titleAlert={t('dashboard.alertGeneralHealth')}
              icon="health_and_safety"
              items={alerts.health}
              markedRead={markedRead}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {hasRecommendations && (
            <button
              type="button"
              onClick={handleMarkReadToggle}
              aria-pressed={markedRead}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold shadow-sm transition',
                markedRead
                  ? 'border-[#f37021]/50 bg-[#f37021]/15 text-[#f37021] dark:border-[#f37021]/45 dark:bg-[#f37021]/20 dark:text-orange-300'
                  : 'border-gray-200/90 bg-white/80 text-gray-700 hover:border-brand-500/40 hover:bg-white hover:text-brand-700 dark:border-gray-700 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:border-brand-500/35 dark:hover:text-brand-300'
              )}
            >
              <span className="material-symbols-outlined text-lg">
                {markedRead ? 'check_circle' : 'done_all'}
              </span>
              {t('dashboard.markRecommendationsRead')}
            </button>
          )}
          <Link
            to="/ai-assistant"
            className={cn(
              'inline-flex items-center gap-2.5 rounded-xl px-6 py-3.5 text-sm font-bold text-white',
              'bg-gradient-to-r from-brand-500 to-brand-600 shadow-lg shadow-brand-500/35',
              'ring-1 ring-white/25 transition-all duration-300',
              'hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-500/45 hover:brightness-110',
              'active:translate-y-0'
            )}
          >
            <span className="material-symbols-outlined text-xl">forum</span>
            {t('dashboard.talkToCoach')}
            <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-0.5">
              arrow_forward
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function HydrationPulseCard({
  baseMl,
  targetMl,
  userId,
  dateKey,
}: {
  baseMl: number;
  targetMl: number;
  userId?: string;
  dateKey: string;
}) {
  const { t } = useI18n();
  const [boostMl, setBoostMl] = useState(() => readWaterBoostMl(userId, dateKey));

  useEffect(() => {
    setBoostMl(readWaterBoostMl(userId, dateKey));
  }, [userId, dateKey]);

  const currentMl = baseMl + boostMl;
  const pct = targetMl > 0 ? Math.min(100, (currentMl / targetMl) * 100) : 0;

  const handleAdd = () => {
    const next = addWaterBoostMl(userId, dateKey, 250);
    setBoostMl(next);
  };

  return (
    <div className={cn(CARD, 'overflow-hidden px-4 py-4 sm:px-5 sm:py-5')}>
      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
          {t('dashboard.hydrationPulseTitle')}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('dashboard.hydrationPulseSub')}</p>
      </div>

      <div className="mx-auto flex max-w-[200px] flex-col items-center">
        <div className="relative h-28 w-20">
          <div className="absolute inset-x-1 bottom-0 top-2 rounded-b-2xl border-2 border-gray-300/90 bg-gray-100/80 dark:border-gray-600 dark:bg-gray-800/60">
            <div
              className="absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-sky-600 to-sky-400 transition-all duration-500"
              style={{ height: `${pct}%` }}
            />
            {[0, Math.round(targetMl / 2), targetMl].map((tick) => (
              <span
                key={tick}
                className="absolute -right-8 text-[9px] font-semibold text-gray-400"
                style={{ bottom: `${targetMl > 0 ? (tick / targetMl) * 100 : 0}%`, transform: 'translateY(50%)' }}
              >
                {tick >= 1000 ? `${Math.round(tick / 1000)}k` : tick}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center">
          <span className="text-3xl font-extrabold tabular-nums text-gray-900 dark:text-white">
            {Math.round(currentMl).toLocaleString()}
          </span>
          <span className="mt-0.5 block text-sm font-medium text-gray-500">
            /{Math.round(targetMl).toLocaleString()} ml
          </span>
        </p>

        <button
          type="button"
          onClick={handleAdd}
          className="mt-3 rounded-full border border-gray-200 bg-gray-100/90 px-5 py-2 text-sm font-bold text-gray-800 transition hover:border-sky-400/50 hover:bg-sky-50 hover:text-sky-800 dark:border-gray-600 dark:bg-white/[0.06] dark:text-gray-100 dark:hover:border-sky-500/40 dark:hover:bg-sky-500/10"
        >
          {t('dashboard.addWater250')}
        </button>
      </div>
    </div>
  );
}

type DietMacroKey = 'calories' | 'protein' | 'carbs' | 'fat' | 'water';

const DIET_MACRO_META: Record<
  DietMacroKey,
  {
    icon: string;
    accent: string;
    glow: string;
    border: string;
    wash: string;
    iconFrom: string;
    iconTo: string;
    format: (c: number, t: number) => string;
  }
> = {
  calories: {
    icon: 'local_fire_department',
    accent: '#f37021',
    glow: 'rgba(243, 112, 33, 0.42)',
    border: 'border-[#f37021]/30 dark:border-[#f37021]/40',
    wash: 'from-[#f37021]/22 via-[#f37021]/6 to-transparent',
    iconFrom: 'from-[#f37021]/55',
    iconTo: 'to-[#f37021]/12',
    format: (c, t) => `${Math.round(c)} / ${t} kcal`,
  },
  protein: {
    icon: 'egg_alt',
    accent: '#158b8d',
    glow: 'rgba(21, 139, 141, 0.42)',
    border: 'border-[#158b8d]/30 dark:border-[#158b8d]/40',
    wash: 'from-[#158b8d]/22 via-[#158b8d]/6 to-transparent',
    iconFrom: 'from-[#158b8d]/55',
    iconTo: 'to-[#158b8d]/12',
    format: (c, t) => `${Math.round(c)} / ${Math.round(t)}g`,
  },
  carbs: {
    icon: 'bakery_dining',
    accent: '#6366f1',
    glow: 'rgba(99, 102, 241, 0.42)',
    border: 'border-[#6366f1]/30 dark:border-[#6366f1]/40',
    wash: 'from-[#6366f1]/24 via-[#6366f1]/6 to-transparent',
    iconFrom: 'from-[#6366f1]/55',
    iconTo: 'to-[#6366f1]/12',
    format: (c, t) => `${Math.round(c)} / ${Math.round(t)}g`,
  },
  fat: {
    icon: 'water_drop',
    accent: '#eab308',
    glow: 'rgba(234, 179, 8, 0.42)',
    border: 'border-[#eab308]/30 dark:border-[#eab308]/40',
    wash: 'from-[#eab308]/24 via-[#eab308]/6 to-transparent',
    iconFrom: 'from-[#eab308]/55',
    iconTo: 'to-[#eab308]/12',
    format: (c, t) => `${Math.round(c)} / ${Math.round(t)}g`,
  },
  water: {
    icon: 'water_full',
    accent: '#0ea5e9',
    glow: 'rgba(14, 165, 233, 0.45)',
    border: 'border-[#0ea5e9]/30 dark:border-[#0ea5e9]/40',
    wash: 'from-[#0ea5e9]/26 via-[#0ea5e9]/8 to-transparent',
    iconFrom: 'from-[#0ea5e9]/55',
    iconTo: 'to-[#0ea5e9]/12',
    format: (c, t) => `${Math.round(c)} / ${t} ml`,
  },
};

function DietMacroCard({
  label,
  macroKey,
  current,
  target,
  compact = false,
}: {
  label: string;
  macroKey: DietMacroKey;
  current: number;
  target: number;
  compact?: boolean;
}) {
  const meta = DIET_MACRO_META[macroKey];
  const pct = target > 0 ? Math.max(0, Math.round((current / target) * 100)) : 0;
  const pctVisual = Math.min(100, pct);

  return (
    <div
      className={cn(
        'kpi-card-premium diet-macro-card group relative overflow-hidden rounded-xl border backdrop-blur-xl transition-all duration-300',
        'bg-white/95 dark:bg-[#0c1220]/90',
        meta.border,
        compact ? 'p-2.5' : 'rounded-2xl p-4 min-h-[7.5rem]'
      )}
      style={{
        boxShadow: `0 10px 36px -10px ${meta.glow}, inset 0 1px 0 rgba(255,255,255,0.14)`,
      }}
    >
      {!compact && (
        <>
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-45 blur-3xl transition-opacity duration-300 group-hover:opacity-65"
            style={{ background: meta.accent }}
          />
          <div
            className="pointer-events-none absolute -left-6 bottom-0 h-20 w-20 rounded-full opacity-20 blur-2xl"
            style={{ background: meta.accent }}
          />
        </>
      )}
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-85', meta.wash)} />

      <div className={cn('relative z-[1]', compact ? 'space-y-1.5' : 'flex h-full flex-col justify-between')}>
        <div className={cn('flex items-center gap-2', compact && 'justify-between')}>
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className={cn(
                'flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm ring-1 ring-white/20',
                meta.iconFrom,
                meta.iconTo,
                compact ? 'h-7 w-7' : 'h-9 w-9 rounded-xl shadow-md'
              )}
              style={{ boxShadow: compact ? undefined : `0 8px 20px -6px ${meta.glow}` }}
            >
              <span
                className="material-symbols-outlined"
                style={{ color: meta.accent, fontSize: compact ? 16 : 20 }}
              >
                {meta.icon}
              </span>
            </div>
            <span
              className={cn(
                'font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate',
                compact ? 'text-[9px]' : 'text-[10px] tracking-[0.14em]'
              )}
            >
              {label}
            </span>
          </div>
          {compact && (
            <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ color: meta.accent }}>
              {pct}%
            </span>
          )}
        </div>

        <p
          className={cn(
            'font-bold tracking-tight text-gray-900 dark:text-white',
            compact ? 'text-sm leading-tight' : 'mt-3 text-lg sm:text-xl font-extrabold'
          )}
          style={compact ? undefined : { textShadow: `0 0 36px ${meta.glow}` }}
        >
          {meta.format(current, target)}
        </p>

        <div className={compact ? '' : 'mt-3'}>
          <div className={cn('overflow-hidden rounded-full bg-gray-200/90 dark:bg-white/[0.08]', compact ? 'h-1' : 'h-1.5')}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.max(pctVisual, pctVisual > 0 ? 4 : 0)}%`,
                background: `linear-gradient(90deg, ${meta.accent}, ${meta.accent}bb)`,
                boxShadow: compact ? undefined : `0 0 14px ${meta.glow}`,
              }}
            />
          </div>
          {!compact && (
            <p className="mt-1.5 text-[11px] font-semibold tabular-nums" style={{ color: meta.accent }}>
              {pct}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function scaleMealItemForLog(
  item: NonNullable<Analytics['todayMealPlan']>['slots'][number]['items'][number],
  grams: number
): PlanMealLogItem {
  const per100 = planItemToPer100(item);
  if (per100) {
    const scaled = macrosFromPer100(per100, grams);
    return {
      name: item.name,
      grams,
      role: item.role as PlanMealLogItem['role'],
      webtebId: item.webtebId ?? undefined,
      macrosPer100: per100,
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
    };
  }
  const factor = item.grams > 0 ? grams / item.grams : 1;
  return {
    name: item.name,
    grams,
    role: item.role as PlanMealLogItem['role'],
    webtebId: item.webtebId ?? undefined,
    calories: Math.round((item.calories ?? 0) * factor),
    protein: Math.round((item.protein ?? 0) * factor * 10) / 10,
    carbs: Math.round((item.carbs ?? 0) * factor * 10) / 10,
    fat: Math.round((item.fat ?? 0) * factor * 10) / 10,
  };
}

function readMealDraftStore(userId: string | undefined, date: string): Record<string, number[]> {
  if (!userId || typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`taqwin-meal-drafts:${userId}:${date}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMealDraftStore(userId: string | undefined, date: string, drafts: Record<string, number[]>) {
  if (!userId || typeof window === 'undefined') return;
  window.localStorage.setItem(`taqwin-meal-drafts:${userId}:${date}`, JSON.stringify(drafts));
}

function readSlotDraftItems(userId: string | undefined, date: string): Record<string, PlanMealLogItem[]> {
  if (!userId || typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`taqwin-meal-slot-items:${userId}:${date}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PlanMealLogItem[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSlotDraftItems(
  userId: string | undefined,
  date: string,
  items: Record<string, PlanMealLogItem[]>
) {
  if (!userId || typeof window === 'undefined') return;
  window.localStorage.setItem(`taqwin-meal-slot-items:${userId}:${date}`, JSON.stringify(items));
}

function draftItemToPer100(item: PlanMealLogItem): MacrosPer100 | undefined {
  if (item.macrosPer100) return item.macrosPer100;
  if (!item.grams || item.grams <= 0) return undefined;
  const factor = 100 / item.grams;
  return {
    calories: Math.round((item.calories ?? 0) * factor),
    protein: Math.round((item.protein ?? 0) * factor * 10) / 10,
    carbs: Math.round((item.carbs ?? 0) * factor * 10) / 10,
    fat: Math.round((item.fat ?? 0) * factor * 10) / 10,
  };
}

function entriesToDraftItems(entries: MealEditEntry[]): PlanMealLogItem[] {
  return entries.map((entry) => {
    const per100 = entry.macrosPer100 ?? (entry.planItem ? planItemToPer100(entry.planItem) : undefined);
    if (per100) {
      const scaled = macrosFromPer100(per100, entry.grams);
      return {
        name: entry.name,
        grams: entry.grams,
        role: (entry.planItem?.role as PlanMealLogItem['role']) ?? 'mixed',
        webtebId: entry.webtebId ?? entry.planItem?.webtebId ?? undefined,
        macrosPer100: per100,
        calories: scaled.calories,
        protein: scaled.protein,
        carbs: scaled.carbs,
        fat: scaled.fat,
      };
    }
    return {
      name: entry.name,
      grams: entry.grams,
      role: 'mixed',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
  });
}

function buildDraftEntries(slot: MealSlot, draftGrams?: number[], draftItems?: PlanMealLogItem[]): MealEditEntry[] {
  if (draftItems !== undefined) {
    return draftItems.map((item, index) => ({
      key: `draft-${index}-${item.name}`,
      name: item.name,
      grams: item.grams,
      webtebId: item.webtebId ?? undefined,
      macrosPer100: draftItemToPer100(item),
    }));
  }
  return slot.items.map((item, index) => ({
    key: `plan-${index}`,
    name: item.name,
    grams: draftGrams?.[index] ?? item.grams,
    webtebId: item.webtebId ?? undefined,
    planItem: item,
    macrosPer100: item.macrosPer100 ?? planItemToPer100(item),
  }));
}

const DASHBOARD_SELECTED_DATE_KEY = 'taqwin-dashboard-selected-date';

function readPersistedSelectedDate(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = sessionStorage.getItem(DASHBOARD_SELECTED_DATE_KEY);
    if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved;
  } catch {
    /* ignore */
  }
  return fallback;
}

function persistSelectedDate(date: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(DASHBOARD_SELECTED_DATE_KEY, date);
  } catch {
    /* ignore */
  }
}

function inferLogIdsBySlotFromLogs(logs: FoodLog[], slots: MealSlot[]): Record<string, string[]> {
  if (!logs.length || !slots.length) return {};

  const remaining = [...logs];
  const result: Record<string, string[]> = {};

  for (const slot of slots) {
    const matched: string[] = [];
    const nextRemaining: FoodLog[] = [];
    for (const log of remaining) {
      const logName = (log.foodItem?.displayName ?? log.foodItem?.name ?? '').trim().toLowerCase();
      const matchesSlot = slot.items.some((item) => {
        const itemName = item.name.trim().toLowerCase();
        return logName === itemName || logName.includes(itemName) || itemName.includes(logName);
      });
      if (matchesSlot) matched.push(log.id);
      else nextRemaining.push(log);
    }
    if (matched.length) result[slot.id] = matched;
    remaining.splice(0, remaining.length, ...nextRemaining);
  }

  if (remaining.length) {
    let slotIndex = 0;
    for (const log of remaining) {
      const slot = slots[slotIndex % slots.length];
      result[slot.id] = [...(result[slot.id] ?? []), log.id];
      slotIndex += 1;
    }
  }

  return result;
}

function buildLoggedEntries(
  slot: MealSlot,
  logIds: string[],
  logsById: Map<
    string,
    {
      id: string;
      grams: number;
      foodItem?: {
        name: string;
        displayName?: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
      };
    }
  >
): MealEditEntry[] {
  return logIds.map((logId, index) => {
    const log = logsById.get(logId);
    const foodItem = log?.foodItem;
    const planItem = slot.items[index];
    const macrosPer100: MacrosPer100 | undefined = foodItem
      ? {
          calories: foodItem.calories,
          protein: foodItem.protein,
          carbs: foodItem.carbs,
          fat: foodItem.fat,
        }
      : planItem
        ? planItemToPer100(planItem)
        : undefined;
    return {
      key: logId,
      name: foodItem?.displayName ?? foodItem?.name ?? planItem?.name ?? 'Food',
      grams: log?.grams ?? planItem?.grams ?? 100,
      logId,
      webtebId: planItem?.webtebId ?? undefined,
      macrosPer100,
      planItem: foodItem ? undefined : planItem,
    };
  });
}

type MealSlot = NonNullable<Analytics['todayMealPlan']>['slots'][number];
type MealItem = MealSlot['items'][number];

const DIET_NUM_CLASS = 'text-[13px] font-semibold tabular-nums text-gray-800 dark:text-white/85';

function highlightDietNumbers(text: string): React.ReactNode {
  const parts = text.split(/(\d[\d.,]*)/g);
  return parts.map((part, index) =>
    /^\d/.test(part) ? (
      <span key={index} className={DIET_NUM_CLASS}>
        {part}
      </span>
    ) : (
      part
    )
  );
}

function InlineGramPortion({
  grams,
  kcal,
  disabled,
  isSaving,
  onCommit,
}: {
  grams: number;
  kcal: number;
  disabled?: boolean;
  isSaving?: boolean;
  onCommit: (grams: number) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(Math.round(grams)));
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(String(Math.round(grams)));
  }, [grams, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < 5 || parsed > 5000) {
      setDraft(String(Math.round(grams)));
      setEditing(false);
      return;
    }
    setEditing(false);
    if (Math.round(parsed) !== Math.round(grams)) void onCommit(parsed);
  };

  if (editing) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-500/50 bg-white px-1.5 py-0.5 dark:bg-gray-900">
        <input
          ref={inputRef}
          type="number"
          min={5}
          max={5000}
          step={5}
          value={draft}
          disabled={disabled || isSaving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Escape') {
              setDraft(String(Math.round(grams)));
              setEditing(false);
            }
          }}
          className="w-14 bg-transparent text-center text-[10px] font-semibold tabular-nums text-gray-900 outline-none dark:text-white"
          aria-label={t('dashboard.editGrams')}
        />
        <span className="text-[10px] font-semibold tabular-nums text-gray-500">g</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || isSaving}
      onClick={() => setEditing(true)}
      title={t('dashboard.editGramsHint')}
      aria-label={t('dashboard.editGramsHint')}
      className={cn(
        'shrink-0 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-500 transition-colors hover:border-brand-500/40 hover:bg-brand-500/5 hover:text-brand-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-brand-500/40 dark:hover:text-brand-400'
      )}
    >
      {isSaving ? (
        <span className="material-symbols-outlined animate-spin text-[12px]">progress_activity</span>
      ) : (
        highlightDietNumbers(
          t('dashboard.mealItemPortion', {
            grams: String(Math.round(grams)),
            kcal: String(kcal),
          })
        )
      )}
    </button>
  );
}

function readMealCheckStore(
  userId: string | undefined,
  date: string
): { prepChecked: Set<string>; logIdsBySlot: Record<string, string[]> } {
  if (!userId || typeof window === 'undefined') {
    return { prepChecked: new Set(), logIdsBySlot: {} };
  }
  try {
    const raw = window.localStorage.getItem(`taqwin-meal-checks:${userId}:${date}`);
    if (!raw) return { prepChecked: new Set(), logIdsBySlot: {} };
    const parsed = JSON.parse(raw) as
      | string[]
      | { checked?: string[]; logIdsBySlot?: Record<string, string[]>; prepChecked?: string[] };
    if (Array.isArray(parsed)) {
      return { prepChecked: new Set(), logIdsBySlot: {} };
    }
    const logIdsBySlot = parsed.logIdsBySlot ?? {};
    const prepChecked = new Set(parsed.prepChecked ?? []);
    return { prepChecked, logIdsBySlot };
  } catch {
    return { prepChecked: new Set(), logIdsBySlot: {} };
  }
}

function writeMealCheckStore(
  userId: string | undefined,
  date: string,
  prepChecked: Set<string>,
  logIdsBySlot: Record<string, string[]>
) {
  if (!userId || typeof window === 'undefined') return;
  const checked = Object.keys(logIdsBySlot).filter(
    (slotId) => Array.isArray(logIdsBySlot[slotId]) && logIdsBySlot[slotId].length > 0
  );
  window.localStorage.setItem(
    `taqwin-meal-checks:${userId}:${date}`,
    JSON.stringify({ checked, logIdsBySlot, prepChecked: [...prepChecked] })
  );
  emitWellnessChanged();
}

function DietMealChecklist({
  mealPlan,
  diet,
  date,
  todayKey,
  dayLabel,
  userId,
  onRefresh,
}: {
  mealPlan: NonNullable<Analytics['todayMealPlan']>;
  diet: NonNullable<Analytics['dietToday']>;
  date: string;
  todayKey: string;
  dayLabel?: string;
  userId?: string;
  onRefresh?: () => Promise<void>;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const initial = readMealCheckStore(userId, date);
  const [prepChecked, setPrepChecked] = useState<Set<string>>(() => initial.prepChecked);
  const [logIdsBySlot, setLogIdsBySlot] = useState<Record<string, string[]>>(() => initial.logIdsBySlot);
  const canEditDay = canEditPlanDate(date, todayKey);
  const canLogDay = canLogPlanDate(date, todayKey);
  const isFutureDay = isFuturePlanDate(date, todayKey);
  const dayOffset = date < todayKey ? -1 : date > todayKey ? 1 : 0;

  const isSlotLogged = useCallback(
    (slotId: string) => (logIdsBySlot[slotId]?.length ?? 0) > 0,
    [logIdsBySlot]
  );
  const isSlotDone = useCallback(
    (slotId: string) => {
      if (isSlotLogged(slotId)) return true;
      return canLogDay && prepChecked.has(slotId);
    },
    [isSlotLogged, prepChecked, canLogDay]
  );
  const [draftGramsBySlot, setDraftGramsBySlot] = useState<Record<string, number[]>>(() =>
    readMealDraftStore(userId, date)
  );
  const [loggedGramsBySlot, setLoggedGramsBySlot] = useState<Record<string, number[]>>({});
  const [loggedDisplayEntries, setLoggedDisplayEntries] = useState<Record<string, MealEditEntry[]>>({});
  const [slotDraftItems, setSlotDraftItems] = useState<Record<string, PlanMealLogItem[]>>(() =>
    readSlotDraftItems(userId, date)
  );
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editSession, setEditSession] = useState<{ slotId: string; entries: MealEditEntry[] } | null>(null);
  const [mealDetailsRow, setMealDetailsRow] = useState<NutritionFoodRow | null>(null);
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);
  const [dayDiet, setDayDiet] = useState(diet);

  useEffect(() => {
    if (!userId) return;
    setMealPlanSlotsContext({
      userId,
      date,
      slots: mealPlan.slots.map((slot) => ({
        id: slot.id,
        label: slot.label,
        kind: slot.kind,
      })),
    });
  }, [userId, date, mealPlan.slots]);

  useEffect(() => {
    setDayDiet(diet);
  }, [diet]);

  useEffect(() => {
    if (date === todayKey) return;
    let cancelled = false;
    void nutritionService.getDailySummary(date).then((res) => {
      if (cancelled || !res.data) return;
      setDayDiet((prev) => ({
        ...prev,
        calories: { current: res.data!.calories, target: prev.calories.target },
        protein: { current: res.data!.protein, target: prev.protein.target },
        carbs: { current: res.data!.carbs, target: prev.carbs.target },
        fat: { current: res.data!.fat, target: prev.fat.target },
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [date, todayKey]);

  useEffect(() => {
    let cancelled = false;
    setEditSession(null);
    setError(null);
    setLoggedGramsBySlot({});
    setLoggedDisplayEntries({});

    const store = readMealCheckStore(userId, date);
    setPrepChecked(store.prepChecked);
    setDraftGramsBySlot(readMealDraftStore(userId, date));
    setSlotDraftItems(readSlotDraftItems(userId, date));

    void (async () => {
      const res = await nutritionService.getMyLogs(date);
      if (cancelled) return;

      const hasLocalLogs = Object.values(store.logIdsBySlot).some((ids) => ids.length > 0);
      let nextLogIds = store.logIdsBySlot;
      if (!hasLocalLogs && res.data?.length) {
        nextLogIds = inferLogIdsBySlotFromLogs(res.data, mealPlan.slots);
        if (Object.keys(nextLogIds).length) {
          writeMealCheckStore(userId, date, store.prepChecked, nextLogIds);
        }
      }
      setLogIdsBySlot(nextLogIds);

      const slotIds = Object.keys(nextLogIds).filter((slotId) => (nextLogIds[slotId]?.length ?? 0) > 0);
      if (!slotIds.length || !res.data?.length) return;

      const gramsByLogId = new Map(res.data.map((log) => [log.id, log.grams]));
      const logsById = new Map(res.data.map((log) => [log.id, log]));
      const nextGrams: Record<string, number[]> = {};
      const nextEntries: Record<string, MealEditEntry[]> = {};
      for (const slotId of slotIds) {
        const slot = mealPlan.slots.find((entry) => entry.id === slotId);
        const ids = nextLogIds[slotId] ?? [];
        nextGrams[slotId] = ids.map((logId) => gramsByLogId.get(logId) ?? 0);
        if (slot) nextEntries[slotId] = buildLoggedEntries(slot, ids, logsById);
      }
      if (!cancelled) {
        setLoggedGramsBySlot(nextGrams);
        setLoggedDisplayEntries(nextEntries);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, date, mealPlan.slots]);

  useEffect(() => {
    const slotIds = Object.keys(logIdsBySlot).filter((slotId) => (logIdsBySlot[slotId]?.length ?? 0) > 0);
    if (!slotIds.length) {
      setLoggedGramsBySlot({});
      setLoggedDisplayEntries({});
      return;
    }
    let cancelled = false;
    void nutritionService.getMyLogs(date).then((res) => {
      if (cancelled || res.error || !res.data) return;
      const gramsByLogId = new Map(res.data.map((log) => [log.id, log.grams]));
      const logsById = new Map(res.data.map((log) => [log.id, log]));
      const nextGrams: Record<string, number[]> = {};
      const nextEntries: Record<string, MealEditEntry[]> = {};
      for (const slotId of slotIds) {
        const slot = mealPlan.slots.find((entry) => entry.id === slotId);
        const ids = logIdsBySlot[slotId] ?? [];
        nextGrams[slotId] = ids.map((logId) => gramsByLogId.get(logId) ?? 0);
        if (slot) nextEntries[slotId] = buildLoggedEntries(slot, ids, logsById);
      }
      setLoggedGramsBySlot(nextGrams);
      setLoggedDisplayEntries(nextEntries);
    });
    return () => {
      cancelled = true;
    };
  }, [date, logIdsBySlot, mealPlan.slots]);

  const toggleMeal = async (slot: NonNullable<Analytics['todayMealPlan']>['slots'][number]) => {
    if (syncing || !canLogDay) return;
    setError(null);
    const logged = isSlotLogged(slot.id);
    setSyncing(slot.id);
    try {
      if (logged) {
        const logIds = logIdsBySlot[slot.id] ?? [];
        if (logIds.length) await nutritionService.deletePlanMealLogs(logIds);
        const nextPrep = new Set(prepChecked);
        nextPrep.delete(slot.id);
        const nextLogs = { ...logIdsBySlot };
        delete nextLogs[slot.id];
        setPrepChecked(nextPrep);
        setLogIdsBySlot(nextLogs);
        writeMealCheckStore(userId, date, nextPrep, nextLogs);
      } else {
        const draftItems = slotDraftItems[slot.id];
        if (draftItems !== undefined && draftItems.length === 0) {
          setError(t('dashboard.emptyMealCannotLog'));
          return;
        }
        const res = await nutritionService.logPlanMeal({
          date,
          slotId: slot.id,
          items:
            draftItems !== undefined
              ? draftItems
              : slot.items.map((item, index) =>
                  scaleMealItemForLog(item, draftGramsBySlot[slot.id]?.[index] ?? item.grams)
                ),
        });
        if (res.error || !res.data) throw new Error(res.error || 'Failed to log meal');
        const nextPrep = new Set(prepChecked);
        nextPrep.delete(slot.id);
        const nextLogs = { ...logIdsBySlot, [slot.id]: res.data.logIds };
        const loggedGrams = slot.items.map((item, index) => draftGramsBySlot[slot.id]?.[index] ?? item.grams);
        setPrepChecked(nextPrep);
        setLogIdsBySlot(nextLogs);
        setLoggedGramsBySlot((prev) => ({ ...prev, [slot.id]: loggedGrams }));
        const nextDrafts = { ...draftGramsBySlot };
        delete nextDrafts[slot.id];
        setDraftGramsBySlot(nextDrafts);
        writeMealDraftStore(userId, date, nextDrafts);
        const nextSlotDrafts = { ...slotDraftItems };
        delete nextSlotDrafts[slot.id];
        setSlotDraftItems(nextSlotDrafts);
        writeSlotDraftItems(userId, date, nextSlotDrafts);
        writeMealCheckStore(userId, date, nextPrep, nextLogs);
      }
      await onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update meal log');
    } finally {
      setSyncing(null);
    }
  };

  const startSlotEdit = async (slot: MealSlot) => {
    if (!canEditDay) return;
    setError(null);
    if (isSlotLogged(slot.id)) {
      const logIds = logIdsBySlot[slot.id] ?? [];
      const res = await nutritionService.getMyLogs(date);
      const logsById = new Map((res.data ?? []).map((log) => [log.id, log]));
      setEditSession({
        slotId: slot.id,
        entries: buildLoggedEntries(slot, logIds, logsById),
      });
      return;
    }
    setEditSession({
      slotId: slot.id,
      entries: buildDraftEntries(slot, draftGramsBySlot[slot.id], slotDraftItems[slot.id]),
    });
  };

  useEffect(() => {
    const reopen = consumeMealEditReopen();
    if (!reopen || reopen.date !== date) return;
    const store = readMealCheckStore(userId, date);
    setPrepChecked(store.prepChecked);
    setLogIdsBySlot(store.logIdsBySlot);
    setSlotDraftItems(readSlotDraftItems(userId, date));
    const slot = mealPlan.slots.find((entry) => entry.id === reopen.slotId);
    if (slot) void startSlotEdit(slot);
  }, [date, mealPlan.slots, userId]);

  const finishSlotEdit = async (slot: MealSlot) => {
    if (!canEditDay) return;
    if (!editSession || editSession.slotId !== slot.id) {
      setEditSession(null);
      return;
    }
    setError(null);
    setSyncing(slot.id);
    try {
      const isEmpty = editSession.entries.length === 0;

      if (isSlotLogged(slot.id) && canLogDay) {
        for (const entry of editSession.entries) {
          if (!entry.logId) continue;
          const res = await nutritionService.updateLog(entry.logId, entry.grams);
          if (res.error) throw new Error(res.error);
        }
        if (isEmpty) {
          const logIds = logIdsBySlot[slot.id] ?? [];
          if (logIds.length) await nutritionService.deletePlanMealLogs(logIds);
          const nextPrep = new Set(prepChecked);
          nextPrep.delete(slot.id);
          const nextLogs = { ...logIdsBySlot };
          delete nextLogs[slot.id];
          setPrepChecked(nextPrep);
          setLogIdsBySlot(nextLogs);
          writeMealCheckStore(userId, date, nextPrep, nextLogs);
        }
        setLoggedDisplayEntries((prev) => ({ ...prev, [slot.id]: editSession.entries }));
        setLoggedGramsBySlot((prev) => ({
          ...prev,
          [slot.id]: editSession.entries.map((entry) => entry.grams),
        }));
        await onRefresh?.();
      }

      const items = entriesToDraftItems(editSession.entries);
      const nextSlotDrafts = { ...slotDraftItems, [slot.id]: items };
      setSlotDraftItems(nextSlotDrafts);
      writeSlotDraftItems(userId, date, nextSlotDrafts);
      const nextGramDrafts = { ...draftGramsBySlot };
      delete nextGramDrafts[slot.id];
      setDraftGramsBySlot(nextGramDrafts);
      writeMealDraftStore(userId, date, nextGramDrafts);

      setEditSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.editMealSaveFailed'));
    } finally {
      setSyncing(null);
    }
  };

  const toggleSlotEdit = (slot: MealSlot) => {
    if (!canEditDay) return;
    if (editSession?.slotId === slot.id) {
      void finishSlotEdit(slot);
      return;
    }
    if (editSession) setEditSession(null);
    void startSlotEdit(slot);
  };

  const changeEditGrams = (key: string, grams: number) => {
    if (!editSession) return;
    setEditSession({
      ...editSession,
      entries: editSession.entries.map((entry) => (entry.key === key ? { ...entry, grams } : entry)),
    });
  };

  const removeEditEntry = async (slot: MealSlot, key: string) => {
    if (!canEditDay) return;
    if (!editSession || editSession.slotId !== slot.id) return;
    const entry = editSession.entries.find((item) => item.key === key);
    if (!entry) return;
    setError(null);
    setSyncing(key);
    try {
      const nextEntries = editSession.entries.filter((item) => item.key !== key);
      if (entry.logId && canLogDay) {
        const res = await nutritionService.deleteLog(entry.logId);
        if (res.error) throw new Error(res.error);
        const nextLogIds = (logIdsBySlot[slot.id] ?? []).filter((id) => id !== entry.logId);
        const nextLogs = { ...logIdsBySlot, [slot.id]: nextLogIds };
        setLogIdsBySlot(nextLogs);
        if (nextLogIds.length === 0) {
          const nextPrep = new Set(prepChecked);
          nextPrep.delete(slot.id);
          setPrepChecked(nextPrep);
          writeMealCheckStore(userId, date, nextPrep, nextLogs);
        } else {
          writeMealCheckStore(userId, date, prepChecked, nextLogs);
        }
        setLoggedDisplayEntries((prev) => ({ ...prev, [slot.id]: nextEntries }));
        await onRefresh?.();
      }
      setEditSession({ slotId: slot.id, entries: nextEntries });
      if (nextEntries.length === 0) {
        const nextSlotDrafts = { ...slotDraftItems, [slot.id]: [] };
        setSlotDraftItems(nextSlotDrafts);
        writeSlotDraftItems(userId, date, nextSlotDrafts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.editMealSaveFailed'));
    } finally {
      setSyncing(null);
    }
  };

  const openNutritionForMeal = (slot: MealSlot) => {
    if (!userId || !canEditDay) return;
    const isLogged = isSlotLogged(slot.id);
    let existingDraftItems: PlanMealLogItem[] | undefined;
    if (!isLogged) {
      if (editSession?.slotId === slot.id) {
        existingDraftItems = entriesToDraftItems(editSession.entries);
      } else if (slotDraftItems[slot.id] !== undefined) {
        existingDraftItems = slotDraftItems[slot.id];
      } else {
        existingDraftItems = entriesToDraftItems(
          buildDraftEntries(slot, draftGramsBySlot[slot.id], slotDraftItems[slot.id])
        );
      }
    }
    setMealAddContext({
      slotId: slot.id,
      slotLabel: slot.label,
      date,
      isLogged,
      userId,
      existingDraftItems,
    });
    markMealEditReopen(slot.id, date);
    navigate('/nutrition');
  };

  const getDisplayEntries = (slot: MealSlot, isDone: boolean): MealEditEntry[] => {
    if (isDone && loggedDisplayEntries[slot.id] !== undefined) return loggedDisplayEntries[slot.id];
    if (slotDraftItems[slot.id] !== undefined) {
      return buildDraftEntries(slot, undefined, slotDraftItems[slot.id]);
    }
    return slot.items.map((item, index) => ({
      key: `plan-${index}`,
      name: item.name,
      grams: draftGramsBySlot[slot.id]?.[index] ?? item.grams,
      planItem: item,
      macrosPer100: item.macrosPer100 ?? planItemToPer100(item),
    }));
  };

  const getSlotLiveEntries = (slot: MealSlot, isDone: boolean): MealEditEntry[] => {
    if (editSession?.slotId === slot.id) return editSession.entries;
    return getDisplayEntries(slot, isDone);
  };

  const planLiveCalories = mealPlan.slots.reduce((sum, slot) => {
    const totals = sumEntryMacros(getSlotLiveEntries(slot, isSlotDone(slot.id)));
    return sum + totals.calories;
  }, 0);

  const doneCount = mealPlan.slots.filter((slot) => isSlotDone(slot.id)).length;

  const commitEntryGrams = async (slot: MealSlot, entry: MealEditEntry, itemIndex: number, grams: number) => {
    if (!canEditDay) return;
    if (grams < 5 || grams > 5000) {
      setError(t('dashboard.editMealInvalidGrams'));
      return;
    }
    setError(null);
    const syncKey = entry.logId ?? `${slot.id}:${itemIndex}`;
    setSyncing(syncKey);
    try {
      if (entry.logId && canLogDay) {
        const res = await nutritionService.updateLog(entry.logId, grams);
        if (res.error) throw new Error(res.error);
        setLoggedDisplayEntries((prev) => ({
          ...prev,
          [slot.id]: (prev[slot.id] ?? []).map((row) => (row.key === entry.key ? { ...row, grams } : row)),
        }));
        setLoggedGramsBySlot((prev) => {
          const base = prev[slot.id] ?? [];
          const next = [...base];
          next[itemIndex] = grams;
          return { ...prev, [slot.id]: next };
        });
        await onRefresh?.();
      } else if (slotDraftItems[slot.id]?.length) {
        const items = [...slotDraftItems[slot.id]];
        const current = items[itemIndex];
        const per100 = draftItemToPer100(current);
        if (per100) {
          const scaled = macrosFromPer100(per100, grams);
          items[itemIndex] = {
            ...current,
            grams,
            macrosPer100: per100,
            calories: scaled.calories,
            protein: scaled.protein,
            carbs: scaled.carbs,
            fat: scaled.fat,
          };
        } else {
          items[itemIndex] = { ...current, grams };
        }
        const nextSlotDrafts = { ...slotDraftItems, [slot.id]: items };
        setSlotDraftItems(nextSlotDrafts);
        writeSlotDraftItems(userId, date, nextSlotDrafts);
      } else {
        const base = draftGramsBySlot[slot.id] ?? slot.items.map((row) => row.grams);
        const next = [...base];
        next[itemIndex] = grams;
        const nextDrafts = { ...draftGramsBySlot, [slot.id]: next };
        setDraftGramsBySlot(nextDrafts);
        writeMealDraftStore(userId, date, nextDrafts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.editMealSaveFailed'));
    } finally {
      setSyncing(null);
    }
  };

  const openMealDetails = (entry: MealEditEntry) => {
    const row = mealEntryToNutritionRow(entry);
    if (row) setMealDetailsRow(row);
  };

  const handlePickMealSlot = (slotId: string) => {
    const slot = mealPlan.slots.find((entry) => entry.id === slotId);
    if (!slot) return;
    setSlotPickerOpen(false);
    openNutritionForMeal(slot);
  };

  return (
    <div className="mt-3 space-y-3">
      {dayOffset !== 0 && dayLabel ? (
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-center text-xs font-semibold',
            dayOffset < 0
              ? 'border-gray-200 bg-gray-100/90 text-gray-600 dark:border-gray-700 dark:bg-white/[0.06] dark:text-gray-300'
              : 'border-brand-500/25 bg-brand-500/10 text-brand-700 dark:text-brand-300'
          )}
        >
          {dayOffset < 0
            ? t('dashboard.dietViewingPast', { day: dayLabel })
            : t('dashboard.dietViewingUpcoming', { day: dayLabel })}
          {!canLogDay ? (
            <span className="mt-0.5 block font-normal normal-case text-[10px] opacity-90">
              {isFutureDay ? t('dashboard.futureDayEditNoCheck') : t('dashboard.planViewOnlyHint')}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {highlightDietNumbers(
            t('dashboard.dietMacroSummary', {
              calories: String(Math.round(dayDiet.calories.current)),
              calTarget: String(dayDiet.calories.target),
              protein: String(Math.round(dayDiet.protein.current)),
              proTarget: String(dayDiet.protein.target),
            })
          )}
        </p>
        <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">
          {t('dashboard.mealsCompleted', { done: String(doneCount), total: String(mealPlan.slots.length) })}
        </span>
      </div>

      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {highlightDietNumbers(
          `${t('dashboard.mealsAndSnacks', {
            meals: String(mealPlan.mainMeals),
            snacks: String(mealPlan.snacks),
          })} ${'\u00b7'} ${t('dashboard.mealPlanTotal', {
            total: String(planLiveCalories),
            target: String(dayDiet.calories.target),
          })}`
        )}
      </p>

      {error ? <p className="text-xs font-medium text-error-500">{error}</p> : null}

      <ul className="space-y-2.5">
        {mealPlan.slots.map((slot) => {
          const isDone = isSlotDone(slot.id);
          const isSyncing = syncing === slot.id;
          const isEditing = editSession?.slotId === slot.id;
          const displayEntries = getDisplayEntries(slot, isDone);
          const liveEntries = getSlotLiveEntries(slot, isDone);
          const liveTotals = sumEntryMacros(liveEntries);
          return (
            <li
              key={slot.id}
              className={cn(
                'rounded-xl border p-3 transition-colors',
                isDone
                  ? 'border-brand-500/30 bg-brand-500/10'
                  : 'border-gray-200/90 bg-white/70 dark:border-gray-700 dark:bg-white/[0.03]'
              )}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => void toggleMeal(slot)}
                  disabled={Boolean(syncing) || !canLogDay}
                  aria-pressed={isDone}
                  aria-busy={isSyncing}
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                    isDone
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900',
                    (syncing && !isSyncing) || !canLogDay ? 'cursor-not-allowed opacity-50' : ''
                  )}
                >
                  {isSyncing ? (
                    <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                  ) : isDone ? (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  ) : null}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-800 dark:text-white/90">{slot.label}</h4>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                          slot.kind === 'snack'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-brand-500/15 text-brand-600 dark:text-brand-400'
                        )}
                      >
                        {slot.kind === 'snack' ? t('dashboard.mealKindSnack') : t('dashboard.mealKindMeal')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSlotEdit(slot)}
                      disabled={isSyncing || !canEditDay}
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide sm:ml-auto',
                        isEditing
                          ? 'border-brand-500 bg-brand-500 text-white hover:brightness-110'
                          : 'border-brand-500/30 bg-white text-brand-600 hover:bg-brand-500/10 dark:bg-gray-900 dark:text-brand-400',
                        !canEditDay && 'cursor-not-allowed opacity-50'
                      )}
                      aria-label={isEditing ? t('dashboard.doneEditing') : t('dashboard.editMeal')}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {isEditing ? 'check' : 'edit'}
                      </span>
                      {isEditing ? t('dashboard.doneEditing') : t('dashboard.editMeal')}
                    </button>
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    {highlightDietNumbers(
                      `${t('dashboard.mealTargetKcal', { kcal: String(liveTotals.calories) })}${
                        slot.kind === 'meal'
                          ? ` ${'\u00b7'} ${t('dashboard.mealTargetProtein', { grams: String(Math.round(liveTotals.protein)) })}`
                          : liveTotals.protein > 0
                            ? ` ${'\u00b7'} ${t('dashboard.mealTargetProtein', { grams: String(Math.round(liveTotals.protein)) })}`
                            : ''
                      }`
                    )}
                  </p>
                  {isEditing && editSession ? (
                    <MealSlotInlineEditor
                      entries={editSession.entries}
                      busyKey={syncing}
                      onChangeGrams={changeEditGrams}
                      onRemove={(key) => void removeEditEntry(slot, key)}
                      onAddFromNutrition={() => openNutritionForMeal(slot)}
                      onDetails={openMealDetails}
                    />
                  ) : (
                  <ul className="mt-2 space-y-1">
                    {displayEntries.map((entry, itemIndex) => {
                      const displayGrams = entry.grams;
                      const displayKcal = entryKcal(entry);
                      const itemSyncKey = entry.logId ?? `${slot.id}:${itemIndex}`;
                      return (
                      <li
                        key={entry.key}
                        className="flex items-center justify-between gap-2 text-xs text-gray-700 dark:text-gray-300"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="material-symbols-outlined shrink-0 text-[14px] text-brand-500">
                            restaurant
                          </span>
                          <span className="truncate">{entry.name}</span>
                          <PlanItemInfoButton
                            size="sm"
                            disabled={!mealEntryHasDetails(entry)}
                            onClick={() => openMealDetails(entry)}
                            ariaLabel={t('nutrition.details')}
                          />
                        </span>
                        <InlineGramPortion
                          grams={displayGrams}
                          kcal={displayKcal}
                          disabled={!canEditDay || Boolean(syncing && syncing !== itemSyncKey && syncing !== slot.id)}
                          isSaving={syncing === itemSyncKey}
                          onCommit={(grams) => commitEntryGrams(slot, entry, itemIndex, grams)}
                        />
                      </li>
                      );
                    })}
                  </ul>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={!canEditDay}
        onClick={() => setSlotPickerOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-500/35 bg-brand-500/5 py-2.5 text-xs font-semibold text-brand-600 hover:bg-brand-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-400"
      >
        <span className="material-symbols-outlined text-base">restaurant</span>
        {t('dashboard.logMeal')}
      </button>

      <MealSlotPickerModal
        open={slotPickerOpen}
        slots={mealPlan.slots.map((slot) => ({
          id: slot.id,
          label: slot.label,
          kind: slot.kind,
        }))}
        onSelect={(slot) => handlePickMealSlot(slot.id)}
        onClose={() => setSlotPickerOpen(false)}
      />

      <NutritionDetailsModal row={mealDetailsRow} onClose={() => setMealDetailsRow(null)} />
    </div>
  );
}

function WorkoutDietPlansCard({
  data,
  analytics,
  personalization,
  userId,
  signedUpDateKey,
  onRefresh,
}: {
  data: AthleteHomeDashboard;
  analytics: Analytics;
  personalization: AthletePersonalization;
  userId?: string;
  signedUpDateKey?: string | null;
  onRefresh?: () => Promise<void>;
}) {
  const { t, language } = useI18n();
  const [tab, setTab] = useState<'workout' | 'diet'>('workout');
  const apiTodayKey = data.today.date;
  const todayKey = useCalendarTodayKey(apiTodayKey);
  const [selectedDate, setSelectedDate] = useState(() => readPersistedSelectedDate(apiTodayKey));
  const [weekOffset, setWeekOffset] = useState(0);
  const prevTodayKeyRef = useRef(todayKey);

  useEffect(() => {
    if (prevTodayKeyRef.current === todayKey) return;
    prevTodayKeyRef.current = todayKey;
    setWeekOffset(0);
    const currentWeekDates = new Set(buildRollingWeekDays(todayKey, 0).map((d) => d.date));
    const shouldMoveToToday =
      selectedDate < todayKey || !currentWeekDates.has(selectedDate);
    if (shouldMoveToToday && !isBeforeSignupDate(todayKey, signedUpDateKey)) {
      setSelectedDate(todayKey);
      persistSelectedDate(todayKey);
    }
  }, [todayKey, selectedDate, signedUpDateKey]);

  const workoutsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of data.weekly) map.set(d.date, d.workouts);
    for (const h of data.heatmap ?? []) map.set(h.date, h.workouts);
    return map;
  }, [data.weekly, data.heatmap]);

  const splitLabel = personalization.preferredSplit
    ? localizeOnboardingDisplayValue('preferredSplit', personalization.preferredSplit, language)
    : null;

  const visibleWeekPlan = useMemo(
    () =>
      buildVisibleWeekPlan({
        todayKey,
        weekOffset,
        trainingDaysPerWeek: personalization.trainingDaysPerWeek,
        splitLabel,
        workoutsByDate,
      }),
    [todayKey, weekOffset, personalization.trainingDaysPerWeek, splitLabel, workoutsByDate]
  );

  const weekRangeLabel = useMemo(() => {
    const days = buildRollingWeekDays(todayKey, weekOffset);
    return formatWeekRangeLabel(days[0].date, days[6].date, language);
  }, [todayKey, weekOffset, language]);

  const workoutPlan = analytics.todayWorkoutPlan;
  const exercises =
    workoutPlan.exercises ?? [
      { name: 'Bench Press', sets: 4, reps: 12 },
      { name: 'Squats', sets: 4, reps: 12 },
      { name: 'Deadlifts', sets: 3, reps: 8 },
    ];
  const weekPlan = visibleWeekPlan;
  const diet =
    analytics.dietToday ?? {
      calories: { current: data.today.nutrition.calories, target: data.targets.calorieTarget },
      protein: { current: data.today.nutrition.protein, target: data.targets.proteinTarget },
      carbs: { current: data.today.nutrition.carbs, target: data.targets.carbTarget },
      fat: { current: data.today.nutrition.fat, target: data.targets.fatTarget },
      water: { currentMl: 0, targetMl: personalization.waterTargetMl || 2500 },
    };
  const mealPlan = analytics.todayMealPlan;

  useEffect(() => {
    if (weekPlan.some((d) => d.date === selectedDate)) return;
    const fallback =
      weekPlan.find((d) => d.status === 'today' && !isBeforeSignupDate(d.date, signedUpDateKey))?.date ??
      weekPlan.find((d) => !isBeforeSignupDate(d.date, signedUpDateKey))?.date ??
      todayKey;
    setSelectedDate(fallback);
    persistSelectedDate(fallback);
  }, [weekPlan, selectedDate, todayKey, signedUpDateKey]);

  useEffect(() => {
    if (!signedUpDateKey) return;
    if (isBeforeSignupDate(selectedDate, signedUpDateKey)) {
      setSelectedDate(signedUpDateKey);
      persistSelectedDate(signedUpDateKey);
    }
    const minOffset = minPastWeekOffset(todayKey, signedUpDateKey);
    if (weekOffset < minOffset) setWeekOffset(minOffset);
  }, [signedUpDateKey, selectedDate, todayKey, weekOffset]);

  const selectedDay = weekPlan.find((d) => d.date === selectedDate) ?? weekPlan.find((d) => d.status === 'today');
  const isRestDay = selectedDay?.status === 'rest';
  const selectedDayLabel = selectedDay
    ? formatWeekdayLabel(selectedDay.day, language, t, false)
    : undefined;

  const selectDate = (nextDate: string) => {
    if (isBeforeSignupDate(nextDate, signedUpDateKey)) return;
    setSelectedDate(nextDate);
    persistSelectedDate(nextDate);
  };

  const isFutureDay = isFuturePlanDate(selectedDate, todayKey);
  const canLogSelectedDay = canLogPlanDate(selectedDate, todayKey);
  const minWeekOffset = signedUpDateKey ? minPastWeekOffset(todayKey, signedUpDateKey) : null;
  const canGoPrevWeek = minWeekOffset == null || weekOffset > minWeekOffset;
  const canGoNextWeek = weekOffset < maxFutureWeekOffset(todayKey);

  const pickDateInWeek = (days: Array<{ date: string }>) => {
    const matched = sameWeekdayInWeek(selectedDate, days);
    if (matched && !isBeforeSignupDate(matched, signedUpDateKey)) return matched;
    const todayInWeek = days.find((d) => d.date === todayKey && !isBeforeSignupDate(d.date, signedUpDateKey))?.date;
    if (todayInWeek) return todayInWeek;
    return days.find((d) => !isBeforeSignupDate(d.date, signedUpDateKey))?.date ?? selectedDate;
  };

  const shiftWeek = (delta: number) => {
    setWeekOffset((prev) => {
      if (!canShiftWeekOffset(prev, delta, todayKey, signedUpDateKey)) return prev;
      const nextOffset = prev + delta;
      const days = buildRollingWeekDays(todayKey, nextOffset);
      const nextDate = pickDateInWeek(days);
      setSelectedDate(nextDate);
      persistSelectedDate(nextDate);
      return nextOffset;
    });
  };

  const statusLabel = (status: string) => {
    if (status === 'done') return t('dashboard.done');
    if (status === 'today') return t('dashboard.todayLabel');
    if (status === 'rest') return t('dashboard.restDay');
    return t('dashboard.planned');
  };

  return (
    <div className={cn(CARD, 'flex min-h-[220px] flex-col p-5 sm:p-6 md:p-7')}>
      <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 sm:text-xl">
        {t('dashboard.workoutDietPlans')}
      </h3>

      <div className="mt-3 flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800/80">
        <button
          type="button"
          onClick={() => setTab('workout')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-xs font-semibold transition-all sm:text-sm',
            tab === 'workout'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          )}
        >
          <span className="material-symbols-outlined text-base">fitness_center</span>
          {t('dashboard.tabWorkout')}
        </button>
        <button
          type="button"
          onClick={() => setTab('diet')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-xs font-semibold transition-all sm:text-sm',
            tab === 'diet'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          )}
        >
          <span className="material-symbols-outlined text-base">nutrition</span>
          {t('dashboard.tabDiet')}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
          {t('dashboard.daysPerWeek', { days: String(personalization.trainingDaysPerWeek) })}
          {personalization.preferredSplit
            ? ` · ${localizeOnboardingDisplayValue('preferredSplit', personalization.preferredSplit, language)}`
            : ''}
        </p>
        <p className="text-[11px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">
          {t('dashboard.weekRange', { range: weekRangeLabel })}
        </p>
      </div>

      <div className="mt-3 flex items-stretch gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          disabled={!canGoPrevWeek}
          className={cn(
            'flex w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300',
            canGoPrevWeek
              ? 'hover:border-brand-500/40 hover:bg-brand-500/5 hover:text-brand-600 dark:hover:border-brand-500/40 dark:hover:text-brand-400'
              : 'cursor-not-allowed opacity-40'
          )}
          aria-label={t('dashboard.prevWeek')}
        >
          <span className="material-symbols-outlined text-[22px]">chevron_left</span>
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-7 gap-0.5 sm:gap-1">
        {weekPlan.map((d) => {
          const done = d.status === 'done';
          const isToday = d.date === todayKey;
          const isRest = d.status === 'rest';
          const isSelected = selectedDate === d.date;
          const isLocked = isBeforeSignupDate(d.date, signedUpDateKey);
          return (
            <button
              type="button"
              key={d.date}
              disabled={isLocked}
              onClick={() => selectDate(d.date)}
              className={cn(
                'flex min-w-0 flex-col items-center gap-0.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
                isLocked
                  ? 'cursor-not-allowed opacity-30'
                  : 'hover:opacity-90'
              )}
              title={`${formatWeekdayLabel(d.day, language, t, false)} — ${statusLabel(d.status)}${d.splitLabel ? ` (${d.splitLabel})` : ''}`}
              aria-pressed={isSelected}
              aria-label={`${formatWeekdayLabel(d.day, language, t, false)}, ${statusLabel(d.status)}`}
            >
              <span
                className={cn(
                  'w-full truncate text-center text-[7px] font-bold xs:text-[8px] sm:text-[9px]',
                  isSelected ? 'text-brand-600 dark:text-brand-400' : 'text-gray-500'
                )}
              >
                {formatWeekdayLabel(d.day, language, t)}
              </span>
              <div
                className={cn(
                  'flex h-7 w-full items-center justify-center rounded-md border sm:h-8',
                  isSelected && 'ring-2 ring-brand-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-900',
                  done
                    ? 'border-brand-500/40 bg-brand-500/15'
                    : isToday
                      ? 'border-brand-500 bg-brand-500/10'
                      : isRest
                        ? 'border-gray-200/60 bg-gray-100/50 dark:border-gray-800 dark:bg-white/[0.02]'
                        : 'border-gray-200/90 bg-gray-50/80 dark:border-gray-700 dark:bg-white/[0.03]'
                )}
              >
                {done ? (
                  <span className="material-symbols-outlined text-brand-500" style={{ fontSize: 15 }}>
                    check_circle
                  </span>
                ) : isRest ? (
                  <span className="text-[8px] font-bold uppercase text-gray-400">{t('dashboard.restDayShort')}</span>
                ) : (
                  <span
                    className={cn(
                      'h-3 w-3 rounded-full border-2 sm:h-3.5 sm:w-3.5',
                      isToday ? 'border-brand-500 bg-brand-500/20' : 'border-gray-300 dark:border-gray-600'
                    )}
                  />
                )}
              </div>
            </button>
          );
        })}
        </div>
        <button
          type="button"
          onClick={() => shiftWeek(1)}
          disabled={!canGoNextWeek}
          className={cn(
            'flex w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300',
            canGoNextWeek
              ? 'hover:border-brand-500/40 hover:bg-brand-500/5 hover:text-brand-600 dark:hover:border-brand-500/40 dark:hover:text-brand-400'
              : 'cursor-not-allowed opacity-40'
          )}
          aria-label={t('dashboard.nextWeek')}
        >
          <span className="material-symbols-outlined text-[22px]">chevron_right</span>
        </button>
      </div>

      {!canLogSelectedDay ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <span className="material-symbols-outlined shrink-0 text-base text-amber-600 dark:text-amber-400">
            info
          </span>
          <p>{isFutureDay ? t('dashboard.futureDayNotRecorded') : t('dashboard.planViewOnlyAlert')}</p>
        </div>
      ) : null}

      {tab === 'workout' ? (
        <WorkoutExerciseChecklist
          key={selectedDate}
          workoutPlan={analytics.todayWorkoutPlan}
          plannedExercises={exercises}
          date={selectedDate}
          todayKey={todayKey}
          dayLabel={selectedDayLabel}
          isRestDay={isRestDay}
          userId={userId}
          onRefresh={onRefresh}
        />
      ) : mealPlan ? (
        <DietMealChecklist
          key={selectedDate}
          mealPlan={mealPlan}
          diet={diet}
          date={selectedDate}
          todayKey={todayKey}
          dayLabel={selectedDayLabel}
          userId={userId}
          onRefresh={onRefresh}
        />
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t('dashboard.logMealMacros')}
        </div>
      )}
    </div>
  );
}

function ActivityTable({ data }: { data: AthleteHomeDashboard }) {
  const { t, language } = useI18n();
  return (
    <div className={cn(CARD, 'overflow-hidden px-4 pb-3 pt-4 sm:px-6')}>
      <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">{t('dashboard.todayActivity')}</h3>
      {data.timeline.length === 0 ? (
        <p className="py-8 text-center text-theme-sm text-gray-500">{t('dashboard.noActivity')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="pb-3 text-left text-theme-xs font-medium text-gray-500">{t('dashboard.activityTime')}</th>
                <th className="pb-3 text-left text-theme-xs font-medium text-gray-500">{t('dashboard.activityLabel')}</th>
                <th className="pb-3 text-left text-theme-xs font-medium text-gray-500">{t('dashboard.activityDetail')}</th>
                <th className="pb-3 text-left text-theme-xs font-medium text-gray-500">{t('dashboard.activityType')}</th>
              </tr>
            </thead>
            <tbody>
              {data.timeline.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800/80">
                  <td className="py-3 text-theme-sm text-gray-500">
                    {new Date(row.at).toLocaleTimeString(localeTag(language), {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 font-medium text-gray-800 dark:text-white/90">
                    {row.title}
                  </td>
                  <td className="py-3 text-theme-sm text-gray-500">
                    {formatTimelineSubtitle(row.subtitle, language, t)}
                  </td>
                  <td className="py-3">
                    <Badge color={row.type === 'workout' ? 'primary' : 'warning'}>
                      {localizeActivityType(row.type, t)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const AthleteTailAdminDashboard: React.FC = () => {
  const authUser = useAuthStore((s) => s.user);
  const [data, setData] = useState<AthleteHomeDashboard | null>(null);
  const { t, language } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wellnessRevision = useWellnessRevision();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await dashboardService.athleteHome();
      if (res.error) setError(res.error);
      else {
        setError(null);
        setData(res.data ?? null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(msg);
      setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, language]);

  const analytics = useMemo(
    () => (data ? data.analytics ?? buildAnalyticsFallback(data) : null),
    [data]
  );

  const sleepPreference = useMemo(() => {
    if (!data) return null;
    const plan = personalizationFallback(data);
    return (
      plan.sleep ??
      (authUser?.profile?.onboardingData as { sleep?: string } | undefined)?.sleep ??
      null
    );
  }, [data, authUser]);

  const fitnessScore = useMemo(() => {
    if (!data) return 0;
    return computeFitnessScore(data, { userId: authUser?.id, sleepPreference, t }).score;
  }, [data, authUser?.id, sleepPreference, t, wellnessRevision]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="animate-pulse font-medium text-brand-500">{t('dashboard.loading')}</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={cn(CARD, 'p-8 text-center')}>
        <p className="text-error-500">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white"
        >
          {t('dashboard.retry')}
        </button>
      </div>
    );
  }

  if (!data || !analytics) {
    return (
      <div className={cn(CARD, 'p-8 text-center')}>
        <p className="text-gray-600 dark:text-gray-400">{t('dashboard.loadIncomplete')}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white"
        >
          {t('dashboard.retry')}
        </button>
      </div>
    );
  }

  const personalization = personalizationFallback(data);
  const trainingTarget = personalization.trainingDaysPerWeek;

  return (
    <div className="athlete-dashboard page-shell w-full min-w-0 max-w-full flex-1 pb-2">
      <AthleteProfileHeaderCard
        authUser={authUser}
        data={data}
        analytics={analytics}
        plan={personalization}
        fitnessScore={fitnessScore}
        onRefresh={load}
      />
      <CoachPlanStrip plan={personalization} />

      <div className="grid min-h-0 w-full max-w-full grid-cols-12 items-start gap-[clamp(0.5rem,1.25dvh,1.5rem)]">
        {/* KPI row */}
        <div className="col-span-12">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4 md:gap-5">
            <FitnessScoreKpiCard
              data={data}
              userId={authUser?.id}
              sleepPreference={sleepPreference}
            />
            <CaloriesKpiFlipCard data={data} calorieAdherence={analytics.calorieAdherenceToday} />
            <WorkoutCompletionKpiCard
              data={data}
              workoutCompletionWeek={analytics.workoutCompletionWeek}
              workoutCompletionToday={analytics.workoutCompletionToday}
              trainingTarget={trainingTarget}
            />
            <CurrentWeightKpiCard
              data={data}
              userId={authUser?.id}
              bodyScore={analytics.bodyScore}
            />
          </div>
        </div>

        {/* Hero: Workout & Diet Plans (primary) + AI Summary (sidebar) */}
        <div className="col-span-12 min-w-0 lg:col-span-8">
          <WorkoutDietPlansCard
            data={data}
            analytics={analytics}
            personalization={personalization}
            userId={authUser?.id}
            signedUpDateKey={authUser?.createdAt?.slice(0, 10) ?? null}
            onRefresh={() => load(true)}
          />
        </div>
        <div className="col-span-12 flex min-w-0 flex-col gap-3 sm:gap-4 lg:col-span-4">
          <AiDailySummaryCard alerts={resolveDashboardAiAlerts(data)} />
          <SleepRhythmCard
            sleepPreference={
              personalization.sleep ??
              (authUser?.profile?.onboardingData as { sleep?: string } | undefined)?.sleep
            }
            userId={authUser?.id}
          />
          <HydrationPulseCard
            baseMl={analytics.dietToday?.water.currentMl ?? 0}
            targetMl={analytics.dietToday?.water.targetMl ?? personalization.waterTargetMl ?? 2500}
            userId={authUser?.id}
            dateKey={data.today.date}
          />
        </div>

        <div className="col-span-12">
          <ActivityTable data={data} />
        </div>
      </div>
    </div>
  );
};
