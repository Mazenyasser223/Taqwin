import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import { Link } from 'react-router-dom';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useAuthStore } from '../../../store/useAuthStore';
import dashboardService, {
  type AthleteHomeDashboard,
  type AthletePersonalization,
} from '../../../services/dashboardService';
import gymService from '../../../services/gymService';
import type { GymMembership } from '../../../types';
import type { User } from '../../../types';
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
  localizeBookingStatus,
} from '../dashboardLocale';
import { localizeOnboardingDisplayValue, localizePersonalizationChipLabel } from '../../onboarding/localizeOnboardingDisplay';
import { resolveExerciseDisplayName } from '../../workouts/exerciseLocale';

type AiRecommendation = { key: string; params?: Record<string, string> };

const AI_REC_I18N: Record<string, TranslationKey> = {
  protein: 'dashboard.recProtein',
  cardio: 'dashboard.recCardio',
  caloriesUp: 'dashboard.recCaloriesUp',
  caloriesDown: 'dashboard.recCaloriesDown',
  training: 'dashboard.recTraining',
  logMeals: 'dashboard.recLogMeals',
  todayWorkout: 'dashboard.recTodayWorkout',
  sleepRecovery: 'dashboard.recSleepRecovery',
  trainSafe: 'dashboard.recTrainSafe',
};

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

function buildAiRecommendationsFallback(data: AthleteHomeDashboard): AiRecommendation[] {
  const recs: AiRecommendation[] = [];
  const goal = String(data.profile.fitnessGoal || '').toLowerCase();
  const proteinTarget = Math.round(data.targets.proteinTarget);
  const proteinToday = Math.round(data.today.nutrition.protein);

  if (proteinToday < proteinTarget * 0.75) {
    recs.push({ key: 'protein', params: { target: String(proteinTarget) } });
  }
  const workoutDays = data.weekly.filter((d) => d.workouts > 0).length;
  if (workoutDays < 4) recs.push({ key: 'cardio' });
  const calorieGap = data.targets.calorieTarget - data.today.nutrition.calories;
  if (goal.includes('muscle') || goal.includes('gain')) {
    if (calorieGap > 200) recs.push({ key: 'caloriesUp' });
  } else if (goal.includes('lose') || goal.includes('fat')) {
    if (data.today.nutrition.calories > data.targets.calorieTarget * 1.08) recs.push({ key: 'caloriesDown' });
  } else if (calorieGap > 250) {
    recs.push({ key: 'caloriesUp' });
  }
  if (recs.length < 3 && data.totals.workouts < 3) recs.push({ key: 'training' });
  if (recs.length < 3 && data.today.nutrition.logCount === 0) recs.push({ key: 'logMeals' });
  if (recs.length < 3 && data.today.workouts.length === 0) recs.push({ key: 'todayWorkout' });
  return recs.slice(0, 3);
}

const CARD =
  'rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]';

const BRAND = '#158b8d';
const ACCENT = '#f37021';

type Analytics = NonNullable<AthleteHomeDashboard['analytics']>;

function buildAnalyticsFallback(data: AthleteHomeDashboard): Analytics {
  const calorieAdherenceToday =
    data.targets.calorieTarget > 0
      ? Math.min(100, Math.round((data.today.nutrition.calories / data.targets.calorieTarget) * 100))
      : 0;
  const proteinAdherenceToday =
    data.targets.proteinTarget > 0
      ? Math.min(100, Math.round((data.today.nutrition.protein / data.targets.proteinTarget) * 100))
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
    workoutCompletionToday: data.today.workouts.length > 0 ? 100 : 0,
    weightDeltaWeek:
      weightTrend.length >= 2 && weightTrend[0].weight != null && weightTrend[6].weight != null
        ? Math.round((weightTrend[6].weight! - weightTrend[0].weight!) * 10) / 10
        : 0,
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
  };
}

const chartFont = { fontFamily: 'Space Grotesk, sans-serif' };

type KpiVariant = 'teal' | 'orange' | 'violet';

const KPI_STYLES: Record<
  KpiVariant,
  { accent: string; glow: string; border: string; wash: string; iconFrom: string; iconTo: string }
> = {
  teal: {
    accent: '#158b8d',
    glow: 'rgba(21, 139, 141, 0.35)',
    border: 'border-[#158b8d]/25 dark:border-[#158b8d]/35',
    wash: 'from-[#158b8d]/18 via-[#158b8d]/5 to-transparent',
    iconFrom: 'from-[#158b8d]/45',
    iconTo: 'to-[#158b8d]/10',
  },
  orange: {
    accent: '#f37021',
    glow: 'rgba(243, 112, 33, 0.38)',
    border: 'border-[#f37021]/25 dark:border-[#f37021]/35',
    wash: 'from-[#f37021]/20 via-[#f37021]/6 to-transparent',
    iconFrom: 'from-[#f37021]/50',
    iconTo: 'to-[#f37021]/10',
  },
  violet: {
    accent: '#6366f1',
    glow: 'rgba(99, 102, 241, 0.38)',
    border: 'border-[#6366f1]/25 dark:border-[#6366f1]/35',
    wash: 'from-[#6366f1]/22 via-[#6366f1]/6 to-transparent',
    iconFrom: 'from-[#6366f1]/50',
    iconTo: 'to-[#6366f1]/10',
  },
};

