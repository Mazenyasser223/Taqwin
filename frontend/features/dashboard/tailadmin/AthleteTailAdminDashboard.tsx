import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import { usePageChromeStore } from '../../../store/usePageChromeStore';
import dashboardService, {
  type AthleteHomeDashboard,
  type AthletePersonalization,
} from '../../../services/dashboardService';
import nutritionService, { type PlanMealLogItem } from '../../../services/nutritionService';
import gymService from '../../../services/gymService';
import type { FoodItem, FoodLog, GymMembership, User } from '../../../types';
import { Badge } from '../../../components/tailadmin/Badge';
import { Logo } from '../../../components/shared/Logo';
import { isTransientApiError } from '../../../lib/apiTransientError';
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
import { normalizeCatalogDisplayName } from '../../onboarding/catalogLocale';
import { resolveExerciseDisplayName } from '../../workouts/exerciseLocale';
import { WorkoutExerciseChecklist } from '../WorkoutExerciseChecklist';
import { MealSlotInlineEditor, type MealEditEntry } from '../MealSlotInlineEditor';
import {
  foodItemToMacrosPer100,
  mealEntryFromFoodLog,
  mealEntryHasDetails,
  mealEntryToNutritionRow,
} from '../mealEntryDetails';
import { PlanItemInfoButton } from '../PlanItemInfoButton';
import { NutritionDetailsModal } from '../../nutrition/NutritionDetailsModal';
import type { NutritionFoodRow } from '../../nutrition/NutritionFoodList';
import {
  consumeMealEditReopen,
  emitMealPlanChanged,
  markMealEditReopen,
  MEAL_PLAN_CHANGED,
  readMealLogItemCache,
  setMealAddContext,
  setMealPlanSlotsContext,
  writeMealLogItemCache,
} from '../mealAddContext';
import type { MealCaptureApplyResult } from '../mealCaptureApply';
import { MealSlotPickerModal } from '../MealSlotPickerModal';
import { MealAddMethodModal } from '../MealAddMethodModal';
import { CaptureMealModal } from '../CaptureMealModal';
import { BarcodeScanModal } from '../BarcodeScanModal';
import { entryKcal, macrosFromPer100, planItemToPer100, sumEntryMacros, type MacrosPer100 } from '../mealEntryMacros';
import {
  buildVisibleWeekPlan,
  formatWeekRangeLabel,
  sameWeekdayInWeek,
  buildRollingWeekDays,
  getClientTodayKey,
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
import { DailyReadinessCard } from '../DailyReadinessCard';
import { FitnessScoreKpiCard } from '../FitnessScoreKpiCard';
import { CompeteHomeSection } from '../../compete/CompeteHomeSection';
import gamificationService, { type GamificationProfile } from '../../../services/gamificationService';
import { xpLevelProgress } from '../../compete/xpLevel';
import { WorkoutCompletionKpiCard } from '../WorkoutCompletionKpiCard';
import { computeFitnessScore } from '../fitnessScore';
import { SleepRhythmCard } from '../SleepRhythmCard';
import {
  buildMealPlanForSelectedDay,
  normalizePlanSelectedDate,
  hasPostgresTodayPlan,
  hasOfficialWeekPlan,
  mergePostgresIntoWeekStrip,
  planSourceBadgeKey,
  resolveDayDietView,
  resolveDayWorkoutView,
  resolveTodayPlanInsight,
  todayLabelInRollingWeek,
} from '../athlete/resolveDashboardToday';
import { isOfficialOnboardingComplete } from '../../onboarding/questionnaireCompletion';
import {
  addWaterBoostMl,
  readWaterBoostMl,
  useWellnessRevision,
  emitWellnessChanged,
} from '../wellnessWidgets';
import { WeeklyAdaptationReviewModal } from '../WeeklyAdaptationReviewModal';
import adaptationService from '../../../services/adaptationService';
import plansService from '../../../services/plansService';
import { useDashboardRefreshListener } from '../wellnessWidgets';
import { CommerceRecommendationCard } from '../../commerce/CommerceRecommendationCard';
import { DietPlanCommerceCard } from '../../commerce/DietPlanCommerceCard';
import { ReorderBanner } from '../../commerce/ReorderBanner';
import { useCommerceRecommendations, useDietPlanCommerce } from '../../commerce/useCommerceRecommendations';
import { writeLiveDietTotals } from '../liveDashboardTotals';
import { PlanGenerationLiveView } from '../PlanGenerationLiveView';
import {
  clearPlanGenerationRequested,
  isActivePlanGenerationRequest,
} from '../../../services/planGenerationPoll';
import { usePlanGenerationSessionStore } from '../../../store/usePlanGenerationSessionStore';

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
  const a = data.analytics;
  const calorieAdherenceToday =
    a?.calorieAdherenceToday ??
    (data.targets.calorieTarget > 0
      ? Math.round((data.today.nutrition.calories / data.targets.calorieTarget) * 100)
      : 0);
  const proteinAdherenceToday =
    a?.proteinAdherenceToday ??
    (data.targets.proteinTarget > 0
      ? Math.round((data.today.nutrition.protein / data.targets.proteinTarget) * 100)
      : 0);
  const workoutDaysWeek = data.weekly.filter((d) => d.workouts > 0).length;
  const weightTrend =
    a?.weightTrend ??
    data.weekly.map((d, i) => ({
      label: d.day,
      date: d.date,
      weight: data.profile.weight != null ? Math.round((data.profile.weight - (6 - i) * 0.2) * 10) / 10 : null,
      source: 'fallback' as const,
    }));
  return {
    calorieAdherenceToday,
    proteinAdherenceToday,
    workoutCompletionWeek: a?.workoutCompletionWeek ?? Math.round((workoutDaysWeek / 7) * 100),
    workoutCompletionToday: a?.workoutCompletionToday ?? 0,
    weightLog: a?.weightLog ?? [],
    weightDeltaWeek: a?.weightDeltaWeek ?? 0,
    bodyScore: a?.bodyScore ?? data.today.readinessScore,
    weightTrend,
    weeklyAdherence: a?.weeklyAdherence ?? {
      categories: ['Workout', 'Calories', 'Protein', 'Activity', 'Consistency'],
      values: [
        Math.round((workoutDaysWeek / 7) * 100),
        calorieAdherenceToday,
        proteinAdherenceToday,
        Math.min(100, Math.round((data.totals.minutes / 150) * 100)),
        Math.min(100, data.streak * 14),
      ],
    },
    volumeProgress:
      a?.volumeProgress ??
      data.weekly.map((d) => ({
        label: d.day,
        volume: d.minutes * Math.max(1, d.workouts),
      })),
    prediction:
      a?.prediction ??
      data.weekly.map((d, i) => ({
        label: d.day,
        actual: weightTrend[i]?.weight ?? null,
      })),
    dataProvenance: a?.dataProvenance,
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

function AthleteProfileHeaderCard({
  authUser,
  data,
  plan,
  onRefresh,
}: {
  authUser: User | null;
  data: AthleteHomeDashboard;
  plan: AthletePersonalization;
  onRefresh: () => void;
}) {
  const { t, language } = useI18n();
  const [membership, setMembership] = useState<GymMembership | null>(null);
  const [gamificationProfile, setGamificationProfile] = useState<GamificationProfile | null>(null);
  const [xpLoading, setXpLoading] = useState(true);

  const loadGamification = useCallback(async () => {
    setXpLoading(true);
    try {
      const res = await gamificationService.me();
      if (res.data?.profile) setGamificationProfile(res.data.profile);
    } finally {
      setXpLoading(false);
    }
  }, []);

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

  useEffect(() => {
    void loadGamification();
  }, [loadGamification]);

  useDashboardRefreshListener(() => {
    void loadGamification();
  });

  const handleRefresh = () => {
    onRefresh();
    void loadGamification();
  };

  const displayName =
    data.profile.displayName ||
    authUser?.profile?.displayName ||
    authUser?.email?.split('@')[0] ||
    t('dashboard.defaultAthlete');
  const email = authUser?.email ?? '';
  const avatarUrl = authUser?.profile?.avatarUrl ?? authUser?.avatar ?? null;
  const levelLabel = formatFitnessLevel(plan.fitnessLevel || data.profile.fitnessLevel, language, t);
  const lifetimeXp = gamificationProfile?.lifetimeXp ?? 0;
  const leagueTier = gamificationProfile?.currentTier ?? 'bronze';
  const { ptsToNext, level: xpLevel } = xpLevelProgress(lifetimeXp);
  const isPro = Boolean(membership) || lifetimeXp >= 500;
  const hasPlanChips = plan.chips.length > 0;

  const renewalLabel = membership?.expiresAt
    ? new Date(membership.expiresAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <section className={cn(CARD, 'mb-3 overflow-hidden')}>
      <div className="px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="relative shrink-0">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200/80 dark:bg-white/[0.06] dark:ring-gray-700 sm:h-14 sm:w-14">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-2xl text-brand-600 dark:text-brand-400 sm:text-[28px]">
                    person
                  </span>
                )}
              </div>
              {isPro ? (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white">
                  {t('dashboard.profilePro')}
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold text-gray-900 dark:text-white sm:text-lg">{displayName}</h1>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-white/[0.06] dark:text-gray-200">
                  <span className="material-symbols-outlined text-[13px] text-brand-500">military_tech</span>
                  {t('dashboard.profileLevel', { level: levelLabel })}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-white/[0.06] dark:text-gray-200">
                  <span className="material-symbols-outlined text-[13px] text-gray-400">card_membership</span>
                  {membership ? t('dashboard.profileMembershipActive') : t('dashboard.profileMembershipFree')}
                </span>
                {renewalLabel ? (
                  <span className="hidden rounded-md border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500 dark:border-gray-700 dark:text-gray-400 sm:inline">
                    {t('dashboard.profileRenewal')}: {renewalLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:shrink-0 lg:justify-end">
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <span className="material-symbols-outlined text-lg">bolt</span>
              </div>
              <div className="min-w-0 leading-tight">
                <p
                  className={cn(
                    'text-base font-bold tabular-nums text-gray-900 dark:text-white sm:text-lg',
                    xpLoading && 'animate-pulse opacity-60',
                  )}
                >
                  {xpLoading ? '—' : lifetimeXp.toLocaleString()}
                </p>
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  {t('dashboard.profileLifetimeXp')} · {t('dashboard.profileXpLevel', { level: String(xpLevel) })}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  {t('dashboard.profilePtsToNext', { pts: String(ptsToNext) })}
                  {' · '}
                  {t(`compete.tier.${leagueTier}` as TranslationKey)}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                title={t('dashboard.refresh')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:border-brand-500/40 hover:text-brand-600 dark:border-gray-700 dark:bg-white/[0.04] dark:text-gray-200 sm:w-auto sm:gap-1 sm:px-3"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>
                <span className="hidden text-xs font-semibold sm:inline">{t('dashboard.refresh')}</span>
              </button>
              <Link
                to="/dashboard/plans?tab=workout"
                className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-brand-500 px-3 text-xs font-bold text-white transition hover:bg-brand-600 sm:flex-none sm:px-4"
              >
                <span className="material-symbols-outlined text-base">bolt</span>
                {t('dashboard.startWorkout')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {hasPlanChips ? (
        <div className="border-t border-gray-100 px-4 py-2.5 dark:border-gray-800/80 sm:px-5 sm:py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {plan.chips.map((chip) => (
                <span
                  key={`${chip.icon}-${chip.label}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] font-medium text-gray-700 dark:bg-white/[0.04] dark:text-gray-200"
                >
                  <span className="material-symbols-outlined text-sm text-brand-500">{chip.icon}</span>
                  <span className="truncate">{localizePersonalizationChipLabel(chip.label, language, t)}</span>
                </span>
              ))}
            </div>
            <Link
              to="/profile"
              className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-brand-500/40 hover:text-brand-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-brand-400"
            >
              <span className="material-symbols-outlined text-base">edit_note</span>
              {t('dashboard.completeProfile')}
            </Link>
          </div>
        </div>
      ) : null}
    </section>
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

function mealItemDisplayName(name: unknown, fallback = 'Food'): string {
  return normalizeCatalogDisplayName(name, fallback);
}

function scaleMealItemForLog(
  item: NonNullable<Analytics['todayMealPlan']>['slots'][number]['items'][number],
  grams: number
): PlanMealLogItem {
  const per100 = planItemToPer100(item);
  if (per100) {
    const scaled = macrosFromPer100(per100, grams);
    return {
      name: mealItemDisplayName(item.name),
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
    name: mealItemDisplayName(item.name),
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
        name: mealItemDisplayName(entry.name),
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
      name: mealItemDisplayName(entry.name),
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
      key: `draft-${index}-${mealItemDisplayName(item.name)}`,
      name: mealItemDisplayName(item.name),
      grams: item.grams,
      webtebId: item.webtebId ?? undefined,
      macrosPer100: draftItemToPer100(item),
    }));
  }
  return slot.items.map((item, index) => ({
    key: `plan-${index}`,
    name: mealItemDisplayName(item.name),
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
        const itemName = mealItemDisplayName(item.name).trim().toLowerCase();
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

function buildLogIdsBySlotFromApi(
  logs: FoodLog[],
  slots: MealSlot[],
  local: Record<string, string[]>,
  apiOk: boolean
): Record<string, string[]> {
  const merged: Record<string, string[]> = {};
  const slotIds = new Set(slots.map((s) => s.id));

  for (const log of logs) {
    const slotId = log.mealSlotId;
    if (!slotId || !slotIds.has(slotId)) continue;
    const ids = merged[slotId] ?? [];
    if (!ids.includes(log.id)) merged[slotId] = [...ids, log.id];
  }

  if (apiOk) {
    const apiIds = new Set(logs.map((l) => l.id));
    for (const [slotId, ids] of Object.entries(local)) {
      if (!slotIds.has(slotId)) continue;
      for (const id of ids) {
        if (!apiIds.has(id)) continue;
        const current = merged[slotId] ?? [];
        if (!current.includes(id)) merged[slotId] = [...current, id];
      }
    }
  } else {
    for (const [slotId, ids] of Object.entries(local)) {
      if (slotIds.has(slotId) && ids.length) merged[slotId] = [...ids];
    }
  }

  const assigned = new Set(Object.values(merged).flat());
  const orphans = logs.filter((l) => !assigned.has(l.id));
  if (orphans.length) {
    const inferred = inferLogIdsBySlotFromLogs(orphans, slots);
    for (const [slotId, ids] of Object.entries(inferred)) {
      const current = merged[slotId] ?? [];
      merged[slotId] = [...new Set([...current, ...ids])];
    }
  }

  return merged;
}

function buildLoggedEntries(
  _slot: MealSlot,
  logIds: string[],
  logsById: Map<
    string,
    {
      id: string;
      grams: number;
      foodItem?: {
        id?: string;
        name: string;
        displayName?: string;
        webtebId?: number | null;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
      };
    }
  >,
  fallbackItems?: PlanMealLogItem[]
): MealEditEntry[] {
  return logIds
    .map((logId, index): MealEditEntry | null => {
      const log = logsById.get(logId);
      const fallback = fallbackItems?.[index];
      if (!log) {
        if (!fallback) return null;
        return {
          key: logId,
          name: mealItemDisplayName(fallback.name),
          grams: fallback.grams ?? 100,
          logId,
          webtebId: fallback.webtebId ?? undefined,
          macrosPer100: draftItemToPer100(fallback),
        };
      }
      const foodItem = log.foodItem;
      const macrosPer100 = foodItem
        ? {
            calories: foodItem.calories,
            protein: foodItem.protein,
            carbs: foodItem.carbs,
            fat: foodItem.fat,
          }
        : fallback
          ? draftItemToPer100(fallback)
          : undefined;
      const normalizedFoodItem = foodItem
        ? ({
            ...foodItem,
            category: (foodItem as FoodItem).category ?? 'user-kitchen',
            isPublic: (foodItem as FoodItem).isPublic ?? false,
          } as FoodItem)
        : undefined;
      return {
        key: logId,
        name: mealItemDisplayName(
          foodItem?.displayName ?? foodItem?.name ?? fallback?.name ?? 'Food'
        ),
        grams: log.grams ?? fallback?.grams ?? 100,
        logId,
        foodItemId: foodItem?.id,
        foodItem: normalizedFoodItem,
        webtebId:
          foodItem?.webtebId != null && Number(foodItem.webtebId) > 0
            ? Number(foodItem.webtebId)
            : fallback?.webtebId ?? undefined,
        macrosPer100,
      };
    })
    .filter((entry): entry is MealEditEntry => entry != null);
}

function draftItemsToLoggedEntries(logIds: string[], draftItems: PlanMealLogItem[]): MealEditEntry[] {
  return logIds.map((logId, index) => {
    const item = draftItems[index];
    return {
      key: logId,
      name: mealItemDisplayName(item?.name ?? 'Food'),
      grams: item?.grams ?? 100,
      logId,
      webtebId: item?.webtebId ?? undefined,
      macrosPer100: item ? draftItemToPer100(item) : undefined,
    };
  });
}

async function fetchLoggedDisplayForSlots(
  date: string,
  slots: MealSlot[],
  logIdsBySlot: Record<string, string[]>,
  itemCache: Record<string, PlanMealLogItem[]> = {}
): Promise<{
  grams: Record<string, number[]>;
  entries: Record<string, MealEditEntry[]>;
}> {
  const slotIds = Object.keys(logIdsBySlot).filter((slotId) => (logIdsBySlot[slotId]?.length ?? 0) > 0);
  if (!slotIds.length) return { grams: {}, entries: {} };

  const res = await nutritionService.getMyLogs(date);
  const logs = res.data ?? [];
  const gramsByLogId = new Map(logs.map((log) => [log.id, log.grams]));
  const logsById = new Map(logs.map((log) => [log.id, log]));
  const grams: Record<string, number[]> = {};
  const entries: Record<string, MealEditEntry[]> = {};

  for (const slotId of slotIds) {
    const slot = slots.find((entry) => entry.id === slotId);
    if (!slot) continue;
    const ids = logIdsBySlot[slotId] ?? [];
    if (!ids.length) continue;
    grams[slotId] = ids.map(
      (logId, index) => gramsByLogId.get(logId) ?? itemCache[slotId]?.[index]?.grams ?? 100
    );
    entries[slotId] = buildLoggedEntries(slot, ids, logsById, itemCache[slotId]);
  }

  return { grams, entries };
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
  onLiveTotalsChange,
}: {
  mealPlan: NonNullable<Analytics['todayMealPlan']>;
  diet: NonNullable<Analytics['dietToday']>;
  date: string;
  todayKey: string;
  dayLabel?: string;
  userId?: string;
  onRefresh?: () => Promise<void>;
  onLiveTotalsChange?: (totals: { calories: number; protein: number; carbs: number; fat: number } | null) => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const initial = readMealCheckStore(userId, date);
  const [prepChecked, setPrepChecked] = useState<Set<string>>(() => initial.prepChecked);
  const [logIdsBySlot, setLogIdsBySlot] = useState<Record<string, string[]>>(() => initial.logIdsBySlot);
  const [pendingLogSlots, setPendingLogSlots] = useState<Set<string>>(() => new Set());
  const [optimisticLoggedEntries, setOptimisticLoggedEntries] = useState<Record<string, MealEditEntry[]>>(
    {}
  );
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
      if (isSlotLogged(slotId) || pendingLogSlots.has(slotId)) return true;
      return canLogDay && prepChecked.has(slotId);
    },
    [isSlotLogged, prepChecked, canLogDay, pendingLogSlots]
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
  const errorDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTransientError = useCallback((msg: string | null) => {
    if (errorDismissRef.current) clearTimeout(errorDismissRef.current);
    setError(msg);
    if (msg && /Cannot reach the API|Network error|Failed to fetch|timed out/i.test(msg)) {
      errorDismissRef.current = setTimeout(() => setError(null), 7000);
    }
  }, []);
  const [editSession, setEditSession] = useState<{ slotId: string; entries: MealEditEntry[] } | null>(null);
  const [mealDetailsRow, setMealDetailsRow] = useState<NutritionFoodRow | null>(null);
  const [mealDetailsPending, setMealDetailsPending] = useState(false);
  const [mealDetailsPendingTitle, setMealDetailsPendingTitle] = useState('');
  const [mealDetailsPendingError, setMealDetailsPendingError] = useState<string | null>(null);
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);
  const [slotPickerMode, setSlotPickerMode] = useState<'log' | 'capture' | null>(null);
  const [pendingCaptureSlot, setPendingCaptureSlot] = useState<MealSlot | null>(null);
  const [captureMethodOpen, setCaptureMethodOpen] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<MealSlot | null>(null);
  const [barcodeTarget, setBarcodeTarget] = useState<MealSlot | null>(null);

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

  const mealSlotIdsKey = useMemo(
    () => mealPlan.slots.map((slot) => slot.id).join('|'),
    [mealPlan.slots]
  );

  const syncLoggedDisplay = useCallback(
    async (logIds: Record<string, string[]>) => {
      const cache = readMealLogItemCache(userId, date);
      const res = await nutritionService.getMyLogs(date);
      const apiOk = !res.error && Array.isArray(res.data);
      const logs = res.data ?? [];
      const apiMerged = buildLogIdsBySlotFromApi(logs, mealPlan.slots, logIds, apiOk);
      // Merge with current React state — never drop a slot the user didn't explicitly uncheck
      let merged = apiMerged;
      setLogIdsBySlot((prev) => {
        const result: Record<string, string[]> = {};
        // Start from prev, then apply API-confirmed data on top
        for (const [slotId, ids] of Object.entries(prev)) {
          if (ids.length > 0) result[slotId] = ids;
        }
        for (const [slotId, ids] of Object.entries(apiMerged)) {
          if (ids.length > 0) result[slotId] = ids;
        }
        merged = result;
        return result;
      });
      if (userId) {
        const store = readMealCheckStore(userId, date);
        const mergedSnapshot = { ...logIds };
        for (const [slotId, ids] of Object.entries(apiMerged)) {
          if (ids.length > 0) mergedSnapshot[slotId] = ids;
        }
        if (JSON.stringify(mergedSnapshot) !== JSON.stringify(logIds)) {
          writeMealCheckStore(userId, date, store.prepChecked, mergedSnapshot);
        }
      }
      const { grams, entries } = await fetchLoggedDisplayForSlots(date, mealPlan.slots, merged, cache);
      setLoggedGramsBySlot(grams);
      setLoggedDisplayEntries(entries);
      setError(null);
    },
    [userId, date, mealPlan.slots]
  );

  const syncFromLocalStore = useCallback(
    (opts?: { reopenSlotId?: string }) => {
      if (!userId) return;
      const store = readMealCheckStore(userId, date);
      const drafts = readSlotDraftItems(userId, date);
      const gramDrafts = readMealDraftStore(userId, date);

      setPrepChecked(store.prepChecked);
      setSlotDraftItems(drafts);
      setDraftGramsBySlot(gramDrafts);

      const reopenSlotId = opts?.reopenSlotId;
      void (async () => {
        const res = await nutritionService.getMyLogs(date);
        const apiOk = !res.error && Array.isArray(res.data);
        const logs = res.data ?? [];
        let nextLogIds = buildLogIdsBySlotFromApi(logs, mealPlan.slots, store.logIdsBySlot, apiOk);
        if (!Object.values(nextLogIds).some((ids) => ids.length > 0) && logs.length) {
          nextLogIds = inferLogIdsBySlotFromLogs(logs, mealPlan.slots);
        }
        // Merge with current React state — never drop existing slots
        setLogIdsBySlot((prev) => {
          const result: Record<string, string[]> = {};
          for (const [slotId, ids] of Object.entries(prev)) {
            if (ids.length > 0) result[slotId] = ids;
          }
          for (const [slotId, ids] of Object.entries(nextLogIds)) {
            if (ids.length > 0) result[slotId] = ids;
          }
          nextLogIds = result;
          return result;
        });
        if (Object.values(nextLogIds).some((ids) => ids.length > 0)) {
          writeMealCheckStore(userId, date, store.prepChecked, nextLogIds);
        }

        if (reopenSlotId) {
          const slot = mealPlan.slots.find((entry) => entry.id === reopenSlotId);
          if (slot) {
            const logged = (nextLogIds[reopenSlotId]?.length ?? 0) > 0;
            if (logged) {
              await syncLoggedDisplay(nextLogIds);
            } else {
              setEditSession({
                slotId: reopenSlotId,
                entries: buildDraftEntries(slot, gramDrafts[reopenSlotId], drafts[reopenSlotId]),
              });
            }
          }
        } else if (Object.values(nextLogIds).some((ids) => ids.length > 0)) {
          await syncLoggedDisplay(nextLogIds);
        }

        emitWellnessChanged();
      })();
    },
    [userId, date, mealPlan.slots, syncLoggedDisplay]
  );

  useEffect(() => {
    const onMealPlanChanged = () => syncFromLocalStore();
    const onFocus = () => syncFromLocalStore();
    window.addEventListener(MEAL_PLAN_CHANGED, onMealPlanChanged);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener(MEAL_PLAN_CHANGED, onMealPlanChanged);
      window.removeEventListener('focus', onFocus);
    };
  }, [syncFromLocalStore]);


  // Hydrate meal log state when the day changes (not on every parent dashboard refresh).
  useEffect(() => {
    let cancelled = false;
    setEditSession(null);
    setError(null);
    setLoggedGramsBySlot({});
    setLoggedDisplayEntries({});
    setPendingLogSlots(new Set());
    setOptimisticLoggedEntries({});

    const store = readMealCheckStore(userId, date);
    setPrepChecked(store.prepChecked);
    setDraftGramsBySlot(readMealDraftStore(userId, date));
    setSlotDraftItems(readSlotDraftItems(userId, date));
    setLogIdsBySlot(store.logIdsBySlot);

    void (async () => {
      const res = await nutritionService.getMyLogs(date);
      if (cancelled) return;

      const freshStore = readMealCheckStore(userId, date);
      const apiOk = !res.error && Array.isArray(res.data);
      const logs = res.data ?? [];
      let nextLogIds = buildLogIdsBySlotFromApi(logs, mealPlan.slots, freshStore.logIdsBySlot, apiOk);

      if (!Object.values(nextLogIds).some((ids) => ids.length > 0) && logs.length) {
        nextLogIds = inferLogIdsBySlotFromLogs(logs, mealPlan.slots);
      }

      if (cancelled) return;
      // Merge with anything already in React state — preserve slots added optimistically
      setLogIdsBySlot((prev) => {
        const result: Record<string, string[]> = {};
        for (const [slotId, ids] of Object.entries(prev)) {
          if (ids.length > 0) result[slotId] = ids;
        }
        for (const [slotId, ids] of Object.entries(nextLogIds)) {
          if (ids.length > 0) result[slotId] = ids;
        }
        nextLogIds = result;
        return result;
      });
      setPrepChecked(freshStore.prepChecked);
      if (userId && Object.values(nextLogIds).some((ids) => ids.length > 0)) {
        writeMealCheckStore(userId, date, freshStore.prepChecked, nextLogIds);
      }

      const hasLoggedSlots = Object.values(nextLogIds).some((ids) => ids.length > 0);
      if (!hasLoggedSlots) return;

      const cache = readMealLogItemCache(userId, date);
      const { grams, entries } = await fetchLoggedDisplayForSlots(date, mealPlan.slots, nextLogIds, cache);
      if (!cancelled) {
        setLoggedGramsBySlot(grams);
        setLoggedDisplayEntries(entries);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, date, mealSlotIdsKey]);

  const resolveSlotEntries = useCallback(
    (slot: MealSlot): MealEditEntry[] => {
      if (editSession?.slotId === slot.id) return editSession.entries;
      if (pendingLogSlots.has(slot.id) && optimisticLoggedEntries[slot.id]?.length) {
        return optimisticLoggedEntries[slot.id];
      }
      if (isSlotLogged(slot.id) && loggedDisplayEntries[slot.id]?.length) {
        return loggedDisplayEntries[slot.id];
      }
      if (slotDraftItems[slot.id] !== undefined) {
        return buildDraftEntries(slot, undefined, slotDraftItems[slot.id]);
      }
      return slot.items.map((item, index) => ({
        key: `plan-${index}`,
        name: mealItemDisplayName(item.name),
        grams: draftGramsBySlot[slot.id]?.[index] ?? item.grams,
        planItem: item,
        macrosPer100: item.macrosPer100 ?? planItemToPer100(item),
      }));
    },
    [
      editSession,
      pendingLogSlots,
      optimisticLoggedEntries,
      isSlotLogged,
      loggedDisplayEntries,
      slotDraftItems,
      draftGramsBySlot,
    ]
  );

  const liveDietTotals = useMemo(() => {
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    for (const slot of mealPlan.slots) {
      if (!isSlotDone(slot.id)) continue;
      const totals = sumEntryMacros(resolveSlotEntries(slot));
      calories += totals.calories;
      protein += totals.protein;
      carbs += totals.carbs;
      fat += totals.fat;
    }
    return { calories, protein, carbs, fat };
  }, [mealPlan.slots, isSlotDone, resolveSlotEntries]);

  const displayedDiet = useMemo(
    () => ({
      calories: { current: liveDietTotals.calories, target: diet.calories.target },
      protein: { current: liveDietTotals.protein, target: diet.protein.target },
      carbs: { current: liveDietTotals.carbs, target: diet.carbs.target },
      fat: { current: liveDietTotals.fat, target: diet.fat.target },
    }),
    [liveDietTotals, diet]
  );

  useEffect(() => {
    onLiveTotalsChange?.(date === todayKey ? liveDietTotals : null);
    if (!userId || date !== todayKey) return;
    writeLiveDietTotals(userId, date, liveDietTotals);
    emitWellnessChanged();
  }, [userId, date, todayKey, liveDietTotals, onLiveTotalsChange]);

  const toggleMeal = async (slot: NonNullable<Analytics['todayMealPlan']>['slots'][number]) => {
    if (syncing || !canLogDay) return;
    setError(null);
    const logged = isSlotLogged(slot.id) || pendingLogSlots.has(slot.id);
    setSyncing(slot.id);

    if (logged) {
      const logIds = logIdsBySlot[slot.id] ?? [];
      const prevLoggedEntries = loggedDisplayEntries[slot.id];
      const prevPrep = new Set(prepChecked);
      const prevLogs = { ...logIdsBySlot };
      const nextPrep = new Set(prepChecked);
      nextPrep.delete(slot.id);
      const nextLogs = { ...logIdsBySlot };
      delete nextLogs[slot.id];
      setPendingLogSlots((prev) => {
        const next = new Set(prev);
        next.delete(slot.id);
        return next;
      });
      setOptimisticLoggedEntries((prev) => {
        const next = { ...prev };
        delete next[slot.id];
        return next;
      });
      setPrepChecked(nextPrep);
      setLogIdsBySlot(nextLogs);
      setLoggedDisplayEntries((prev) => {
        const next = { ...prev };
        delete next[slot.id];
        return next;
      });
      setLoggedGramsBySlot((prev) => {
        const next = { ...prev };
        delete next[slot.id];
        return next;
      });
      writeMealCheckStore(userId, date, nextPrep, nextLogs);
      emitWellnessChanged();
      setSyncing(null);

      void (async () => {
        try {
          if (logIds.length) await nutritionService.deletePlanMealLogs(logIds);
        } catch (err) {
          setPrepChecked(prevPrep);
          setLogIdsBySlot(prevLogs);
          if (prevLoggedEntries) {
            setLoggedDisplayEntries((prev) => ({ ...prev, [slot.id]: prevLoggedEntries }));
          }
          writeMealCheckStore(userId, date, prevPrep, prevLogs);
          setTransientError(err instanceof Error ? err.message : 'Could not update meal log');
        }
      })();
      return;
    }

    const draftItems = slotDraftItems[slot.id];
    if (draftItems !== undefined && draftItems.length === 0) {
      setSyncing(null);
      setError(t('dashboard.emptyMealCannotLog'));
      return;
    }

    const itemsForLog =
      draftItems !== undefined
        ? draftItems
        : slot.items.map((item, index) =>
            scaleMealItemForLog(item, draftGramsBySlot[slot.id]?.[index] ?? item.grams)
          );
    const optimisticEntries = draftItemsToLoggedEntries(
      itemsForLog.map((_, index) => `pending-${slot.id}-${index}`),
      itemsForLog
    );

    setPendingLogSlots((prev) => new Set([...prev, slot.id]));
    setOptimisticLoggedEntries((prev) => ({ ...prev, [slot.id]: optimisticEntries }));
    emitWellnessChanged();
    setSyncing(null);

    void (async () => {
      try {
        const res = await nutritionService.logPlanMeal({
          date,
          slotId: slot.id,
          items: itemsForLog,
        });
        if (res.error || !res.data) throw new Error(res.error || 'Failed to log meal');

        const nextPrep = new Set(prepChecked);
        nextPrep.delete(slot.id);
        const nextLogs = { ...logIdsBySlot, [slot.id]: res.data.logIds };
        const confirmedEntries = draftItemsToLoggedEntries(res.data.logIds, itemsForLog);

        setPendingLogSlots((prev) => {
          const next = new Set(prev);
          next.delete(slot.id);
          return next;
        });
        setOptimisticLoggedEntries((prev) => {
          const next = { ...prev };
          delete next[slot.id];
          return next;
        });
        setPrepChecked(nextPrep);
        setLogIdsBySlot(nextLogs);
        setLoggedDisplayEntries((prev) => ({ ...prev, [slot.id]: confirmedEntries }));
        setLoggedGramsBySlot((prev) => ({
          ...prev,
          [slot.id]: itemsForLog.map((item) => item.grams),
        }));
        const nextDrafts = { ...draftGramsBySlot };
        delete nextDrafts[slot.id];
        setDraftGramsBySlot(nextDrafts);
        writeMealDraftStore(userId, date, nextDrafts);
        const nextSlotDrafts = { ...slotDraftItems };
        delete nextSlotDrafts[slot.id];
        setSlotDraftItems(nextSlotDrafts);
        writeSlotDraftItems(userId, date, nextSlotDrafts);
        writeMealCheckStore(userId, date, nextPrep, nextLogs);
        writeMealLogItemCache(userId, date, slot.id, itemsForLog);
        void syncLoggedDisplay(nextLogs);
        if (draftItems !== undefined) {
          void adaptationService.reportManualChange('meal_swap', undefined, date).catch(() => null);
        }
        emitWellnessChanged();
      } catch (err) {
        setPendingLogSlots((prev) => {
          const next = new Set(prev);
          next.delete(slot.id);
          return next;
        });
        setOptimisticLoggedEntries((prev) => {
          const next = { ...prev };
          delete next[slot.id];
          return next;
        });
        setTransientError(err instanceof Error ? err.message : 'Could not update meal log');
      }
    })();
    return;
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
    syncFromLocalStore({ reopenSlotId: reopen.slotId });
  }, [date, syncFromLocalStore]);

  const finishSlotEdit = (slot: MealSlot) => {
    if (!canEditDay) return;
    if (!editSession || editSession.slotId !== slot.id) {
      setEditSession(null);
      return;
    }
    setError(null);
    const sessionSnapshot = editSession;
    const wasLogged = isSlotLogged(slot.id) && canLogDay;
    const isEmpty = sessionSnapshot.entries.length === 0;
    const prevLogIds = logIdsBySlot[slot.id] ?? [];

    if (wasLogged) {
      setLoggedDisplayEntries((prev) => ({ ...prev, [slot.id]: sessionSnapshot.entries }));
      setLoggedGramsBySlot((prev) => ({
        ...prev,
        [slot.id]: sessionSnapshot.entries.map((entry) => entry.grams),
      }));
      if (isEmpty) {
        const nextPrep = new Set(prepChecked);
        nextPrep.delete(slot.id);
        const nextLogs = { ...logIdsBySlot };
        delete nextLogs[slot.id];
        setPrepChecked(nextPrep);
        setLogIdsBySlot(nextLogs);
        writeMealCheckStore(userId, date, nextPrep, nextLogs);
      }
    }

    const items = entriesToDraftItems(sessionSnapshot.entries);
    if (wasLogged) {
      const nextSlotDrafts = { ...slotDraftItems };
      delete nextSlotDrafts[slot.id];
      setSlotDraftItems(nextSlotDrafts);
      writeSlotDraftItems(userId, date, nextSlotDrafts);
    } else {
      const nextSlotDrafts = { ...slotDraftItems, [slot.id]: items };
      setSlotDraftItems(nextSlotDrafts);
      writeSlotDraftItems(userId, date, nextSlotDrafts);
    }
    const nextGramDrafts = { ...draftGramsBySlot };
    delete nextGramDrafts[slot.id];
    setDraftGramsBySlot(nextGramDrafts);
    writeMealDraftStore(userId, date, nextGramDrafts);
    setEditSession(null);
    emitMealPlanChanged();
    emitWellnessChanged();

    void (async () => {
      try {
        if (wasLogged) {
          for (const entry of sessionSnapshot.entries) {
            if (!entry.logId) continue;
            const res = await nutritionService.updateLog(entry.logId, entry.grams);
            if (res.error) throw new Error(res.error);
          }
          if (isEmpty && prevLogIds.length) {
            await nutritionService.deletePlanMealLogs(prevLogIds);
          }
        }
      } catch (err) {
        setTransientError(err instanceof Error ? err.message : t('dashboard.editMealSaveFailed'));
      }
    })();
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

  const removeEditEntry = (slot: MealSlot, key: string) => {
    if (!canEditDay) return;
    if (!editSession || editSession.slotId !== slot.id) return;
    const entry = editSession.entries.find((item) => item.key === key);
    if (!entry) return;
    setError(null);
    const nextEntries = editSession.entries.filter((item) => item.key !== key);
    const prevSession = editSession;
    const prevLogs = { ...logIdsBySlot };
    const prevPrep = new Set(prepChecked);

    if (entry.logId && canLogDay) {
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
    }

    setEditSession({ slotId: slot.id, entries: nextEntries });
    if (nextEntries.length === 0) {
      const nextSlotDrafts = { ...slotDraftItems, [slot.id]: [] };
      setSlotDraftItems(nextSlotDrafts);
      writeSlotDraftItems(userId, date, nextSlotDrafts);
    }
    emitMealPlanChanged();
    emitWellnessChanged();

    if (!entry.logId || !canLogDay) return;

    void (async () => {
      try {
        const res = await nutritionService.deleteLog(entry.logId!);
        if (res.error) throw new Error(res.error);
      } catch (err) {
        setEditSession(prevSession);
        setLogIdsBySlot(prevLogs);
        setPrepChecked(prevPrep);
        writeMealCheckStore(userId, date, prevPrep, prevLogs);
        setLoggedDisplayEntries((prev) => ({ ...prev, [slot.id]: prevSession.entries }));
        setTransientError(err instanceof Error ? err.message : t('dashboard.editMealSaveFailed'));
      }
    })();
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

  const getDisplayEntries = (slot: MealSlot): MealEditEntry[] => resolveSlotEntries(slot);

  const getSlotLiveEntries = (slot: MealSlot): MealEditEntry[] => resolveSlotEntries(slot);

  const planLiveCalories = useMemo(
    () =>
      mealPlan.slots.reduce((sum, slot) => {
        if (!isSlotDone(slot.id)) return sum;
        return sum + sumEntryMacros(resolveSlotEntries(slot)).calories;
      }, 0),
    [mealPlan.slots, isSlotDone, resolveSlotEntries]
  );

  const doneCount = mealPlan.slots.filter((slot) => isSlotDone(slot.id)).length;

  const commitEntryGrams = (slot: MealSlot, entry: MealEditEntry, itemIndex: number, grams: number) => {
    if (!canEditDay) return;
    if (grams < 5 || grams > 5000) {
      setError(t('dashboard.editMealInvalidGrams'));
      return;
    }
    setError(null);
    const prevLogged = loggedDisplayEntries[slot.id];
    const prevDraftItems = slotDraftItems[slot.id];
    const prevGramDrafts = draftGramsBySlot[slot.id];

    if (editSession?.slotId === slot.id) {
      setEditSession({
        ...editSession,
        entries: editSession.entries.map((row) => (row.key === entry.key ? { ...row, grams } : row)),
      });
    }

    if (entry.logId && canLogDay) {
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
    emitMealPlanChanged();
    emitWellnessChanged();

    if (!entry.logId || !canLogDay) return;

    void (async () => {
      try {
        const res = await nutritionService.updateLog(entry.logId!, grams);
        if (res.error) throw new Error(res.error);
      } catch (err) {
        if (prevLogged) setLoggedDisplayEntries((prev) => ({ ...prev, [slot.id]: prevLogged }));
        if (prevDraftItems) {
          const nextSlotDrafts = { ...slotDraftItems, [slot.id]: prevDraftItems };
          setSlotDraftItems(nextSlotDrafts);
          writeSlotDraftItems(userId, date, nextSlotDrafts);
        }
        if (prevGramDrafts) {
          const nextDrafts = { ...draftGramsBySlot, [slot.id]: prevGramDrafts };
          setDraftGramsBySlot(nextDrafts);
          writeMealDraftStore(userId, date, nextDrafts);
        }
        setTransientError(err instanceof Error ? err.message : t('dashboard.editMealSaveFailed'));
      }
    })();
  };

  const openMealDetails = async (entry: MealEditEntry) => {
    setMealDetailsPendingError(null);
    setMealDetailsPendingTitle(entry.name);

    let resolved = entry;
    let row = mealEntryToNutritionRow(resolved);

    if (!row) {
      setMealDetailsPending(true);
      setMealDetailsRow(null);

      let foodItemId = resolved.foodItemId;
      if (entry.logId) {
        const logRes = await nutritionService.getFoodLog(entry.logId);
        if (logRes.data) {
          resolved = mealEntryFromFoodLog(logRes.data, entry.name);
          foodItemId = resolved.foodItemId ?? foodItemId;
          row = mealEntryToNutritionRow(resolved);
        }
      }

      if (!row && foodItemId) {
        const foodRes = await nutritionService.getFoodItem(foodItemId);
        if (foodRes.data) {
          resolved = {
            ...resolved,
            foodItemId,
            foodItem: foodRes.data,
            name: foodRes.data.displayName || foodRes.data.name || resolved.name,
            macrosPer100: foodItemToMacrosPer100(foodRes.data),
            webtebId:
              foodRes.data.webtebId != null && Number(foodRes.data.webtebId) > 0
                ? Number(foodRes.data.webtebId)
                : undefined,
          };
          row = mealEntryToNutritionRow(resolved);
        }
      }

      if (!row && foodItemId && !resolved.foodItem?.userId) {
        const link = await nutritionService.resolveFoodItemWebteb(foodItemId);
        if (link.error) {
          setMealDetailsPending(false);
          setMealDetailsPendingError(link.error);
          return;
        }
        if (link.data?.webtebId) {
          resolved = {
            ...resolved,
            foodItemId,
            webtebId: link.data.webtebId,
            name: link.data.displayName || resolved.name,
            macrosPer100: {
              calories: link.data.calories,
              protein: link.data.protein,
              carbs: link.data.carbs,
              fat: link.data.fat,
            },
          };
          row = mealEntryToNutritionRow(resolved);
          if (resolved.logId) {
            setLoggedDisplayEntries((prev) => {
              const next = { ...prev };
              for (const slotId of Object.keys(next)) {
                next[slotId] = (next[slotId] ?? []).map((item) =>
                  item.logId === resolved.logId
                    ? {
                        ...item,
                        webtebId: resolved.webtebId,
                        name: resolved.name,
                        macrosPer100: resolved.macrosPer100,
                        foodItemId,
                      }
                    : item
                );
              }
              return next;
            });
          }
        }
      }

      setMealDetailsPending(false);
    }

    if (!row) {
      setMealDetailsPendingError(t('nutrition.errorFoodNotFound'));
      return;
    }

    const webtebId = row.fdcPreview?.webtebId;
    if (webtebId) nutritionService.prefetchFoodDetails(Number(webtebId));
    setMealDetailsRow(row);
  };

  const closeMealDetails = () => {
    setMealDetailsRow(null);
    setMealDetailsPending(false);
    setMealDetailsPendingError(null);
    setMealDetailsPendingTitle('');
  };

  const handlePickMealSlot = (slotId: string) => {
    const slot = mealPlan.slots.find((entry) => entry.id === slotId);
    if (!slot) return;
    setSlotPickerOpen(false);
    if (slotPickerMode === 'capture') {
      setPendingCaptureSlot(slot);
      setCaptureMethodOpen(true);
    } else {
      openNutritionForMeal(slot);
    }
    setSlotPickerMode(null);
  };

  const handleBarcodeApplied = (result?: MealCaptureApplyResult) => {
    if (!barcodeTarget || !userId) return;
    if (result?.logIds?.length && result.planItems.length) {
      const entries = draftItemsToLoggedEntries(result.logIds, result.planItems);
      setLoggedDisplayEntries((prev) => {
        const existing = (prev[barcodeTarget.id] ?? []).filter(
          (entry) => entry.name !== 'Food' || (entry.macrosPer100?.calories ?? 0) > 0
        );
        return { ...prev, [barcodeTarget.id]: [...existing, ...entries] };
      });
      setLogIdsBySlot((prev) => ({
        ...prev,
        [barcodeTarget.id]: [...(prev[barcodeTarget.id] ?? []), ...result.logIds!],
      }));
    }
    syncFromLocalStore({ reopenSlotId: barcodeTarget.id });
    setBarcodeTarget(null);
  };

  const handleCaptureApplied = (result?: MealCaptureApplyResult) => {
    if (!captureTarget || !userId) return;
    if (result?.logIds?.length && result.planItems.length) {
      const entries = draftItemsToLoggedEntries(result.logIds, result.planItems);
      setLoggedDisplayEntries((prev) => {
        const existing = (prev[captureTarget.id] ?? []).filter(
          (entry) => entry.name !== 'Food' || (entry.macrosPer100?.calories ?? 0) > 0
        );
        return { ...prev, [captureTarget.id]: [...existing, ...entries] };
      });
      setLogIdsBySlot((prev) => ({
        ...prev,
        [captureTarget.id]: [...(prev[captureTarget.id] ?? []), ...result.logIds!],
      }));
    }
    syncFromLocalStore({ reopenSlotId: captureTarget.id });
    setCaptureTarget(null);
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
          {          highlightDietNumbers(
            t('dashboard.dietMacroSummary', {
              calories: String(Math.round(displayedDiet.calories.current)),
              calTarget: String(displayedDiet.calories.target),
              protein: String(Math.round(displayedDiet.protein.current)),
              proTarget: String(displayedDiet.protein.target),
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
            target: String(displayedDiet.calories.target),
          })}`
        )}
      </p>

      {error ? <p className="text-xs font-medium text-error-500">{error}</p> : null}

      <ul className="space-y-2.5">
        {mealPlan.slots.map((slot) => {
          const isDone = isSlotDone(slot.id);
          const isSyncing = syncing === slot.id;
          const isEditing = editSession?.slotId === slot.id;
          const displayEntries = getDisplayEntries(slot);
          const liveEntries = getSlotLiveEntries(slot);
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
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150',
                    isDone
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-gray-300 bg-white hover:border-brand-500/50 dark:border-gray-600 dark:bg-gray-900',
                    (syncing && !isSyncing) || !canLogDay ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
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
                            onClick={() => void openMealDetails(entry)}
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

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!canEditDay}
          onClick={() => {
            setSlotPickerMode('log');
            setSlotPickerOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-500/35 bg-brand-500/5 py-2.5 text-xs font-semibold text-brand-600 hover:bg-brand-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-400"
        >
          <span className="material-symbols-outlined text-base">restaurant</span>
          {t('dashboard.logMeal')}
        </button>
        <button
          type="button"
          disabled={!canEditDay}
          onClick={() => {
            setSlotPickerMode('capture');
            setSlotPickerOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-violet-500/35 bg-violet-500/5 py-2.5 text-xs font-semibold text-violet-600 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-violet-400"
        >
          <span className="material-symbols-outlined text-base">photo_camera</span>
          {t('dashboard.captureMeal')}
        </button>
      </div>

      <MealSlotPickerModal
        open={slotPickerOpen}
        slots={mealPlan.slots.map((slot) => ({
          id: slot.id,
          label: slot.label,
          kind: slot.kind,
        }))}
        onSelect={(slot) => handlePickMealSlot(slot.id)}
        onClose={() => {
          setSlotPickerOpen(false);
          setSlotPickerMode(null);
        }}
      />

      <MealAddMethodModal
        open={captureMethodOpen && Boolean(pendingCaptureSlot)}
        slotLabel={pendingCaptureSlot?.label ?? ''}
        onClose={() => {
          setCaptureMethodOpen(false);
          setPendingCaptureSlot(null);
        }}
        onPhoto={() => {
          if (!pendingCaptureSlot) return;
          setCaptureTarget(pendingCaptureSlot);
          setPendingCaptureSlot(null);
          setCaptureMethodOpen(false);
        }}
        onBarcode={() => {
          if (!pendingCaptureSlot) return;
          setBarcodeTarget(pendingCaptureSlot);
          setPendingCaptureSlot(null);
          setCaptureMethodOpen(false);
        }}
      />

      {captureTarget && userId ? (
        <CaptureMealModal
          open={Boolean(captureTarget)}
          slotId={captureTarget.id}
          slotLabel={captureTarget.label}
          date={date}
          userId={userId}
          isLogged={isSlotLogged(captureTarget.id)}
          existingDraftItems={
            !isSlotLogged(captureTarget.id)
              ? editSession?.slotId === captureTarget.id
                ? entriesToDraftItems(editSession.entries)
                : slotDraftItems[captureTarget.id]
              : undefined
          }
          onClose={() => setCaptureTarget(null)}
          onApplied={handleCaptureApplied}
        />
      ) : null}

      {barcodeTarget && userId ? (
        <BarcodeScanModal
          open={Boolean(barcodeTarget)}
          slotId={barcodeTarget.id}
          slotLabel={barcodeTarget.label}
          date={date}
          userId={userId}
          isLogged={isSlotLogged(barcodeTarget.id)}
          existingDraftItems={
            !isSlotLogged(barcodeTarget.id)
              ? editSession?.slotId === barcodeTarget.id
                ? entriesToDraftItems(editSession.entries)
                : slotDraftItems[barcodeTarget.id]
              : undefined
          }
          onClose={() => setBarcodeTarget(null)}
          onApplied={handleBarcodeApplied}
          onSwitchToPhoto={() => {
            setCaptureTarget(barcodeTarget);
            setBarcodeTarget(null);
          }}
        />
      ) : null}

      <NutritionDetailsModal
        row={mealDetailsRow}
        pending={mealDetailsPending}
        pendingTitle={mealDetailsPendingTitle}
        pendingError={mealDetailsPendingError}
        onClose={closeMealDetails}
      />
    </div>
  );
}

function DietCommerceRecommendations({ enabled }: { enabled: boolean }) {
  const { bundle, loading } = useCommerceRecommendations(enabled);
  const { dietProducts, loading: dietLoading } = useDietPlanCommerce(enabled);
  return (
    <>
      <ReorderBanner className="mt-4" />
      <CommerceRecommendationCard bundle={bundle} loading={loading} source="dashboard_diet" />
      <DietPlanCommerceCard dietProducts={dietProducts} loading={dietLoading} />
    </>
  );
}

function WorkoutDietPlansCard({
  data,
  analytics,
  personalization,
  userId,
  signedUpDateKey,
  onRefresh,
  onLiveTotalsChange,
}: {
  data: AthleteHomeDashboard;
  analytics: Analytics;
  personalization: AthletePersonalization;
  userId?: string;
  signedUpDateKey?: string | null;
  onRefresh?: () => Promise<void>;
  onLiveTotalsChange?: (totals: { calories: number; protein: number; carbs: number; fat: number } | null) => void;
}) {
  const { t, language } = useI18n();
  const onboardingData = useAuthStore((s) => s.user?.profile?.onboardingData) as
    | Record<string, unknown>
    | undefined;
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<'workout' | 'diet'>(() =>
    searchParams.get('tab') === 'diet' ? 'diet' : 'workout',
  );
  const [planActionLoading, setPlanActionLoading] = useState(false);
  const workoutSectionRef = useRef<HTMLDivElement>(null);
  const apiTodayKey = data.today.date;
  const todayKey = useCalendarTodayKey(apiTodayKey);
  const [selectedDate, setSelectedDate] = useState(() => {
    const effectiveToday = getClientTodayKey();
    const persisted = readPersistedSelectedDate(effectiveToday);
    return normalizePlanSelectedDate(effectiveToday, persisted, 0).selectedDate;
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const prevTodayKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const todayChanged =
      prevTodayKeyRef.current !== null && prevTodayKeyRef.current !== todayKey;
    prevTodayKeyRef.current = todayKey;

    if (todayChanged) setWeekOffset(0);

    setSelectedDate((prev) => {
      if (prev > todayKey) {
        persistSelectedDate(todayKey);
        return todayKey;
      }
      if (!todayChanged) return prev;
      const currentWeekDates = new Set(buildRollingWeekDays(todayKey, 0).map((d) => d.date));
      const shouldMoveToToday = prev < todayKey || !currentWeekDates.has(prev);
      if (shouldMoveToToday && !isBeforeSignupDate(todayKey, signedUpDateKey)) {
        persistSelectedDate(todayKey);
        return todayKey;
      }
      return prev;
    });
  }, [todayKey, signedUpDateKey]);

  const maxFutureWeeks = useMemo(
    () => maxFutureWeekOffset(todayKey, analytics.coachPlan),
    [todayKey, analytics.coachPlan]
  );

  useEffect(() => {
    if (weekOffset > maxFutureWeeks) setWeekOffset(maxFutureWeeks);
  }, [weekOffset, maxFutureWeeks]);

  const workoutsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of data.weekly) map.set(d.date, d.workouts);
    for (const h of data.heatmap ?? []) map.set(h.date, h.workouts);
    return map;
  }, [data.weekly, data.heatmap]);

  const splitLabel = personalization.preferredSplit
    ? localizeOnboardingDisplayValue('preferredSplit', personalization.preferredSplit, language)
    : null;

  const coachWeekSchedule = useMemo(() => {
    const cp = analytics.coachPlan;
    if (!cp?.hasPlan || !cp.weeks?.length) return null;
    const entry = cp.weeks.find((w) => w.weekIndex === weekOffset) ?? cp.weeks[0];
    return entry?.weeklySchedule ?? null;
  }, [analytics.coachPlan, weekOffset]);

  const visibleWeekPlan = useMemo(
    () =>
      buildVisibleWeekPlan({
        todayKey,
        weekOffset,
        trainingDaysPerWeek: personalization.trainingDaysPerWeek,
        splitLabel,
        workoutsByDate,
        coachWeekSchedule,
      }),
    [
      todayKey,
      weekOffset,
      personalization.trainingDaysPerWeek,
      splitLabel,
      workoutsByDate,
      coachWeekSchedule,
    ]
  );

  const weekRangeLabel = useMemo(() => {
    const days = buildRollingWeekDays(todayKey, weekOffset);
    return formatWeekRangeLabel(days[0].date, days[days.length - 1].date, language);
  }, [todayKey, weekOffset, language]);

  const isViewingToday = selectedDate === todayKey;
  const dayWorkoutResolved = useMemo(
    () => resolveDayWorkoutView(data, selectedDate, isViewingToday),
    [data, selectedDate, isViewingToday]
  );
  const workoutPlan = dayWorkoutResolved.workoutPlan;

  const weekPlan = useMemo(
    () => mergePostgresIntoWeekStrip(visibleWeekPlan, data, todayKey, weekOffset),
    [visibleWeekPlan, data, todayKey, weekOffset]
  );

  const selectedDay = weekPlan.find((d) => d.date === selectedDate) ?? weekPlan.find((d) => d.status === 'today');
  // Week strip is the source of truth for training vs rest when browsing days.
  const isRestDay =
    selectedDay != null
      ? selectedDay.status === 'rest' || selectedDay.isTrainingDay === false
      : dayWorkoutResolved.isRestToday;

  const exercises = useMemo(() => {
    if (isRestDay) return [];
    if (dayWorkoutResolved.exercises.length > 0) return dayWorkoutResolved.exercises;
    if (hasPostgresTodayPlan(data)) return [];
    return [];
  }, [isRestDay, dayWorkoutResolved.exercises, data]);

  const isRestToday = dayWorkoutResolved.isRestToday;
  const diet = useMemo(
    () => resolveDayDietView(data, selectedDate, isViewingToday),
    [data, selectedDate, isViewingToday]
  );
  const mealPlan = useMemo(
    () =>
      buildMealPlanForSelectedDay(data, selectedDate, isViewingToday, analytics.todayMealPlan) ??
      analytics.todayMealPlan,
    [data, selectedDate, isViewingToday, analytics.todayMealPlan]
  );

  const hasOfficialPlan = hasPostgresTodayPlan(data);
  const planInsight = hasOfficialPlan
    ? resolveTodayPlanInsight(data, language, isViewingToday)
    : null;
  const officialPlanBadge = hasOfficialPlan
    ? planSourceBadgeKey(data.todayWorkout?.planSource ?? data.todayDiet?.planSource ?? 'ai')
    : null;

  const weekPlanDatesKey = useMemo(() => weekPlan.map((d) => d.date).join(','), [weekPlan]);

  useEffect(() => {
    const dates = weekPlanDatesKey ? weekPlanDatesKey.split(',') : [];
    setSelectedDate((prev) => {
      if (dates.includes(prev)) return prev;
      const fallback =
        (dates.includes(todayKey) ? todayKey : null) ??
        dates.find((d) => !isBeforeSignupDate(d, signedUpDateKey)) ??
        dates[0] ??
        todayKey;
      if (fallback !== prev) persistSelectedDate(fallback);
      return fallback;
    });
  }, [weekPlanDatesKey, todayKey, signedUpDateKey]);

  useEffect(() => {
    if (!signedUpDateKey) return;
    if (isBeforeSignupDate(selectedDate, signedUpDateKey)) {
      setSelectedDate(signedUpDateKey);
      persistSelectedDate(signedUpDateKey);
    }
    const minOffset = minPastWeekOffset(todayKey, signedUpDateKey);
    if (weekOffset < minOffset) setWeekOffset(minOffset);
  }, [signedUpDateKey, selectedDate, todayKey, weekOffset]);

  const selectedDayLabel = selectedDay
    ? formatWeekdayLabel(selectedDay.day, language, t, false)
    : undefined;
  const todayStripDay = weekPlan.find((d) => d.date === todayKey);
  const todayDayLabel = todayStripDay
    ? formatWeekdayLabel(todayStripDay.day, language, t, false)
    : todayLabelInRollingWeek(todayKey, language, t);

  const selectDate = (nextDate: string) => {
    if (isBeforeSignupDate(nextDate, signedUpDateKey)) return;
    setSelectedDate(nextDate);
    persistSelectedDate(nextDate);
  };

  useEffect(() => {
    if (searchParams.get('tab') !== 'workout') return;
    setTab('workout');
    setWeekOffset(0);
    if (!isBeforeSignupDate(todayKey, signedUpDateKey)) {
      selectDate(todayKey);
    }
    const scrollTimer = window.setTimeout(() => {
      workoutSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('tab');
    setSearchParams(nextParams, { replace: true });
    return () => window.clearTimeout(scrollTimer);
  }, [searchParams, setSearchParams, todayKey, signedUpDateKey]);

  const isFutureDay = isFuturePlanDate(selectedDate, todayKey);
  const canLogSelectedDay = canLogPlanDate(selectedDate, todayKey);
  const minWeekOffset = signedUpDateKey ? minPastWeekOffset(todayKey, signedUpDateKey) : null;
  const canGoPrevWeek = minWeekOffset == null || weekOffset > minWeekOffset;
  const canGoNextWeek = weekOffset < maxFutureWeeks;

  const planDayStatusLabel = useMemo(() => {
    if (isRestDay) return t('dashboard.planDayStatusRest');
    if (selectedDay?.status === 'done') return t('dashboard.planDayStatusCompleted');
    if (isFutureDay) return t('dashboard.planDayStatusPreview');
    if (isViewingToday) return t('dashboard.planDayStatusToday');
    if (!canLogSelectedDay) return t('dashboard.planDayStatusViewOnly');
    return t('dashboard.planDayStatusTraining');
  }, [isRestDay, selectedDay?.status, isFutureDay, isViewingToday, canLogSelectedDay, t]);

  const planDaySubtitle = useMemo(() => {
    if (isRestDay) {
      return selectedDayLabel
        ? t('dashboard.workoutRestDayDetail', { day: selectedDayLabel })
        : t('dashboard.workoutRestDayGeneric');
    }
    if (isFutureDay) return t('dashboard.futureDayEditNoCheck');
    if (!canLogSelectedDay && selectedDate < todayKey) return t('dashboard.planViewOnlyHint');
    if (selectedDay?.splitLabel) return selectedDay.splitLabel;
    if (isViewingToday) return t('dashboard.planEditableHint');
    if (selectedDate > todayKey && selectedDayLabel) {
      return t('dashboard.workoutViewingUpcoming', { day: selectedDayLabel });
    }
    if (selectedDayLabel) return t('dashboard.workoutViewingPast', { day: selectedDayLabel });
    return t('dashboard.planEditableHint');
  }, [
    isRestDay,
    isFutureDay,
    canLogSelectedDay,
    selectedDate,
    todayKey,
    selectedDay?.splitLabel,
    selectedDayLabel,
    isViewingToday,
    t,
  ]);

  const selectedDayDateLabel = selectedDate
    ? new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString(localeTag(language), {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const planDayStatusIcon = isRestDay
    ? 'spa'
    : selectedDay?.status === 'done'
      ? 'check_circle'
      : isFutureDay
        ? 'event_upcoming'
        : 'fitness_center';

  const pickDateInWeek = (days: Array<{ date: string }>) => {
    const matched = sameWeekdayInWeek(selectedDate, days);
    if (matched && !isBeforeSignupDate(matched, signedUpDateKey)) return matched;
    const todayInWeek = days.find((d) => d.date === todayKey && !isBeforeSignupDate(d.date, signedUpDateKey))?.date;
    if (todayInWeek) return todayInWeek;
    return days.find((d) => !isBeforeSignupDate(d.date, signedUpDateKey))?.date ?? selectedDate;
  };

  const shiftWeek = (delta: number) => {
    setWeekOffset((prev) => {
      if (!canShiftWeekOffset(prev, delta, todayKey, signedUpDateKey, analytics.coachPlan)) return prev;
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

  const handleSkipDay = async () => {
    if (planActionLoading || !isViewingToday) return;
    setPlanActionLoading(true);
    try {
      const res = await plansService.patchDay({ status: 'skipped' });
      if (!res.error) await onRefresh?.();
    } finally {
      setPlanActionLoading(false);
    }
  };

  const handleLifeMode = async (
    lifeMode: 'normal' | 'travel' | 'sick' | 'fasting' | 'injury_flare',
  ) => {
    if (planActionLoading || !isViewingToday) return;
    setPlanActionLoading(true);
    try {
      const res = await plansService.patchDay({ lifeMode });
      if (!res.error) await onRefresh?.();
    } finally {
      setPlanActionLoading(false);
    }
  };

  const currentLifeMode = data.todayPlan?.lifeMode ?? 'normal';

  if (!hasOfficialPlan) {
    const generating = isActivePlanGenerationRequest(onboardingData?.planGenerationRequestedAt);
    if (generating) {
      return (
        <PlanGenerationLiveView
          personalization={personalization}
          calorieTarget={data.targets.calorieTarget}
          proteinTarget={data.targets.proteinTarget}
          planGenerationRequestedAt={
            typeof onboardingData?.planGenerationRequestedAt === 'string'
              ? onboardingData.planGenerationRequestedAt
              : null
          }
          onRefresh={onRefresh}
        />
      );
    }
    return (
      <div className={cn(CARD, 'flex min-h-[220px] flex-col items-center justify-center p-8 text-center')}>
        <span className="material-symbols-outlined mb-3 text-4xl text-brand-500/70">assignment</span>
        <h3 className="text-lg font-bold text-gray-800 dark:text-white/90">
          {t('dashboard.plansEmptyTitle')}
        </h3>
        <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
          {t('dashboard.plansEmptyHint')}
        </p>
        <Link
          to="/profile"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          <span className="material-symbols-outlined text-lg">person</span>
          {t('dashboard.plansEmptyAction')}
        </Link>
      </div>
    );
  }

  return (
    <div className={cn(CARD, 'flex min-h-[220px] flex-col p-5 sm:p-6 md:p-7')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 sm:text-xl">
          {t('dashboard.workoutDietPlans')}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {hasOfficialPlan ? (
            <>
              <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                {t('dashboard.planStoragePostgres')}
              </span>
              <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                {t(officialPlanBadge === 'dashboard.planBadgeManual' ? 'dashboard.planBadgeManual' : 'dashboard.planBadgeAi')}
              </span>
            </>
          ) : analytics.coachPlan?.hasPlan ? (
            <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              {analytics.coachPlan.source === 'ai'
                ? t('dashboard.planBadgeAi')
                : analytics.coachPlan.source === 'manual'
                  ? t('dashboard.planBadgeManual')
                  : t('dashboard.planBadgeCoach')}
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
        {t('dashboard.planEditableHint')}
        {hasOfficialPlan ? (
          <span className="mt-1 block text-[10px] text-gray-400 dark:text-gray-500">
            {t('dashboard.planWeekBrowseHint')}
          </span>
        ) : null}
      </p>
      <div className="mt-2 min-h-0 space-y-2">
        {planInsight ? (
          <p className="rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
            {planInsight}
          </p>
        ) : null}
        {!isViewingToday && hasOfficialPlan && tab === 'diet' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <p className="text-xs text-amber-900 dark:text-amber-100">
              {isFutureDay
                ? t('dashboard.futureDayNotRecorded')
                : t('dashboard.planViewOtherDayHint', { day: todayDayLabel })}
            </p>
            <button
              type="button"
              onClick={() => selectDate(todayKey)}
              className="shrink-0 rounded-md bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-600"
            >
              {t('dashboard.goToTodayPlan')}
            </button>
          </div>
        ) : null}
        {isViewingToday && hasOfficialPlan ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSkipDay()}
              disabled={planActionLoading}
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-200"
            >
              {t('dashboard.skipDay')}
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('dashboard.lifeMode')}:
            </span>
            {(
              [
                ['normal', 'dashboard.lifeModeNormal'],
                ['travel', 'dashboard.lifeModeTravel'],
                ['sick', 'dashboard.lifeModeSick'],
                ['fasting', 'dashboard.lifeModeFasting'],
                ['injury_flare', 'dashboard.lifeModeInjury'],
              ] as const
            ).map(([mode, labelKey]) => (
              <button
                key={mode}
                type="button"
                onClick={() => void handleLifeMode(mode)}
                disabled={planActionLoading}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50',
                  currentLifeMode === mode
                    ? 'bg-brand-500 text-white'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800/80',
                )}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

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
                  <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 16 }}>
                    spa
                  </span>
                ) : (
                  <span
                    className={cn(
                      'material-symbols-outlined',
                      isToday ? 'text-brand-500' : 'text-gray-400 dark:text-gray-500'
                    )}
                    style={{ fontSize: 16 }}
                  >
                    fitness_center
                  </span>
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

      {tab === 'workout' && selectedDay ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50/90 to-white px-3 py-3 dark:border-gray-700 dark:from-white/[0.04] dark:to-white/[0.02] sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl',
                isRestDay
                  ? 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'
                  : isFutureDay
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : selectedDay.status === 'done'
                      ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400'
                      : 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
              )}
            >
              <span className="material-symbols-outlined text-xl">{planDayStatusIcon}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {selectedDayDateLabel}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                {planDaySubtitle}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                isRestDay
                  ? 'bg-gray-200/80 text-gray-600 dark:bg-white/10 dark:text-gray-300'
                  : isFutureDay
                    ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                    : selectedDay.status === 'done'
                      ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300'
                      : 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
              )}
            >
              {planDayStatusLabel}
            </span>
            {!isViewingToday ? (
              <button
                type="button"
                onClick={() => selectDate(todayKey)}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:border-brand-500/40 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:text-brand-400"
              >
                {t('dashboard.goToTodayPlan')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'workout' ? (
        <div ref={workoutSectionRef} id="today-workout" className="scroll-mt-4">
          <WorkoutExerciseChecklist
            key={selectedDate}
            workoutPlan={workoutPlan}
            plannedExercises={exercises}
            date={selectedDate}
            todayKey={todayKey}
            dayLabel={selectedDayLabel}
            isRestDay={isRestDay}
            userId={userId}
            onRefresh={onRefresh}
          />
        </div>
      ) : null}
      {mealPlan ? (
        <div className={tab === 'diet' ? undefined : 'hidden'} aria-hidden={tab !== 'diet'}>
          <DietMealChecklist
            key={selectedDate}
            mealPlan={mealPlan}
            diet={diet}
            date={selectedDate}
            todayKey={todayKey}
            dayLabel={selectedDayLabel}
            userId={userId}
            onRefresh={onRefresh}
            onLiveTotalsChange={onLiveTotalsChange}
          />
        </div>
      ) : tab === 'diet' ? (
        <div className="mt-3 rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t('dashboard.logMealMacros')}
        </div>
      ) : null}

      {tab === 'diet' && hasOfficialWeekPlan(data) ? (
        <DietCommerceRecommendations enabled={tab === 'diet'} />
      ) : null}
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
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const location = useLocation();
  const isPlansSection = location.pathname === '/dashboard/plans';
  const [data, setData] = useState<AthleteHomeDashboard | null>(
    () => dashboardService.peekAthleteHome()?.data ?? null
  );
  const { t, language } = useI18n();
  const [loading, setLoading] = useState(() => !dashboardService.peekAthleteHome()?.data);
  const [slowLoad, setSlowLoad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weeklyReviewOpen, setWeeklyReviewOpen] = useState(false);
  const [kpiLiveTotals, setKpiLiveTotals] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);
  const wellnessRevision = useWellnessRevision();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('weeklyReview') === '1') setWeeklyReviewOpen(true);
  }, []);

  const load = useCallback(async (silent = false, force = false) => {
    const hasCached = Boolean(dashboardService.peekAthleteHome()?.data);
    if (!silent && !hasCached) setLoading(true);
    setSlowLoad(false);
    const slowTimer =
      !silent && !hasCached
        ? window.setTimeout(() => setSlowLoad(true), 5000)
        : null;
    try {
      const res = await dashboardService.athleteHome({ force });
      if (res.error) {
        if (!silent && !hasCached) setError(res.error);
      } else {
        setError(null);
        setData(res.data ?? null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard';
      if (!silent && !hasCached) {
        setError(msg);
        setData(null);
      }
    } finally {
      if (slowTimer) window.clearTimeout(slowTimer);
      setSlowLoad(false);
      if (!silent && !hasCached) setLoading(false);
    }
  }, []);

  const loadSilent = useCallback((force = false) => load(true, force), [load]);

  useEffect(() => {
    nutritionService.prefetchPersonalLibrary();
    const cached = dashboardService.peekAthleteHome()?.data;
    void load(Boolean(cached));
  }, [load, language]);

  useEffect(() => {
    if (!error || data || !isTransientApiError(error)) return undefined;
    const timer = window.setInterval(() => {
      void load(true, true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [error, data, load]);

  useDashboardRefreshListener(() => {
    void load(true);
  });

  /** Poll while onboarding is complete but Claude plan is still persisting (C4 background). */
  useEffect(() => {
    if (!data) return undefined;
    const od = authUser?.profile?.onboardingData as Record<string, unknown> | undefined;
    if (!isOfficialOnboardingComplete(od)) return undefined;
    const hasPlan = Boolean(data.officialWeekPlan?.workout?.days?.length || hasPostgresTodayPlan(data));
    if (hasPlan) return undefined;
    const timer = window.setInterval(() => {
      void load(true);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [data, authUser?.profile?.onboardingData, load]);

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

  const weeklyReview = data?.weeklyAdaptation;
  const onboardingData = authUser?.profile?.onboardingData as Record<string, unknown> | undefined;
  const planGenerationActive = isActivePlanGenerationRequest(onboardingData?.planGenerationRequestedAt);
  const planPending =
    planGenerationActive &&
    Boolean(data) &&
    !data.officialWeekPlan?.workout?.days?.length &&
    !hasPostgresTodayPlan(data);
  const reviewDue = Boolean(weeklyReview?.due || weeklyReview?.macroPendingConfirm);

  useEffect(() => {
    const at = onboardingData?.planGenerationRequestedAt;
    if (at && !isActivePlanGenerationRequest(at)) {
      void clearPlanGenerationRequested(onboardingData).then(() => refreshUser());
      usePlanGenerationSessionStore.getState().reset();
    }
  }, [onboardingData, refreshUser]);

  useEffect(() => {
    const store = usePageChromeStore.getState();
    if (data && reviewDue && !planPending) {
      store.setAlert({
        tone: 'warning',
        title: language === 'ar' ? 'مراجعة أسبوعية مطلوبة' : 'Weekly review required',
        subtitle:
          language === 'ar'
            ? 'أدخل الوزن والجاهزية وتقييم الخطة — الذكاء الاصطناعي يقرر أسبوعك القادم (إبقاء / تعديل / خطة جديدة).'
            : 'Add weight, readiness, and plan feedback — AI decides next week (keep / tweak / new plan).',
        detail: weeklyReview?.missing?.length
          ? `${language === 'ar' ? 'ناقص: ' : 'Missing: '}${weeklyReview.missing.join(', ')}`
          : undefined,
        actionLabel: language === 'ar' ? 'ابدأ المراجعة' : 'Start review',
        onAction: () => setWeeklyReviewOpen(true),
      });
    } else {
      store.setAlert(null);
    }
  }, [data, reviewDue, planPending, weeklyReview, language]);

  useEffect(() => {
    return () => usePageChromeStore.getState().clear();
  }, []);

  if (loading && !data) {
    return (
      <div
        className="flex min-h-[40vh] flex-col items-center justify-center gap-4"
        role="status"
        aria-busy="true"
        aria-label={t('dashboard.loading')}
      >
        <Logo size="lg" className="animate-pulse" />
        {slowLoad && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {language === 'ar'
              ? 'الاتصال بالخادم قد يستغرق وقتاً. إذا كان الخادم يعيد التشغيل سيتم المحاولة تلقائياً.'
              : 'Connecting to the server can take a while. Retrying automatically if the backend is restarting.'}
          </p>
        )}
      </div>
    );
  }

  if (error && !data) {
    const retrying = isTransientApiError(error);
    return (
      <div
        className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center"
        role="alert"
      >
        <Logo size="lg" className={cn(retrying && 'animate-pulse opacity-70')} />
        <div className={cn(CARD, 'max-w-md p-6')}>
          <p className="text-sm text-gray-700 dark:text-gray-200">{error}</p>
          {retrying ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {language === 'ar'
                ? 'إعادة المحاولة تلقائياً…'
                : 'Retrying automatically…'}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void load(false, true)}
            className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            {t('dashboard.retry')}
          </button>
        </div>
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
  const od = authUser?.profile?.onboardingData as Record<string, unknown> | undefined;

  const dashboardAlerts = (
    <>
      {planPending && !isPlansSection && (
        <div
          className={cn(
            CARD,
            'mb-4 border border-brand-500/30 bg-brand-500/10 p-4 text-sm text-gray-800 dark:text-gray-200',
          )}
        >
          <p className="font-semibold text-brand-600 dark:text-brand-400">
            {t('dashboard.plansGenerating')}
          </p>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            {t('dashboard.plansGeneratingHint')}
          </p>
        </div>
      )}
    </>
  );

  if (isPlansSection) {
    return (
      <div className="athlete-dashboard page-shell w-full min-w-0 max-w-full flex-1 pb-2">
        {dashboardAlerts}
        <WorkoutDietPlansCard
          data={data}
          analytics={analytics}
          personalization={personalization}
          userId={authUser?.id}
          signedUpDateKey={authUser?.createdAt?.slice(0, 10) ?? null}
          onRefresh={() => loadSilent(true)}
          onLiveTotalsChange={setKpiLiveTotals}
        />
        <WeeklyAdaptationReviewModal
          open={weeklyReviewOpen}
          onClose={() => setWeeklyReviewOpen(false)}
          initial={weeklyReview ?? null}
          userId={authUser?.id}
          today={data?.today?.date}
          language={language === 'en' ? 'en' : 'ar'}
          onCompleted={() => void load(true)}
        />
      </div>
    );
  }

  return (
    <div className="athlete-dashboard page-shell w-full min-w-0 max-w-full flex-1 pb-2">
      {dashboardAlerts}
      <AthleteProfileHeaderCard
        authUser={authUser}
        data={data}
        plan={personalization}
        onRefresh={load}
      />

      {data.todayPlan?.explainabilityText?.trim() ? (
        <p
          className={cn(
            CARD,
            'mb-4 border border-brand-500/25 bg-brand-500/5 px-4 py-2.5 text-xs leading-relaxed text-gray-700 dark:text-gray-200',
          )}
        >
          <span className="font-semibold text-brand-600 dark:text-brand-400">
            {t('dashboard.planExplainability')}:
          </span>{' '}
          {data.todayPlan.explainabilityText.trim()}
        </p>
      ) : null}

      <div className="grid min-h-0 w-full max-w-full grid-cols-12 items-start gap-[clamp(0.5rem,1.25dvh,1.5rem)]">
        {/* KPI row — primary metrics first on all breakpoints */}
        <div className="col-span-12">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 md:gap-5 xl:grid-cols-4">
            <FitnessScoreKpiCard
              data={data}
              userId={authUser?.id}
              sleepPreference={sleepPreference}
            />
            <CaloriesKpiFlipCard
              data={data}
              calorieAdherence={analytics.calorieAdherenceToday}
              liveTotals={kpiLiveTotals}
            />
            <WorkoutCompletionKpiCard
              data={data}
              workoutCompletionWeek={analytics.workoutCompletionWeek}
              workoutCompletionToday={analytics.workoutCompletionToday}
              trainingTarget={trainingTarget}
              userId={authUser?.id}
            />
            <CurrentWeightKpiCard
              data={data}
              userId={authUser?.id}
              bodyScore={analytics.bodyScore}
              onWeightLogged={() => load(true)}
            />
          </div>
        </div>

        {/* Compete — full-width strip, side-by-side from sm+ */}
        <div className="col-span-12">
          <CompeteHomeSection />
        </div>

        <div className="col-span-12 min-w-0 lg:col-span-8">
          <ActivityTable data={data} />
        </div>
        <div className="col-span-12 flex min-w-0 flex-col gap-3 sm:gap-4 lg:col-span-4">
          <AiDailySummaryCard alerts={resolveDashboardAiAlerts(data)} />
          <DailyReadinessCard onLogged={() => load(true)} />
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
      </div>

      <WeeklyAdaptationReviewModal
        open={weeklyReviewOpen}
        onClose={() => setWeeklyReviewOpen(false)}
        initial={weeklyReview ?? null}
        userId={authUser?.id}
        today={data?.today?.date}
        language={language === 'en' ? 'en' : 'ar'}
        onCompleted={() => void load(true)}
      />
    </div>
  );
};