function MiniProgressRing({ percent, color }: { percent: number; color: string }) {
  const r = 17;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90 shrink-0" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" className="text-gray-200/80 dark:text-white/10" strokeWidth="3" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-[stroke-dashoffset] duration-700 ease-out drop-shadow-sm"
        style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
      />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  variant = 'teal',
  progress,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  variant?: KpiVariant;
  progress?: number;
}) {
  const style = KPI_STYLES[variant];
  const pct =
    progress ??
    (value.endsWith('%') ? Math.min(100, parseInt(value.replace(/[^\d]/g, ''), 10) || 0) : undefined);

  return (
    <div
      className={cn(
        'kpi-card-premium group rounded-2xl border p-5 md:p-6',
        'bg-white/90 backdrop-blur-xl dark:bg-white/[0.04]',
        style.border,
        'transition-all duration-300 ease-out',
        'hover:shadow-2xl'
      )}
      style={{
        boxShadow: `0 8px 32px -8px ${style.glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-70"
        style={{ background: style.accent }}
      />
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90', style.wash)} />

      <div className="relative z-[1] flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg',
              style.iconFrom,
              style.iconTo,
              'ring-1 ring-white/20 dark:ring-white/10'
            )}
            style={{ boxShadow: `0 10px 24px -8px ${style.glow}` }}
          >
            <span className="material-symbols-outlined text-[22px]" style={{ color: style.accent }}>
              {icon}
            </span>
          </div>
          {pct != null && !Number.isNaN(pct) ? (
            <div className="relative flex h-11 w-11 items-center justify-center">
              <MiniProgressRing percent={pct} color={style.accent} />
              <span
                className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
                style={{ color: style.accent }}
              >
                {Math.round(pct)}
              </span>
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400/90">
            {label}
          </p>
          <p
            className="mt-1.5 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-[1.65rem]"
            style={{ textShadow: `0 0 40px ${style.glow}` }}
          >
            {value}
          </p>
          {sub ? (
            <p className="mt-1 text-theme-xs leading-snug text-gray-500 dark:text-gray-400">{sub}</p>
          ) : null}
        </div>

        {pct != null && !Number.isNaN(pct) ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-200/80 dark:bg-white/[0.08]">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(100, pct)}%`,
                background: `linear-gradient(90deg, ${style.accent}, ${style.accent}99)`,
                boxShadow: `0 0 12px ${style.glow}`,
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
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
  onRefresh,
}: {
  authUser: User | null;
  data: AthleteHomeDashboard;
  analytics: Analytics;
  plan: AthletePersonalization;
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
  const rewardPoints = computeRewardPoints(data, analytics.bodyScore);
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

function AiDailySummaryCard({ tip, recommendations }: { tip: string; recommendations: AiRecommendation[] }) {
  const { t } = useI18n();
  const items = recommendations.length > 0 ? recommendations : [{ key: 'logMeals' }];

  return (
    <div
      className={cn(
        'kpi-card-premium ai-summary-card group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl border border-brand-500/30',
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

      <div className="relative z-[1] flex h-full flex-col justify-between p-6 md:p-7">
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
              className="material-symbols-outlined hidden text-5xl text-brand-500/15 sm:block dark:text-brand-400/10"
              aria-hidden
            >
              psychology_alt
            </span>
          </div>

          <div
            className={cn(
              'mt-5 rounded-2xl border p-4 md:p-5',
              'border-white/60 bg-white/70 shadow-sm backdrop-blur-md',
              'dark:border-white/10 dark:bg-white/[0.06] dark:shadow-none'
            )}
          >
            <p className="text-base font-semibold leading-relaxed text-gray-800 dark:text-white/95 md:text-lg">
              {tip}
            </p>
          </div>

          <div
            className={cn(
              'mt-4 rounded-xl border border-orange-200/80 p-4 md:p-5',
              'bg-gradient-to-br from-orange-50/95 via-orange-50/70 to-amber-50/50',
              'dark:border-orange-500/25 dark:from-orange-950/35 dark:via-orange-950/20 dark:to-amber-950/15'
            )}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-[#f37021]">trending_up</span>
              <h4 className="text-sm font-bold text-[#f37021]">{t('dashboard.aiRecommendations')}</h4>
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              {items.map((rec) => {
                const i18nKey = AI_REC_I18N[rec.key];
                const text = i18nKey ? t(i18nKey, rec.params) : rec.key;
                return (
                  <li key={`${rec.key}-${text}`} className="marker:text-[#f37021]">
                    {text}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <Link
          to="/ai-assistant"
          className={cn(
            'mt-5 inline-flex w-fit items-center gap-2.5 rounded-xl px-6 py-3.5 text-sm font-bold text-white',
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
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

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
                width: `${Math.max(pct, pct > 0 ? 4 : 0)}%`,
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

function WorkoutDietPlansCard({
  data,
  analytics,
  personalization,
}: {
  data: AthleteHomeDashboard;
  analytics: Analytics;
  personalization: AthletePersonalization;
}) {
  const { t, language } = useI18n();
  const [tab, setTab] = useState<'workout' | 'diet'>('workout');
  const workoutPlan = analytics.todayWorkoutPlan;
  const exercises =
    workoutPlan.exercises ?? [
      { name: 'Bench Press', sets: 4, reps: 12 },
      { name: 'Squats', sets: 4, reps: 12 },
      { name: 'Deadlifts', sets: 3, reps: 8 },
    ];
  const weekPlan =
    analytics.weekPlan ??
    data.weekly.map((d) => ({
      day: d.day,
      date: d.date,
      status: (d.workouts > 0 ? 'done' : 'planned') as 'done' | 'planned' | 'today',
    }));
  const diet =
    analytics.dietToday ?? {
      calories: { current: data.today.nutrition.calories, target: data.targets.calorieTarget },
      protein: { current: data.today.nutrition.protein, target: data.targets.proteinTarget },
      carbs: { current: data.today.nutrition.carbs, target: data.targets.carbTarget },
      fat: { current: data.today.nutrition.fat, target: data.targets.fatTarget },
      water: { currentMl: 0, targetMl: personalization.waterTargetMl || 2500 },
    };

  const statusLabel = (status: string) => {
    if (status === 'done') return t('dashboard.done');
    if (status === 'today') return t('dashboard.todayLabel');
    if (status === 'rest') return t('dashboard.restDay');
    return t('dashboard.planned');
  };

  return (
    <div className={cn(CARD, 'flex h-fit flex-col self-start p-4 sm:p-5')}>
      <h3 className="text-base font-bold text-gray-800 dark:text-white/90 sm:text-lg">
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

      <p className="mt-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">
        {t('dashboard.daysPerWeek', { days: String(personalization.trainingDaysPerWeek) })}
        {personalization.preferredSplit
          ? ` · ${localizeOnboardingDisplayValue('preferredSplit', personalization.preferredSplit, language)}`
          : ''}
      </p>

      <div className="mt-3 grid grid-cols-7 gap-0.5 sm:gap-1">
        {weekPlan.map((d) => {
          const done = d.status === 'done';
          const isToday = d.status === 'today';
          const isRest = d.status === 'rest';
          return (
            <div
              key={d.date}
              className="flex min-w-0 flex-col items-center gap-0.5"
              title={`${formatWeekdayLabel(d.day, language, t, false)} — ${statusLabel(d.status)}${d.splitLabel ? ` (${localizeOnboardingDisplayValue('preferredSplit', d.splitLabel, language)})` : ''}`}
            >
              <span className="w-full truncate text-center text-[7px] font-bold text-gray-500 xs:text-[8px] sm:text-[9px]">
                {formatWeekdayLabel(d.day, language, t)}
              </span>
              <div
                className={cn(
                  'flex h-7 w-full items-center justify-center rounded-md border sm:h-8',
                  done
                    ? 'border-brand-500/40 bg-brand-500/15'
                    : isToday
                      ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/40'
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
            </div>
          );
        })}
      </div>

      {tab === 'workout' ? (
        <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-white/[0.04]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-bold text-gray-800 dark:text-white/90">
                {analytics.todayWorkoutPlan.title &&
                analytics.todayWorkoutPlan.title !== 'Training session' &&
                analytics.todayWorkoutPlan.title !== 'جلسة تدريب'
                  ? analytics.todayWorkoutPlan.title
                  : t('dashboard.todayWorkout')}
              </h4>
              <p className="text-[10px] text-gray-500">
                {formatMinutesShort(analytics.todayWorkoutPlan.durationMin, t)}
                {personalization.preferredSplit
                  ? ` · ${localizeOnboardingDisplayValue('preferredSplit', personalization.preferredSplit, language)}`
                  : ''}
              </p>
            </div>
            <Badge color={analytics.todayWorkoutPlan.hasLoggedToday ? 'success' : 'light'}>
              {analytics.todayWorkoutPlan.hasLoggedToday ? t('dashboard.done') : t('dashboard.planned')}
            </Badge>
          </div>
          <ul className="space-y-2">
            {exercises.map((ex) => (
              <li key={ex.name} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-semibold text-gray-800 dark:text-white/90 sm:text-sm">
                  {resolveExerciseDisplayName({ name: ex.name, nameAr: (ex as { nameAr?: string }).nameAr }, language)}
                </span>
                <span className="shrink-0 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  {ex.detail ?? t('dashboard.setsReps', { sets: String(ex.sets), reps: String(ex.reps) })}
                </span>
              </li>
            ))}
          </ul>
          <Link
            to="/workouts"
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2.5 text-xs font-semibold text-white hover:brightness-110 sm:text-sm"
          >
            <span className="material-symbols-outlined text-lg">play_arrow</span>
            {t('dashboard.startWorkout')}
          </Link>
        </div>
      ) : (
        <div className="mt-3 max-h-[min(420px,55vh)] space-y-2 overflow-y-auto custom-scrollbar pr-0.5">
          <DietMacroCard
            label={t('dashboard.macroCalories')}
            macroKey="calories"
            current={diet.calories.current}
            target={diet.calories.target}
            compact
          />
          <DietMacroCard
            label={t('dashboard.macroProtein')}
            macroKey="protein"
            current={diet.protein.current}
            target={diet.protein.target}
            compact
          />
          <DietMacroCard
            label={t('dashboard.macroCarbs')}
            macroKey="carbs"
            current={diet.carbs.current}
            target={diet.carbs.target}
            compact
          />
          <DietMacroCard
            label={t('dashboard.macroFat')}
            macroKey="fat"
            current={diet.fat.current}
            target={diet.fat.target}
            compact
          />
          <DietMacroCard
            label={t('dashboard.macroWater')}
            macroKey="water"
            current={diet.water.currentMl}
            target={diet.water.targetMl}
            compact
          />
          <Link
            to="/nutrition"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-500/35 bg-brand-500/5 py-2.5 text-xs font-semibold text-brand-600 hover:bg-brand-500/10 dark:text-brand-400"
          >
            <span className="material-symbols-outlined text-base">restaurant</span>
            {t('dashboard.logMeal')}
          </Link>
        </div>
      )}
    </div>
  );
}

function parseBodyNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildBodySnapshot(
  data: AthleteHomeDashboard,
  analytics: Analytics,
  personalization: AthletePersonalization,
  onboardingData?: Record<string, unknown> | null
) {
  const o = onboardingData ?? {};
  const weight = data.profile.weight ?? parseBodyNum(o.weight);
  const height = data.profile.height ?? parseBodyNum(o.height);
  const bmi =
    weight != null && height != null && height > 0
      ? Math.round((weight / (height / 100) ** 2) * 10) / 10
      : null;
  const targetWeight = personalization.targetWeight ?? parseBodyNum(o.targetWeight);
  const toTarget =
    targetWeight != null && weight != null ? Math.round((targetWeight - weight) * 10) / 10 : null;

  const bodyFatRaw = o.inbodyBodyFat;
  const muscleRaw = o.inbodyMuscle;
  const bmrRaw = o.inbodyBmr;
  const bodyFat =
    bodyFatRaw !== undefined && bodyFatRaw !== null && String(bodyFatRaw).trim() !== ''
      ? String(bodyFatRaw).replace(/%/g, '')
      : null;
  const muscleMass =
    muscleRaw !== undefined && muscleRaw !== null && String(muscleRaw).trim() !== ''
      ? String(muscleRaw)
      : null;
  const bmr =
    bmrRaw !== undefined && bmrRaw !== null && String(bmrRaw).trim() !== '' ? String(bmrRaw) : null;

  const measureDefs: Array<{ key: TranslationKey; field: string }> = [
    { key: 'dashboard.bodyWaist', field: 'measureWaist' },
    { key: 'dashboard.bodyChest', field: 'measureChest' },
    { key: 'dashboard.bodyHips', field: 'measureHips' },
    { key: 'dashboard.bodyArm', field: 'measureArm' },
  ];
  const measurements = measureDefs
    .map(({ key, field }) => {
      const raw = o[field];
      if (raw === undefined || raw === null || String(raw).trim() === '') return null;
      return { key, value: String(raw) };
    })
    .filter(Boolean) as Array<{ key: TranslationKey; value: string }>;

  const hasInbody = bodyFat != null || muscleMass != null || bmr != null;
  const hasData =
    weight != null || height != null || hasInbody || measurements.length > 0 || targetWeight != null;

  return {
    weight,
    height,
    bmi,
    targetWeight,
    toTarget,
    bodyFat,
    muscleMass,
    bmr,
    measurements,
    hasInbody,
    hasData,
    delta: analytics.weightDeltaWeek,
  };
}

function BodySnapshotCard({
  data,
  analytics,
  personalization,
  onboardingData,
}: {
  data: AthleteHomeDashboard;
  analytics: Analytics;
  personalization: AthletePersonalization;
  onboardingData?: Record<string, unknown> | null;
}) {
  const { t } = useI18n();
  const snap = useMemo(
    () => buildBodySnapshot(data, analytics, personalization, onboardingData),
    [data, analytics, personalization, onboardingData]
  );

  const goal = String(personalization.goal || data.profile.fitnessGoal || '').toLowerCase();
  const losingGoal = goal.includes('lose') || goal.includes('fat') || goal.includes('weight');
  const deltaGood = losingGoal ? snap.delta <= 0 : snap.delta >= 0;
  const deltaColor =
    snap.delta === 0 ? '#94a3b8' : deltaGood ? '#10b981' : '#f37021';

  if (!snap.hasData) {
    return (
      <div className={cn(CARD, 'relative overflow-hidden px-4 py-5 sm:px-6')}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-500/20 text-violet-600 ring-1 ring-violet-500/25 dark:text-violet-300">
            <span className="material-symbols-outlined text-2xl">body_fat</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white sm:text-lg">
              {t('dashboard.bodySnapshot')}
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('dashboard.bodySnapshotHint')}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t('dashboard.bodySnapshotEmpty')}</p>
        <Link
          to="/profile"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-violet-500/35 bg-violet-500/5 px-4 py-2.5 text-sm font-bold text-violet-700 transition hover:bg-violet-500/10 dark:text-violet-300"
        >
          <span className="material-symbols-outlined text-lg">edit</span>
          {t('dashboard.bodySnapshotCta')}
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        CARD,
        'relative min-w-0 overflow-hidden px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5'
      )}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-25 blur-3xl"
        style={{ background: '#6366f1' }}
      />
      <div
        className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full opacity-15 blur-3xl"
        style={{ background: '#8b5cf6' }}
      />

      <div className="relative z-[1]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-500/20 text-violet-600 ring-1 ring-violet-500/25 dark:text-violet-300">
              <span className="material-symbols-outlined text-2xl">body_fat</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white sm:text-lg">
                {t('dashboard.bodySnapshot')}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('dashboard.bodySnapshotHint')}</p>
            </div>
          </div>
          {snap.bmi != null && (
            <span className="inline-flex shrink-0 items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-extrabold tabular-nums text-violet-700 dark:text-violet-300">
              {t('dashboard.bodyBmi')} {snap.bmi}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {t('dashboard.weightCurrent')}
            </p>
            <p className="text-3xl font-extrabold tabular-nums text-gray-900 dark:text-white">
              {snap.weight != null ? (
                <>
                  {snap.weight}
                  <span className="ms-1 text-base font-semibold text-gray-500">{t('dashboard.kg')}</span>
                </>
              ) : (
                <span className="text-2xl text-gray-400">—</span>
              )}
            </p>
          </div>
          {snap.delta !== 0 && snap.weight != null && (
            <div
              className="flex items-center gap-1.5 rounded-xl border px-3 py-2"
              style={{ borderColor: `${deltaColor}44`, background: `${deltaColor}12` }}
            >
              <span className="material-symbols-outlined text-lg" style={{ color: deltaColor }}>
                {snap.delta > 0 ? 'trending_up' : 'trending_down'}
              </span>
              <span className="text-sm font-extrabold tabular-nums" style={{ color: deltaColor }}>
                {snap.delta > 0 ? '+' : ''}
                {snap.delta} {t('dashboard.kg')}
              </span>
              <span className="text-[10px] font-semibold text-gray-500">{t('dashboard.thisWeek')}</span>
            </div>
          )}
          {snap.height != null && (
            <div className="rounded-xl border border-gray-200/90 bg-gray-50/90 px-3 py-2 dark:border-gray-700 dark:bg-white/[0.04]">
              <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">
                {t('dashboard.bodyHeight')}
              </p>
              <p className="text-lg font-extrabold tabular-nums text-gray-900 dark:text-white">
                {snap.height}
                <span className="text-xs font-semibold text-gray-500"> cm</span>
              </p>
            </div>
          )}
        </div>

        {(snap.hasInbody || snap.targetWeight != null) && (
          <div className="mt-4">
            {snap.hasInbody && (
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                {t('dashboard.bodyInbodySection')}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {snap.bodyFat != null && (
                <div className="rounded-xl border border-orange-500/25 bg-orange-500/8 px-2.5 py-2.5 text-center dark:bg-orange-500/10">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                    {t('dashboard.bodyFat')}
                  </p>
                  <p className="mt-0.5 text-lg font-extrabold tabular-nums text-gray-900 dark:text-white">
                    {snap.bodyFat}
                    <span className="text-xs font-semibold text-gray-500">%</span>
                  </p>
                </div>
              )}
              {snap.muscleMass != null && (
                <div className="rounded-xl border border-brand-500/25 bg-brand-500/8 px-2.5 py-2.5 text-center dark:bg-brand-500/12">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                    {t('dashboard.bodyMuscleMass')}
                  </p>
                  <p className="mt-0.5 text-lg font-extrabold tabular-nums text-gray-900 dark:text-white">
                    {snap.muscleMass}
                    <span className="text-xs font-semibold text-gray-500"> {t('dashboard.kg')}</span>
                  </p>
                </div>
              )}
              {snap.bmr != null && (
                <div className="rounded-xl border border-gray-200/90 bg-gray-50/90 px-2.5 py-2.5 text-center dark:border-gray-700 dark:bg-white/[0.04]">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">
                    {t('dashboard.bodyBmr')}
                  </p>
                  <p className="mt-0.5 text-lg font-extrabold tabular-nums text-gray-900 dark:text-white">
                    {snap.bmr}
                  </p>
                </div>
              )}
              {snap.targetWeight != null && (
                <div className="rounded-xl border border-[#f37021]/25 bg-[#f37021]/8 px-2.5 py-2.5 text-center dark:bg-[#f37021]/12">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-[#f37021]">
                    {t('dashboard.weightTarget')}
                  </p>
                  <p className="mt-0.5 text-lg font-extrabold tabular-nums text-gray-900 dark:text-white">
                    {snap.targetWeight}
                    <span className="text-xs font-semibold text-gray-500"> {t('dashboard.kg')}</span>
                  </p>
                  {snap.toTarget != null && snap.toTarget !== 0 && (
                    <p className="mt-0.5 text-[9px] font-semibold text-gray-500">
                      {t('dashboard.weightToTarget', { kg: String(Math.abs(snap.toTarget)) })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {snap.measurements.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {t('dashboard.bodyMeasurements')}
            </p>
            <div className="flex flex-wrap gap-2">
              {snap.measurements.map((m) => (
                <span
                  key={m.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/8 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-gray-200"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                    {t(m.key)}
                  </span>
                  <span className="tabular-nums">{m.value} cm</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <Link
          to="/profile"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-500/30 bg-violet-500/5 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-500/10 dark:text-violet-300"
        >
          <span className="material-symbols-outlined text-base">edit</span>
          {t('dashboard.bodySnapshotCta')}
        </Link>
      </div>
    </div>
  );
}

function StreakHeatmapCard({ data }: { data: AthleteHomeDashboard }) {
  const { t, language } = useI18n();
  const todayKey = data.today.date;
  const streak = data.streak;
  const cells = data.heatmap;

  const stats = useMemo(() => {
    const activeDays = cells.filter((c) => c.workouts > 0).length;
    const totalWorkouts = cells.reduce((s, c) => s + c.workouts, 0);
    const totalMinutes = cells.reduce((s, c) => s + c.minutes, 0);
    const maxWorkouts = Math.max(1, ...cells.map((c) => c.workouts));
    return { activeDays, totalWorkouts, totalMinutes, maxWorkouts };
  }, [cells]);

  const statusKey: TranslationKey =
    streak >= 7
      ? 'dashboard.streakOnFire'
      : streak >= 3
        ? 'dashboard.streakMomentum'
        : streak >= 1
          ? 'dashboard.streakKeepGoing'
          : 'dashboard.streakStartToday';
  const flameColor = streak >= 7 ? '#f97316' : streak >= 3 ? BRAND : streak >= 1 ? '#6366f1' : '#94a3b8';

  const weeks = useMemo(() => {
    const chunks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      chunks.push(cells.slice(i, i + 7));
    }
    return chunks;
  }, [cells]);

  const weekdayLabels = useMemo(() => {
    const sample = cells.length >= 7 ? cells.slice(0, 7) : cells;
    return sample.map((c) => formatWeekdayLabel(c.day || c.date, language, t));
  }, [cells, language, t]);

  function cellIntensity(workouts: number, maxWorkouts: number) {
    if (workouts <= 0) return 0;
    if (workouts >= maxWorkouts) return 1;
    return 0.35 + (workouts / maxWorkouts) * 0.55;
  }

  return (
    <div
      className={cn(
        CARD,
        'relative min-w-0 overflow-hidden px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5'
      )}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-25 blur-3xl"
        style={{ background: '#f97316' }}
      />
      <div
        className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full opacity-15 blur-3xl"
        style={{ background: BRAND }}
      />

      <div className="relative z-[1]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/35 to-amber-500/20 text-orange-500 ring-1 ring-orange-500/30 dark:text-orange-300">
              <span className="material-symbols-outlined text-2xl">local_fire_department</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white sm:text-lg">
                {t('dashboard.streakHeatmap')}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {t('dashboard.streakHeatmapHint')}
              </p>
            </div>
          </div>
          <span
            className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm"
            style={{ background: flameColor }}
          >
            {t(statusKey)}
          </span>
        </div>

        <div className="mt-4 flex items-end gap-3">
          <div className="flex items-end gap-1.5">
            <span className="material-symbols-outlined text-4xl leading-none" style={{ color: flameColor }}>
              {streak > 0 ? 'whatshot' : 'mode_heat'}
            </span>
            <span className="text-5xl font-extrabold tabular-nums leading-none text-gray-900 dark:text-white">
              {streak}
            </span>
          </div>
          <div className="pb-1">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
              {t('dashboard.streakDayStreak')}
            </p>
            <p className="text-[10px] font-semibold text-gray-500">{t('dashboard.streakLast28')}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-brand-500/25 bg-brand-500/8 px-2 py-2 text-center dark:bg-brand-500/12">
            <p className="text-[9px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              {t('dashboard.streakActiveDays28')}
            </p>
            <p className="mt-0.5 text-lg font-extrabold tabular-nums text-brand-600 dark:text-brand-400">
              {stats.activeDays}
              <span className="text-xs font-semibold text-gray-500">/28</span>
            </p>
          </div>
          <div className="rounded-xl border border-gray-200/90 bg-gray-50/90 px-2 py-2 text-center dark:border-gray-700 dark:bg-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">
              {t('dashboard.streakWorkouts28')}
            </p>
            <p className="mt-0.5 text-lg font-extrabold tabular-nums text-gray-900 dark:text-white">
              {stats.totalWorkouts}
            </p>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/8 px-2 py-2 text-center dark:bg-orange-500/10">
            <p className="text-[9px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
              {t('dashboard.streakMinutes28')}
            </p>
            <p className="mt-0.5 text-lg font-extrabold tabular-nums text-gray-900 dark:text-white">
              {stats.totalMinutes}
            </p>
          </div>
        </div>

        <div className="mt-4 min-w-0" dir="ltr">
          <div className="mb-1.5 grid grid-cols-[auto_repeat(4,minmax(0,1fr))] gap-1 sm:gap-1.5">
            <div className="w-6" />
            {weeks.map((_, wi) => (
              <div
                key={`w-${wi}`}
                className="text-center text-[8px] font-bold uppercase tracking-wide text-gray-400 sm:text-[9px]"
              >
                {t('dashboard.weekShort', { week: String(wi + 1) })}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[auto_repeat(4,minmax(0,1fr))] gap-x-1 gap-y-1 sm:gap-x-1.5 sm:gap-y-1.5">
            {weekdayLabels.map((label, rowIdx) => (
              <React.Fragment key={`row-${label}-${rowIdx}`}>
                <div className="flex w-6 items-center text-[8px] font-bold uppercase text-gray-400 sm:text-[9px]">
                  {label}
                </div>
                {weeks.map((week, wi) => {
                  const cell = week[rowIdx];
                  if (!cell) return <div key={`empty-${wi}-${rowIdx}`} className="aspect-square" />;
                  const isToday = cell.date === todayKey;
                  const intensity = cellIntensity(cell.workouts, stats.maxWorkouts);
                  const title = t('dashboard.streakCellTooltip', {
                    date: cell.date,
                    workouts: String(cell.workouts),
                    workoutLabel: t('dashboard.streakWorkoutLabel'),
                    minutes: formatMinutesShort(cell.minutes, t),
                  });
                  return (
                    <div
                      key={cell.date}
                      title={title}
                      className={cn(
                        'aspect-square min-h-[10px] min-w-0 rounded-[4px] border transition sm:rounded-md',
                        cell.workouts === 0
                          ? 'border-gray-200/80 bg-gray-100/90 dark:border-gray-700/80 dark:bg-white/[0.04]'
                          : 'border-brand-500/30',
                        isToday &&
                          'ring-2 ring-orange-400/70 ring-offset-1 ring-offset-white dark:ring-offset-[#0c1220]'
                      )}
                      style={
                        cell.workouts > 0
                          ? {
                              background: `rgba(21, 139, 141, ${0.22 + intensity * 0.68})`,
                              boxShadow:
                                intensity >= 0.85
                                  ? '0 0 10px rgba(21, 139, 141, 0.35)'
                                  : undefined,
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-500">
            <span>{t('dashboard.streakLegendLess')}</span>
            <div className="flex gap-0.5">
              {[0, 0.35, 0.65, 1].map((level) => (
                <span
                  key={level}
                  className="h-3 w-3 rounded-sm border border-brand-500/20 sm:h-3.5 sm:w-3.5"
                  style={{
                    background:
                      level === 0
                        ? 'rgba(148, 163, 184, 0.25)'
                        : `rgba(21, 139, 141, ${0.25 + level * 0.65})`,
                  }}
                />
              ))}
            </div>
            <span>{t('dashboard.streakLegendMore')}</span>
          </div>
          {streak === 0 && (
            <Link
              to="/workouts"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-600 hover:underline dark:text-brand-400"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              {t('dashboard.workoutLogCta')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function NextSessionCard({ data }: { data: AthleteHomeDashboard }) {
  const { t, language } = useI18n();
  const next = data.upcoming.bookings[0];
  if (!next) {
    return (
      <div className={cn(CARD, 'p-5 sm:p-6')}>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{t('dashboard.nextSession')}</h3>
        <p className="mt-4 text-theme-sm text-gray-500">{t('dashboard.nothingScheduled')}</p>
        <Link to="/trainers" className="mt-4 inline-flex text-sm font-semibold text-brand-500 hover:underline">
          {t('dashboard.bookTrainer')}
        </Link>
      </div>
    );
  }
  return (
    <div className={cn(CARD, 'p-5 sm:p-6')}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{t('dashboard.nextSession')}</h3>
      <p className="mt-3 text-lg font-bold text-gray-800 dark:text-white/90">{next.trainer}</p>
      <p className="mt-1 text-theme-sm text-gray-500">
        {new Date(next.scheduledAt).toLocaleString(localeTag(language), {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}
      </p>
      <Badge color="primary" className="mt-3">
        {localizeBookingStatus(next.status, t)}
      </Badge>
    </div>
  );
}

function useChartTheme() {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return {
    isDark,
    foreColor: isDark ? '#cbd5e1' : '#475569',
    gridColor: isDark ? '#1e293b' : '#e2e8f0',
    tooltipTheme: isDark ? 'dark' : 'light',
  } as const;
}

function CaloriesVsTargetChart({ data, analytics }: { data: AthleteHomeDashboard; analytics: Analytics }) {
  const { t, language } = useI18n();
  const theme = useChartTheme();
  const target = data.targets.calorieTarget;
  const eatenSeries = useMemo(() => data.weekly.map((d) => d.caloriesEaten), [data.weekly]);
  const weekAvg = useMemo(
    () => Math.round(eatenSeries.reduce((s, v) => s + v, 0) / Math.max(1, eatenSeries.length)),
    [eatenSeries]
  );
  const todayEaten = data.today.nutrition.calories;
  const todayDelta = todayEaten - target;
  const statusKey =
    todayDelta > target * 0.1
      ? 'dashboard.chartOver'
      : todayDelta < target * -0.1
        ? 'dashboard.chartUnder'
        : 'dashboard.chartOnTrack';
  const statusColor =
    todayDelta > target * 0.1 ? '#f37021' : todayDelta < target * -0.1 ? '#6366f1' : BRAND;

  const options: ApexOptions = useMemo(
    () => ({
      colors: [BRAND, ACCENT],
      chart: {
        ...chartFont,
        type: 'line',
        toolbar: { show: false },
        zoom: { enabled: false },
        foreColor: theme.foreColor,
        background: 'transparent',
      },
      stroke: {
        curve: 'smooth',
        width: [3, 2],
        dashArray: [0, 7],
      },
      fill: {
        type: ['gradient', 'solid'],
        opacity: [0.4, 0],
        gradient: {
          shade: theme.isDark ? 'dark' : 'light',
          type: 'vertical',
          shadeIntensity: 0.35,
          opacityFrom: 0.55,
          opacityTo: 0.06,
          stops: [0, 88, 100],
        },
      },
      markers: {
        size: [5, 0],
        strokeWidth: 2,
        strokeColors: theme.isDark ? '#0c1220' : '#fff',
        hover: { size: 7 },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: data.weekly.map((d) => formatWeekdayLabel(d.day, language, t, false)),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { fontSize: '12px', fontWeight: 600 } },
      },
      yaxis: {
        min: 0,
        max: Math.max(target, ...eatenSeries) * 1.15 || target * 1.2,
        tickAmount: 5,
        labels: {
          formatter: (v) => `${Math.round(v)}`,
          style: { fontSize: '11px' },
        },
        title: {
          text: t('dashboard.chartKcal'),
          style: { fontSize: '11px', fontWeight: 600, color: theme.foreColor },
        },
      },
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        fontSize: '12px',
        fontWeight: 600,
        markers: { size: 10 },
        labels: { colors: theme.foreColor },
      },
      grid: {
        borderColor: theme.gridColor,
        strokeDashArray: 4,
        padding: { left: 8, right: 12 },
      },
      tooltip: {
        theme: theme.tooltipTheme,
        shared: true,
        intersect: false,
        x: { show: true },
        y: {
          formatter: (val, opts) => {
            const pct = target > 0 ? Math.round((Number(val) / target) * 100) : 0;
            const label =
              opts.seriesIndex === 0 ? t('dashboard.chartEaten') : t('dashboard.chartTargetLine');
            return `${label}: ${Math.round(Number(val))} ${t('dashboard.chartKcal')} (${pct}%)`;
          },
        },
      },
    }),
    [data.weekly, target, eatenSeries, theme, t, language]
  );

  const series = useMemo(
    () => [
      { name: t('dashboard.chartEaten'), type: 'area' as const, data: eatenSeries },
      { name: t('dashboard.chartTargetLine'), type: 'line' as const, data: data.weekly.map(() => target) },
    ],
    [data.weekly, target, eatenSeries, t]
  );

  return (
    <div className={cn(CARD, 'min-w-0 px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-6')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90 sm:text-lg">{t('dashboard.caloriesVsTarget')}</h3>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            {analytics.calorieAdherenceToday}% {t('dashboard.ofTarget')} · {t('dashboard.thisWeek')}
          </p>
        </div>
        <span
          className="inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold text-white"
          style={{ background: statusColor }}
        >
          {t(statusKey)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-gray-200/80 bg-gray-50/80 px-3 py-2.5 dark:border-gray-700/60 dark:bg-white/[0.04]">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{t('dashboard.chartToday')}</p>
          <p className="mt-0.5 text-lg font-extrabold text-gray-900 dark:text-white">
            {todayEaten.toLocaleString()}
            <span className="ml-1 text-xs font-semibold text-gray-500">{t('dashboard.chartKcal')}</span>
          </p>
        </div>
        <div className="rounded-xl border border-orange-200/60 bg-orange-50/50 px-3 py-2.5 dark:border-orange-500/25 dark:bg-orange-950/20">
          <p className="text-[10px] font-bold uppercase tracking-wide text-orange-600/80 dark:text-orange-400">
            {t('dashboard.chartDailyTarget')}
          </p>
          <p className="mt-0.5 text-lg font-extrabold text-[#f37021]">
            {target.toLocaleString()}
            <span className="ml-1 text-xs font-semibold opacity-80">{t('dashboard.chartKcal')}</span>
          </p>
        </div>
        <div className="rounded-xl border border-brand-500/25 bg-brand-500/5 px-3 py-2.5 dark:bg-brand-500/10">
          <p className="text-[10px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
            {t('dashboard.chartWeekAvg')}
          </p>
          <p className="mt-0.5 text-lg font-extrabold text-brand-600 dark:text-brand-400">
            {weekAvg.toLocaleString()}
            <span className="ml-1 text-xs font-semibold opacity-80">{t('dashboard.chartKcal')}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 min-w-0 -mx-1 sm:mx-0">
        <Chart options={options} series={series} type="line" height={300} />
      </div>
      <p className="mt-2 text-center text-[11px] text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-3">
          <span>
            <span className="mr-1.5 inline-block h-0.5 w-5 rounded bg-brand-500 align-middle" />
            {t('dashboard.chartEaten')}
          </span>
          <span>
            <span
              className="mr-1.5 inline-block h-0.5 w-5 rounded border-t-2 border-dashed align-middle"
              style={{ borderColor: ACCENT }}
            />
            {t('dashboard.chartTargetLine')}
          </span>
        </span>
      </p>
    </div>
  );
}

function MacroDistributionChart({ data }: { data: AthleteHomeDashboard }) {
  const { t } = useI18n();
  const theme = useChartTheme();

  const loggedP = Math.round(data.today.nutrition.protein);
  const loggedC = Math.round(data.today.nutrition.carbs);
  const loggedF = Math.round(data.today.nutrition.fat);
  const hasLogged = data.today.nutrition.logCount > 0 || loggedP + loggedC + loggedF > 0;

  const p = hasLogged ? loggedP : Math.round(data.targets.proteinTarget * 0.58);
  const c = hasLogged ? loggedC : Math.round(data.targets.carbTarget * 0.52);
  const f = hasLogged ? loggedF : Math.round(data.targets.fatTarget * 0.48);

  const labels = useMemo(
    () => [t('dashboard.macroProtein'), t('dashboard.macroCarbs'), t('dashboard.macroFat')],
    [t]
  );
  const colors = [BRAND, ACCENT, '#6366f1'];
  const grams = [p, c, f];
  const kcalSeries = [p * 4, c * 4, f * 9];
  const totalKcal = kcalSeries.reduce((a, b) => a + b, 0);
  const percents = kcalSeries.map((v) => (totalKcal > 0 ? Math.round((v / totalKcal) * 100) : 0));

  const macroRows = [
    { key: 'p', label: t('dashboard.macroProtein'), g: p, target: data.targets.proteinTarget, color: BRAND },
    { key: 'c', label: t('dashboard.macroCarbs'), g: c, target: data.targets.carbTarget, color: ACCENT },
    { key: 'f', label: t('dashboard.macroFat'), g: f, target: data.targets.fatTarget, color: '#6366f1' },
  ];

  const options: ApexOptions = useMemo(
    () => ({
      labels,
      colors,
      chart: {
        ...chartFont,
        type: 'donut',
        toolbar: { show: false },
        foreColor: theme.foreColor,
        background: 'transparent',
      },
      dataLabels: { enabled: false },
      stroke: { width: 2, colors: [theme.isDark ? '#0c1220' : '#fff'] },
      legend: {
        position: 'bottom',
        horizontalAlign: 'center',
        fontSize: '12px',
        fontWeight: 600,
        markers: { size: 10 },
        labels: { colors: theme.foreColor },
      },
      plotOptions: {
        pie: {
          donut: {
            size: '72%',
            labels: {
              show: true,
              name: { show: true, fontSize: '11px', fontWeight: 600, offsetY: -8 },
              value: {
                show: true,
                fontSize: '22px',
                fontWeight: 800,
                formatter: (val) => `${Math.round(Number(val))}%`,
              },
              total: {
                show: true,
                label: t('dashboard.chartKcal'),
                fontSize: '11px',
                fontWeight: 600,
                color: theme.foreColor,
                formatter: () => `${totalKcal.toLocaleString()}`,
              },
            },
          },
        },
      },
      tooltip: {
        theme: theme.tooltipTheme,
        y: {
          formatter: (_val, opts) => {
            const i = opts.seriesIndex ?? 0;
            return `${grams[i]}g · ${percents[i]}%`;
          },
        },
      },
    }),
    [labels, grams, percents, totalKcal, theme, t]
  );

  return (
    <div className={cn(CARD, 'p-5 sm:p-6')}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{t('dashboard.macroDistribution')}</h3>
        {!hasLogged && (
          <span className="shrink-0 rounded-full border border-dashed border-brand-500/40 bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-600 dark:text-brand-400">
            Preview
          </span>
        )}
      </div>
      {!hasLogged && (
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{t('dashboard.macroPreview')}</p>
      )}

      <div className="relative mt-2" dir="ltr">
        <Chart options={options} series={kcalSeries} type="donut" height={260} />
      </div>

      <div className="mt-3 space-y-2.5">
        {macroRows.map((row) => {
          const pct = row.target > 0 ? Math.min(100, Math.round((row.g / row.target) * 100)) : 0;
          return (
            <div key={row.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold" style={{ color: row.color }}>
                  {row.label}
                </span>
                <span className="font-medium text-gray-600 dark:text-gray-400">
                  {t('dashboard.macroOfTarget', {
                    current: String(row.g),
                    target: String(Math.round(row.target)),
                  })}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-200/90 dark:bg-white/[0.08]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(pct, pct > 0 ? 6 : 0)}%`,
                    background: row.color,
                    boxShadow: `0 0 10px ${row.color}44`,
                  }}
                />
              </div>
              <p className="mt-0.5 text-[10px] font-semibold text-gray-500">{pct}% {t('dashboard.ofTarget')}</p>
            </div>
          );
        })}
      </div>

      {!hasLogged && (
        <Link
          to="/nutrition"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-500/35 bg-brand-500/5 py-2.5 text-xs font-bold text-brand-600 transition hover:bg-brand-500/10 dark:text-brand-400"
        >
          <span className="material-symbols-outlined text-base">restaurant</span>
          {t('dashboard.logMeal')}
        </Link>
      )}
    </div>
  );
}

function WorkoutConsistencyChart({ data }: { data: AthleteHomeDashboard }) {
  const { t, language } = useI18n();
  const theme = useChartTheme();
  const personalization = personalizationFallback(data);
  const trainingGoal = Math.min(7, Math.max(1, personalization.trainingDaysPerWeek || 4));

  const workoutCounts = useMemo(() => data.weekly.map((d) => d.workouts), [data.weekly]);
  const activeDays = workoutCounts.filter((n) => n > 0).length;
  const totalSessions = data.totals.workouts;
  const totalMinutes = data.totals.minutes;
  const avgSessionMin = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
  const maxY = Math.max(2, ...workoutCounts);
  const adherencePct = Math.min(100, Math.round((activeDays / trainingGoal) * 100));

  const statusKey: TranslationKey =
    adherencePct >= 100
      ? 'dashboard.workoutStatusCrushing'
      : adherencePct >= 70
        ? 'dashboard.workoutStatusOnTrack'
        : 'dashboard.workoutStatusPush';
  const statusColor = adherencePct >= 100 ? '#10b981' : adherencePct >= 70 ? BRAND : ACCENT;

  const ringRadius = 38;
  const circumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = circumference - (adherencePct / 100) * circumference;

  const barColors = useMemo(
    () =>
      data.weekly.map((d) => {
        if (d.workouts <= 0) return theme.isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(226, 232, 240, 0.95)';
        if (d.workouts >= 2) return '#0d9488';
        return BRAND;
      }),
    [data.weekly, theme.isDark]
  );

  const options: ApexOptions = useMemo(
    () => ({
      colors: barColors,
      chart: {
        ...chartFont,
        type: 'bar',
        toolbar: { show: false },
        foreColor: theme.foreColor,
        background: 'transparent',
        animations: { enabled: true, speed: 600 },
      },
      plotOptions: {
        bar: {
          distributed: true,
          borderRadius: 10,
          borderRadiusApplication: 'end',
          columnWidth: '48%',
          dataLabels: { position: 'top' },
        },
      },
      dataLabels: {
        enabled: true,
        offsetY: -8,
        style: { fontSize: '11px', fontWeight: 800, colors: [theme.foreColor] },
        formatter: (val) => (Number(val) > 0 ? String(Math.round(Number(val))) : ''),
      },
      xaxis: {
        categories: data.weekly.map((d) => formatWeekdayLabel(d.day, language, t, false)),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { fontSize: '11px', fontWeight: 700 } },
      },
      yaxis: {
        min: 0,
        max: maxY,
        tickAmount: maxY,
        forceNiceScale: false,
        labels: {
          formatter: (v) => `${Math.round(v)}`,
          style: { fontSize: '10px' },
        },
      },
      legend: { show: false },
      grid: {
        borderColor: theme.gridColor,
        strokeDashArray: 5,
        padding: { top: 12, left: 0, right: 4, bottom: 0 },
      },
      tooltip: {
        theme: theme.tooltipTheme,
        y: {
          formatter: (val, opts) => {
            const i = opts.dataPointIndex ?? 0;
            const mins = data.weekly[i]?.minutes ?? 0;
            const count = Math.round(Number(val));
            if (count === 0) return t('dashboard.workoutDayRest');
            return `${count} ${t('dashboard.workoutSessionsWeek')} · ${formatMinutesShort(mins, t)}`;
          },
        },
      },
    }),
    [data.weekly, barColors, maxY, theme, t, language]
  );

  const series = useMemo(
    () => [{ name: t('dashboard.chartWorkoutsLabel'), data: workoutCounts }],
    [workoutCounts, t]
  );

  return (
    <div
      className={cn(
        CARD,
        'relative min-w-0 overflow-hidden px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5'
      )}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-25 blur-3xl"
        style={{ background: '#10b981' }}
      />
      <div
        className="pointer-events-none absolute -left-12 bottom-0 h-36 w-36 rounded-full opacity-20 blur-3xl"
        style={{ background: BRAND }}
      />

      <div className="relative z-[1]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-brand-500/20 text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-300">
              <span className="material-symbols-outlined text-2xl">fitness_center</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white sm:text-lg">
                {t('dashboard.workoutConsistency')}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {t('dashboard.workoutConsistencyHint')} · {t('dashboard.thisWeek')}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="relative h-[5.5rem] w-[5.5rem]">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
                <circle
                  cx="50"
                  cy="50"
                  r={ringRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="7"
                  className="text-gray-200/90 dark:text-gray-700/80"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={ringRadius}
                  fill="none"
                  stroke={statusColor}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-[stroke-dashoffset] duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold tabular-nums leading-none text-gray-900 dark:text-white">
                  {activeDays}
                </span>
                <span className="mt-0.5 text-[10px] font-bold text-gray-500">/ {trainingGoal}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm"
                style={{ background: statusColor }}
              >
                {t(statusKey)}
              </span>
              <p className="text-end text-[10px] font-bold uppercase tracking-wider text-gray-500">
                {t('dashboard.workoutAdherence')}
              </p>
              <p className="text-end text-xl font-extrabold tabular-nums" style={{ color: statusColor }}>
                {adherencePct}%
              </p>
            </div>
          </div>
        </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-brand-500/25 bg-brand-500/8 px-2.5 py-2.5 text-center dark:bg-brand-500/12">
          <p className="text-[9px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
            {t('dashboard.workoutDaysDone')}
          </p>
          <p className="mt-0.5 text-lg font-extrabold tabular-nums text-brand-600 dark:text-brand-400">
            {activeDays}
            <span className="text-xs font-semibold text-gray-500">/7</span>
          </p>
          <p className="mt-0.5 text-[9px] font-semibold text-gray-500">
            {t('dashboard.workoutWeeklyGoal')}: {trainingGoal}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200/90 bg-gray-50/90 px-2.5 py-2.5 text-center dark:border-gray-700 dark:bg-white/[0.04]">
          <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">
            {t('dashboard.workoutSessionsWeek')}
          </p>
          <p className="mt-0.5 text-lg font-extrabold tabular-nums text-gray-900 dark:text-white">
            {totalSessions}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-2.5 text-center dark:bg-emerald-500/10">
          <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            {t('dashboard.workoutMinutesWeek')}
          </p>
          <p className="mt-0.5 text-lg font-extrabold tabular-nums text-gray-900 dark:text-white">
            {totalMinutes}
          </p>
          {avgSessionMin > 0 && (
            <p className="mt-0.5 text-[9px] font-semibold text-gray-500">
              {t('dashboard.workoutAvgSession')}: {formatMinutesShort(avgSessionMin, t)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 min-w-0" dir="ltr">
        <Chart options={options} series={series} type="bar" height={220} />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-gradient-to-br from-brand-500 to-emerald-600" />
            {t('dashboard.workoutDayDone')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-gray-200 dark:bg-gray-600" />
            {t('dashboard.workoutDayRest')}
          </span>
        </div>
        <Link
          to="/workouts"
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-emerald-500/35 bg-emerald-500/5 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-300"
        >
          <span className="material-symbols-outlined text-sm">add_circle</span>
          {t('dashboard.workoutLogCta')}
        </Link>
      </div>
      </div>
    </div>
  );
}

function WeightProgressChart({
  analytics,
  data,
  personalization,
}: {
  analytics: Analytics;
  data: AthleteHomeDashboard;
  personalization: AthletePersonalization;
}) {
  const { t, language } = useI18n();
  const theme = useChartTheme();
  const points = analytics.weightTrend.filter((p) => p.weight != null) as Array<{
    label: string;
    weight: number;
  }>;

  if (!points.length) {
    return (
      <div className={cn(CARD, 'p-6')}>
        <h3 className="text-lg font-semibold">{t('dashboard.weightProgress')}</h3>
        <p className="mt-4 text-theme-sm text-gray-500">{t('dashboard.noWeight')}</p>
        <Link to="/profile" className="mt-4 inline-flex text-sm font-semibold text-brand-500 hover:underline">
          {t('dashboard.weightUpdateProfile')}
        </Link>
      </div>
    );
  }

  const weights = points.map((p) => p.weight);
  const current = data.profile.weight ?? weights[weights.length - 1];
  const weekStart = weights[0];
  const delta = analytics.weightDeltaWeek;
  const targetWeight = personalization.targetWeight ?? null;
  const toTarget =
    targetWeight != null && current != null ? Math.round((targetWeight - current) * 10) / 10 : null;

  const goal = String(personalization.goal || data.profile.fitnessGoal || '').toLowerCase();
  const losingGoal = goal.includes('lose') || goal.includes('fat') || goal.includes('weight');
  const deltaPositive = delta > 0;
  const deltaGood = losingGoal ? !deltaPositive : deltaPositive;
  const deltaColor = delta === 0 ? theme.foreColor : deltaGood ? '#10b981' : '#f37021';

  const yMin = Math.floor(Math.min(...weights, targetWeight ?? weights[0]) - 1);
  const yMax = Math.ceil(Math.max(...weights, targetWeight ?? weights[0]) + 1);

  const options: ApexOptions = useMemo(
    () => ({
      colors: [BRAND],
      chart: {
        ...chartFont,
        type: 'area',
        toolbar: { show: false },
        zoom: { enabled: false },
        foreColor: theme.foreColor,
        background: 'transparent',
        sparkline: { enabled: false },
      },
      stroke: { curve: 'smooth', width: 3 },
      fill: {
        type: 'gradient',
        gradient: {
          shade: theme.isDark ? 'dark' : 'light',
          type: 'vertical',
          shadeIntensity: 0.4,
          opacityFrom: 0.45,
          opacityTo: 0.04,
          stops: [0, 92, 100],
        },
      },
      markers: {
        size: points.map((_, i) => (i === points.length - 1 ? 6 : 0)),
        strokeWidth: 2,
        strokeColors: theme.isDark ? '#0c1220' : '#fff',
        hover: { size: 8 },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: points.map((p) => formatWeekdayLabel(p.label, language, t, false)),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { fontSize: '12px', fontWeight: 600 } },
      },
      yaxis: {
        min: yMin,
        max: yMax,
        tickAmount: 4,
        labels: {
          formatter: (v) => `${Math.round(Number(v) * 10) / 10}`,
          style: { fontSize: '11px' },
        },
        title: {
          text: t('dashboard.kg'),
          style: { fontSize: '11px', fontWeight: 600, color: theme.foreColor },
        },
      },
      grid: {
        borderColor: theme.gridColor,
        strokeDashArray: 4,
        padding: { left: 8, right: 12, top: 4 },
      },
      annotations:
        targetWeight != null
          ? {
              yaxis: [
                {
                  y: targetWeight,
                  borderColor: ACCENT,
                  strokeDashArray: 6,
                  label: {
                    text: `${t('dashboard.weightTarget')} ${targetWeight}`,
                    style: {
                      color: ACCENT,
                      background: theme.isDark ? '#0c1220' : '#fff',
                      fontSize: '10px',
                      fontWeight: 700,
                    },
                  },
                },
              ],
            }
          : undefined,
      tooltip: {
        theme: theme.tooltipTheme,
        x: { show: true },
        y: {
          formatter: (val) => `${Math.round(Number(val) * 10) / 10} ${t('dashboard.kg')}`,
        },
      },
    }),
    [points, targetWeight, theme, t, yMin, yMax]
  );

  const series = useMemo(
    () => [{ name: t('dashboard.weightProgress'), data: weights }],
    [weights, t]
  );

  return (
    <div
      className={cn(
        CARD,
        'relative min-w-0 overflow-hidden px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5'
      )}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-30 blur-3xl"
        style={{ background: '#6366f1' }}
      />
      <div
        className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full opacity-20 blur-3xl"
        style={{ background: BRAND }}
      />

      <div className="relative z-[1]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-brand-500/20 text-violet-600 ring-1 ring-violet-500/25 dark:text-violet-300"
            >
              <span className="material-symbols-outlined text-2xl">monitor_weight</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white sm:text-lg">
                {t('dashboard.weightProgress')}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('dashboard.weightTrendHint')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-end">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                {t('dashboard.weightCurrent')}
              </p>
              <p className="text-2xl font-extrabold tabular-nums text-gray-900 dark:text-white">
                {current != null ? current : weights[weights.length - 1]}
                <span className="ms-1 text-sm font-semibold text-gray-500">{t('dashboard.kg')}</span>
              </p>
            </div>
            <div
              className="flex flex-col items-center justify-center rounded-xl border px-2.5 py-1.5 min-w-[4.5rem]"
              style={{
                borderColor: `${deltaColor}44`,
                background: `${deltaColor}12`,
              }}
            >
              <span
                className="material-symbols-outlined text-lg"
                style={{ color: deltaColor }}
              >
                {delta > 0 ? 'trending_up' : delta < 0 ? 'trending_down' : 'trending_flat'}
              </span>
              <span className="text-sm font-extrabold tabular-nums" style={{ color: deltaColor }}>
                {delta > 0 ? '+' : ''}
                {delta}
              </span>
              <span className="text-[9px] font-semibold text-gray-500">{t('dashboard.kg')}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-gray-200/90 bg-gray-50/90 px-2 py-2 text-center dark:border-gray-700 dark:bg-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">
              {t('dashboard.weightWeekStart')}
            </p>
            <p className="text-base font-extrabold tabular-nums text-gray-900 dark:text-white">
              {weekStart}
              <span className="text-[10px] font-semibold text-gray-500"> {t('dashboard.kg')}</span>
            </p>
          </div>
          <div className="rounded-xl border border-brand-500/25 bg-brand-500/8 px-2 py-2 text-center dark:bg-brand-500/12">
            <p className="text-[9px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              {t('dashboard.weightChange')}
            </p>
            <p className="text-base font-extrabold tabular-nums" style={{ color: deltaColor }}>
              {delta > 0 ? '+' : ''}
              {delta}
              <span className="text-[10px] font-semibold opacity-80"> {t('dashboard.kg')}</span>
            </p>
          </div>
          <div className="rounded-xl border border-[#f37021]/25 bg-[#f37021]/8 px-2 py-2 text-center dark:bg-[#f37021]/12">
            <p className="text-[9px] font-bold uppercase tracking-wide text-[#f37021]">
              {t('dashboard.weightTarget')}
            </p>
            <p className="text-base font-extrabold tabular-nums text-gray-900 dark:text-white">
              {targetWeight != null ? (
                <>
                  {targetWeight}
                  <span className="text-[10px] font-semibold text-gray-500"> {t('dashboard.kg')}</span>
                </>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </p>
            {toTarget != null && toTarget !== 0 && (
              <p className="mt-0.5 text-[9px] font-semibold text-gray-500">
                {t('dashboard.weightToTarget', { kg: String(Math.abs(toTarget)) })}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 min-w-0" dir="ltr">
          <Chart options={options} series={series} type="area" height={220} />
        </div>

        <Link
          to="/profile"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-500/30 bg-violet-500/5 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-500/10 dark:text-violet-300"
        >
          <span className="material-symbols-outlined text-base">edit</span>
          {t('dashboard.weightUpdateProfile')}
        </Link>
      </div>
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

  const load = useCallback(async () => {
    setLoading(true);
    const res = await dashboardService.athleteHome();
    if (res.error) setError(res.error);
    else {
      setError(null);
      setData(res.data ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, language]);

  const analytics = useMemo(
    () => (data ? data.analytics ?? buildAnalyticsFallback(data) : null),
    [data]
  );

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
          onClick={load}
          className="mt-4 rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white"
        >
          {t('dashboard.retry')}
        </button>
      </div>
    );
  }

  if (!data || !analytics) return null;

  const personalization = personalizationFallback(data);
  const trainingTarget = personalization.trainingDaysPerWeek;

  const weightDisplay =
    data.profile.weight != null
      ? `${data.profile.weight} ${t('dashboard.kg')}`
      : '—';
  const weightSub =
    analytics.weightDeltaWeek !== 0
      ? `${analytics.weightDeltaWeek >= 0 ? '+' : ''}${analytics.weightDeltaWeek} ${t('dashboard.kg')} ${t('dashboard.thisWeek')}`
      : undefined;

  return (
    <div className="athlete-dashboard page-shell w-full min-w-0 max-w-full pb-2">
      <AthleteProfileHeaderCard
        authUser={authUser}
        data={data}
        analytics={analytics}
        plan={personalization}
        onRefresh={load}
      />
      <CoachPlanStrip plan={personalization} />

      <div className="grid grid-cols-12 items-start gap-3 sm:gap-4 md:gap-6">
        {/* Hero: AI Summary + Plans (sidebar height = content only) */}
        <div className="col-span-12 min-w-0 lg:col-span-8">
          <AiDailySummaryCard
            tip={data.coachTip}
            recommendations={data.aiRecommendations ?? buildAiRecommendationsFallback(data)}
          />
        </div>
        <div className="col-span-12 min-w-0 lg:col-span-4">
          <WorkoutDietPlansCard data={data} analytics={analytics} personalization={personalization} />
        </div>

        {/* KPI row */}
        <div className="col-span-12">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6 md:gap-5">
            <KpiCard
              label={t('dashboard.fitnessScore')}
              value={`${analytics.bodyScore}%`}
              sub={t('dashboard.ofTarget')}
              icon="monitoring"
              variant="teal"
              progress={analytics.bodyScore}
            />
            <KpiCard
              label={t('dashboard.caloriesToday')}
              value={`${data.today.nutrition.calories}`}
              sub={`${analytics.calorieAdherenceToday}% · ${data.targets.calorieTarget} ${t('dashboard.targetWord')}`}
              icon="local_fire_department"
              variant="orange"
              progress={analytics.calorieAdherenceToday}
            />
            <KpiCard
              label={t('dashboard.proteinTarget')}
              value={`${Math.round(data.today.nutrition.protein)}g`}
              sub={`${analytics.proteinAdherenceToday}% ${t('dashboard.ofTarget')}`}
              icon="egg_alt"
              variant="teal"
              progress={analytics.proteinAdherenceToday}
            />
            <KpiCard
              label={t('dashboard.workoutCompletion')}
              value={`${analytics.workoutCompletionWeek}%`}
              sub={`${data.totals.workouts}/${trainingTarget} ${t('dashboard.thisWeek')} · ${t('dashboard.kpiTodaySuffix', { pct: String(analytics.workoutCompletionToday) })}`}
              icon="fitness_center"
              variant="teal"
              progress={analytics.workoutCompletionWeek}
            />
            <KpiCard
              label={t('dashboard.currentWeight')}
              value={weightDisplay}
              sub={weightSub}
              icon="scale"
              variant="violet"
            />
            <KpiCard
              label={t('dashboard.bodyProgress')}
              value={`${analytics.bodyScore}%`}
              sub={t('dashboard.readinessScore')}
              icon="accessibility_new"
              variant="teal"
              progress={analytics.bodyScore}
            />
          </div>
        </div>

        {/* Charts: calories + weight (left), macros + session (right) */}
        <div className="col-span-12 min-w-0 xl:col-span-8 flex flex-col gap-3 sm:gap-4 md:gap-5">
          <CaloriesVsTargetChart data={data} analytics={analytics} />
          <WeightProgressChart analytics={analytics} data={data} personalization={personalization} />
          <BodySnapshotCard
            data={data}
            analytics={analytics}
            personalization={personalization}
            onboardingData={authUser?.profile?.onboardingData as Record<string, unknown> | null}
          />
        </div>
        <div className="col-span-12 min-w-0 xl:col-span-4 flex flex-col gap-3 sm:gap-4 md:gap-5">
          <MacroDistributionChart data={data} />
          <StreakHeatmapCard data={data} />
          <NextSessionCard data={data} />
        </div>

        <div className="col-span-12">
          <WorkoutConsistencyChart data={data} />
        </div>

        <div className="col-span-12">
          <ActivityTable data={data} />
        </div>
      </div>
    </div>
  );
};
