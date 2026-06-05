import type { AthleteHomeDashboard } from '../../../services/dashboardService';
import type { TodayPlanPayload, WeekPlanPayload } from '../../../services/plansService';
import type { TodayWorkoutExercise } from '../../../services/exerciseService';
import { formatWeekdayLabel } from '../dashboardLocale';
import {
  buildRollingWeekDays,
  buildPlanAlignedWeekDays,
  planDayIndexFromDateKey,
  planDayIndexForDateInPlan,
  type WeekPlanDay,
} from '../weekPlanNavigation';

export { planDayIndexFromDateKey };

type AnalyticsWorkout = NonNullable<AthleteHomeDashboard['analytics']>['todayWorkoutPlan'];
type AnalyticsDiet = NonNullable<AthleteHomeDashboard['analytics']>['dietToday'];
type WeekWorkoutDay = WeekPlanPayload['workout']['days'][number];
type WeekDietDay = WeekPlanPayload['diet']['days'][number];

export function hasOfficialWeekPlan(data: AthleteHomeDashboard): boolean {
  return Boolean(
    data.officialWeekPlan?.meta &&
    (data.officialWeekPlan.meta as { storage?: string }).storage === 'postgres'
  );
}

export function hasPostgresTodayPlan(data: AthleteHomeDashboard): boolean {
  return Boolean(
    hasOfficialWeekPlan(data) ||
    data.todayPlan?.meta?.storage === 'postgres' ||
    data.todayWorkout?.storage === 'postgres' ||
    data.todayDiet?.storage === 'postgres'
  );
}

/** Match backend inferIsRestWorkoutDay — focus push/legs/pull is training even if DB flag wrong. */
export function inferWorkoutDayIsRest(workout: WeekWorkoutDay | null | undefined): boolean {
  if (!workout) return true;
  if ((workout.exercises?.length ?? 0) > 0) return false;
  const focus = String(workout.focus || '')
    .toLowerCase()
    .trim();
  if (focus && focus !== 'rest') return false;
  return Boolean(workout.isRest);
}

function mapDashboardPlanSource(
  source: string | null | undefined,
  explainabilityText?: string | null
): AnalyticsWorkout['planSource'] {
  const explain = String(explainabilityText || '');
  if (/خطة أسبوعية من ملفك|weekly plan from your profile|تمارين ووجبات/i.test(explain)) {
    return 'rules';
  }
  if (/safe scaffold|scaffold plan|ANTHROPIC_API_KEY/i.test(explain)) {
    return 'fallback';
  }
  if (!source) return null;
  if (source === 'onboarding') return 'rules';
  if (source === 'ai' || source === 'manual' || source === 'fallback' || source === 'rules') {
    return source;
  }
  return null;
}

function officialSliceForDate(
  data: AthleteHomeDashboard,
  dateKey: string
): {
  workout: WeekWorkoutDay | null;
  diet: WeekDietDay | null;
  targets: WeekPlanPayload['dailyTargets'];
  planSource: AnalyticsWorkout['planSource'];
} | null {
  const week = data.officialWeekPlan;
  if (!week) return null;

  const dayIndex = planDayIndexForDateInPlan(dateKey, week.weekStart);
  const daily = week.dailyPlans?.find((d) => d.date === dateKey);
  const workout =
    daily?.workout ??
    week.workout.days.find((d) => d.dayIndex === dayIndex) ??
    null;
  const diet =
    daily?.diet ?? week.diet.days.find((d) => d.dayIndex === dayIndex) ?? null;
  const rawSource = week.workout.source ?? week.diet.source ?? null;

  return {
    workout,
    diet,
    targets: week.dailyTargets,
    planSource: mapDashboardPlanSource(rawSource, week.explainabilityText),
  };
}

export function mapExercisesToTodayWorkout(
  rows?: Array<{
    exerciseId?: string | null;
    name: string;
    nameAr?: string | null;
    sets: number;
    reps: number;
    category?: string | null;
  }>
): TodayWorkoutExercise[] {
  return (rows ?? []).map((e) => ({
    exerciseId: e.exerciseId ?? undefined,
    name: e.name,
    nameAr: e.nameAr ?? undefined,
    sets: e.sets,
    reps: e.reps,
    category: e.category ?? undefined,
  }));
}

export function resolveTodayWorkoutView(data: AthleteHomeDashboard): {
  workoutPlan: AnalyticsWorkout;
  exercises: TodayWorkoutExercise[];
  isRestToday: boolean;
} {
  return resolveDayWorkoutView(data, data.today.date, true);
}

export function resolveDayWorkoutView(
  data: AthleteHomeDashboard,
  dateKey: string,
  isViewingToday: boolean
): {
  workoutPlan: AnalyticsWorkout;
  exercises: TodayWorkoutExercise[];
  isRestToday: boolean;
} {
  if (isViewingToday) {
    const legacy = data.analytics?.todayWorkoutPlan ?? {
      hasLoggedToday: data.today.workouts.length > 0,
      title: data.today.workouts[0]?.title ?? 'Training session',
      durationMin: data.today.workouts[0]?.durationMin ?? 45,
      exercisesCount: 0,
      exercises: [],
    };

    const tw = data.todayWorkout;
    const plan = data.todayPlan;
    const planExercises = mapExercisesToTodayWorkout(
      tw?.exercises?.length ? tw.exercises : plan?.workout?.exercises
    );

    const isRestToday = Boolean(tw?.isRest ?? plan?.workout?.isRest ?? legacy.isRest);

    const workoutPlan: AnalyticsWorkout = {
      ...legacy,
      hasLoggedToday: tw?.hasLoggedToday ?? legacy.hasLoggedToday,
      isRest: isRestToday,
      title: tw?.title ?? legacy.title,
      durationMin: tw?.durationMin ?? legacy.durationMin ?? 45,
      exercisesCount: tw?.exercisesCount ?? planExercises.length ?? legacy.exercisesCount,
      planSource: (tw?.planSource ?? legacy.planSource ?? null) as AnalyticsWorkout['planSource'],
      exercises: planExercises.length ? planExercises : legacy.exercises,
    };

    const exercises =
      planExercises.length > 0
        ? planExercises
        : (legacy.exercises ?? []).length > 0
          ? legacy.exercises!
          : [];

    return { workoutPlan, exercises, isRestToday };
  }

  const legacy = data.analytics?.todayWorkoutPlan ?? {
    hasLoggedToday: false,
    title: 'Training session',
    durationMin: 45,
    exercisesCount: 0,
    exercises: [],
  };

  const slice = officialSliceForDate(data, dateKey);
  if (!slice?.workout) {
    return {
      workoutPlan: { ...legacy, isRest: true, exercises: [] },
      exercises: [],
      isRestToday: true,
    };
  }

  const planExercises = mapExercisesToTodayWorkout(slice.workout.exercises);
  const isRestToday = inferWorkoutDayIsRest(slice.workout);
  const focus = slice.workout.focus?.trim();
  const displayExercises =
    isRestToday || planExercises.length > 0
      ? planExercises
      : placeholderExercisesForFocus(focus);

  const workoutPlan: AnalyticsWorkout = {
    ...legacy,
    hasLoggedToday: false,
    isRest: isRestToday,
    title: isRestToday ? 'Rest day' : focus ? focus.toUpperCase() : legacy.title,
    durationMin: legacy.durationMin ?? 45,
    exercisesCount: displayExercises.length,
    planSource: slice.planSource ?? legacy.planSource,
    exercises: displayExercises,
  };

  return {
    workoutPlan,
    exercises: isRestToday ? [] : displayExercises,
    isRestToday,
  };
}

const FOCUS_PLACEHOLDER_EXERCISES: Record<string, TodayWorkoutExercise> = {
  legs: { name: 'Goblet Squat', sets: 3, reps: 12 },
  push: { name: 'Dumbbell Chest Press', sets: 3, reps: 12 },
  pull: { name: 'Dumbbell Row', sets: 3, reps: 12 },
  core: { name: 'Plank', sets: 3, reps: 1 },
};

function placeholderExercisesForFocus(focus: string | null | undefined): TodayWorkoutExercise[] {
  const key = String(focus || '')
    .toLowerCase()
    .trim();
  const row = FOCUS_PLACEHOLDER_EXERCISES[key];
  return row ? [row] : [{ name: 'Training session', sets: 3, reps: 10 }];
}

export function resolveTodayDietView(data: AthleteHomeDashboard): NonNullable<AnalyticsDiet> {
  return resolveDayDietView(data, data.today.date, true);
}

export function resolveDayDietView(
  data: AthleteHomeDashboard,
  dateKey: string,
  isViewingToday: boolean
): NonNullable<AnalyticsDiet> {
  const legacy =
    data.analytics?.dietToday ??
    ({
      calories: { current: data.today.nutrition.calories, target: data.targets.calorieTarget },
      protein: { current: data.today.nutrition.protein, target: data.targets.proteinTarget },
      carbs: { current: data.today.nutrition.carbs, target: data.targets.carbTarget },
      fat: { current: data.today.nutrition.fat, target: data.targets.fatTarget },
      water: { currentMl: 0, targetMl: 2500 },
    } satisfies NonNullable<AnalyticsDiet>);

  if (isViewingToday) {
    const td = data.todayDiet;
    if (!td) return legacy;
    return {
      calories: td.calories,
      protein: td.protein,
      carbs: td.carbs,
      fat: td.fat,
      water: td.water,
      meals: td.meals?.length ? td.meals : legacy.meals,
      planSource: (td.planSource ?? legacy.planSource) as AnalyticsDiet['planSource'],
      planVersion: legacy.planVersion,
    };
  }

  const slice = officialSliceForDate(data, dateKey);
  if (!slice) return legacy;

  const meals = (slice.diet?.meals ?? []).map((m) => ({
    slot: m.slot,
    name: m.name,
    grams: m.grams,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    foodItemId: m.foodItemId ?? null,
    webtebId: null as number | null,
    notes: m.notes ?? '',
  }));

  const t = slice.targets;
  return {
    calories: { current: 0, target: t.calories },
    protein: { current: 0, target: t.protein },
    carbs: { current: 0, target: t.carbs },
    fat: { current: 0, target: t.fat },
    water: { currentMl: 0, targetMl: t.waterMl },
    meals,
    planSource: slice.planSource as AnalyticsDiet['planSource'],
    planVersion: legacy.planVersion,
  };
}

export function todayPlanMeals(data: AthleteHomeDashboard): TodayPlanPayload['diet']['meals'] {
  const fromDiet = data.todayDiet?.meals;
  if (fromDiet?.length) {
    return fromDiet.map((m) => ({
      slot: m.slot,
      foodItemId: m.foodItemId,
      name: m.name,
      grams: m.grams,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      notes: m.notes ?? '',
    }));
  }
  return data.todayPlan?.diet?.meals ?? [];
}

export function mealsForOfficialDate(
  data: AthleteHomeDashboard,
  dateKey: string
): TodayPlanPayload['diet']['meals'] {
  if (dateKey === data.today.date) return todayPlanMeals(data);
  const slice = officialSliceForDate(data, dateKey);
  return slice?.diet?.meals ?? [];
}

export function planSourceBadgeKey(
  source: string | null | undefined
): 'dashboard.planBadgeAi' | 'dashboard.planBadgeManual' | 'dashboard.planBadgeCoach' | null {
  if (source === 'ai' || source === 'onboarding') return 'dashboard.planBadgeAi';
  if (source === 'manual') return 'dashboard.planBadgeManual';
  if (source === 'fallback' || source === 'rules') return 'dashboard.planBadgeCoach';
  return null;
}

type TodayMealPlan = NonNullable<NonNullable<AthleteHomeDashboard['analytics']>['todayMealPlan']>;

function slotDisplayLabel(slot: string): string {
  return slot
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildMealPlanFromMeals(
  meals: TodayPlanPayload['diet']['meals'],
  planSource: string | null | undefined,
  fallback?: TodayMealPlan
): TodayMealPlan | undefined {
  if (!meals.length) return fallback;

  const grouped = new Map<string, TodayPlanPayload['diet']['meals']>();
  for (const meal of meals) {
    const key = meal.slot || 'meal';
    const list = grouped.get(key) ?? [];
    list.push(meal);
    grouped.set(key, list);
  }

  const slots = [...grouped.entries()].map(([slotType, items], idx) => {
    const slotCalories = items.reduce((s, i) => s + (i.calories ?? 0), 0);
    const slotProtein = items.reduce((s, i) => s + (i.protein ?? 0), 0);
    const isSnack = /snack/i.test(slotType);
    return {
      id: `pg-${slotType}-${idx}`,
      label: slotDisplayLabel(slotType),
      kind: isSnack ? ('snack' as const) : ('meal' as const),
      items: items.map((item, itemIdx) => ({
        name: item.name,
        role: itemIdx === 0 ? 'main' : undefined,
        grams: item.grams,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
      })),
      targetCalories: Math.max(slotCalories, 1),
      targetProtein: slotProtein > 0 ? slotProtein : null,
    };
  });

  const mainMeals = slots.filter((s) => s.kind === 'meal').length;
  const snacks = slots.filter((s) => s.kind === 'snack').length;
  const planTotalCalories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);

  return {
    planSource: (mapDashboardPlanSource(planSource) ?? fallback?.planSource ?? 'ai') as TodayMealPlan['planSource'],
    mainMeals: mainMeals || slots.length,
    snacks,
    planTotalCalories,
    slots,
  };
}

/** Map Postgres / C7 meals into the slot shape used by DietMealChecklist. */
export function buildTodayMealPlanFromPostgres(
  data: AthleteHomeDashboard,
  fallback?: TodayMealPlan
): TodayMealPlan | undefined {
  if (!hasPostgresTodayPlan(data)) return fallback;
  return buildMealPlanFromMeals(
    todayPlanMeals(data),
    data.todayDiet?.planSource ?? data.officialWeekPlan?.diet?.source,
    fallback
  );
}

export function buildMealPlanForSelectedDay(
  data: AthleteHomeDashboard,
  dateKey: string,
  isViewingToday: boolean,
  fallback?: TodayMealPlan
): TodayMealPlan | undefined {
  if (!hasOfficialWeekPlan(data) && !hasPostgresTodayPlan(data)) return fallback;
  const meals = mealsForOfficialDate(data, dateKey);
  const source = isViewingToday
    ? data.todayDiet?.planSource
    : data.officialWeekPlan?.diet?.source ?? data.officialWeekPlan?.workout?.source;
  return buildMealPlanFromMeals(meals, source, fallback);
}

/** Align rolling week strip with official Postgres template (all week offsets). */
export function mergePostgresIntoWeekStrip(
  days: WeekPlanDay[],
  data: AthleteHomeDashboard,
  todayKey: string,
  _weekOffset: number
): WeekPlanDay[] {
  if (!hasOfficialWeekPlan(data)) {
    if (!hasPostgresTodayPlan(data)) return days;
    const { isRestToday } = resolveTodayWorkoutView(data);
    return days.map((d) => {
      if (d.date !== todayKey) return d;
      if (isRestToday) {
        return { ...d, status: 'rest', isTrainingDay: false, splitLabel: null };
      }
      if (d.status === 'rest') {
        return { ...d, status: 'today', isTrainingDay: true };
      }
      return { ...d, status: d.status === 'done' ? 'done' : 'today', isTrainingDay: true };
    });
  }

  return days.map((d) => {
    const slice = officialSliceForDate(data, d.date);
    const isRest = slice?.workout
      ? inferWorkoutDayIsRest(slice.workout)
      : true;
    const focus = slice?.workout?.focus?.trim() || null;

    if (isRest) {
      return {
        ...d,
        status: 'rest',
        isTrainingDay: false,
        splitLabel: focus,
      };
    }

    let status: WeekPlanDay['status'] = d.status === 'done' ? 'done' : 'planned';
    if (d.date === todayKey) status = d.status === 'done' ? 'done' : 'today';

    return {
      ...d,
      status,
      isTrainingDay: true,
      splitLabel: focus ?? d.splitLabel,
    };
  });
}

export function clampWeekSelectionToCurrent(
  todayKey: string,
  selectedDate: string,
  weekOffset: number
): { weekOffset: number; selectedDate: string } {
  const dates = buildRollingWeekDays(todayKey, 0).map((d) => d.date);
  if (weekOffset === 0 && dates.includes(selectedDate) && selectedDate <= todayKey) {
    return { weekOffset, selectedDate };
  }
  const nextDate = dates.includes(todayKey) ? todayKey : dates[0];
  return { weekOffset: 0, selectedDate: nextDate };
}

/** Never keep a future calendar day selected once `todayKey` is known. */
export function normalizePlanSelectedDate(
  todayKey: string,
  selectedDate: string,
  weekOffset: number
): { weekOffset: number; selectedDate: string } {
  if (selectedDate > todayKey) {
    return clampWeekSelectionToCurrent(todayKey, todayKey, 0);
  }
  return clampWeekSelectionToCurrent(todayKey, selectedDate, weekOffset);
}

function isScaffoldDevInsight(text: string): boolean {
  return /ANTHROPIC_API_KEY|Safe scaffold|scaffold plan|خطة آمنة/i.test(text);
}

export function resolveTodayPlanInsight(
  data: AthleteHomeDashboard,
  locale: 'ar' | 'en' = 'ar',
  isViewingToday = true
): string | null {
  if (!isViewingToday) return null;

  const candidates = [
    data.nextAction?.trim(),
    data.aiInsights?.trim(),
    data.todayPlan?.explainabilityText?.trim(),
  ].filter(Boolean) as string[];

  for (const text of candidates) {
    if (!isScaffoldDevInsight(text)) return text;
  }

  if (hasPostgresTodayPlan(data)) {
    return locale === 'ar'
      ? 'خطة أسبوعية من إجاباتك — عدّل التمارين والوجبات كما تشاء.'
      : 'Weekly plan from your answers — edit workouts and meals anytime.';
  }
  return null;
}

export function todayLabelInRollingWeek(
  todayKey: string,
  locale: 'ar' | 'en',
  t: (key: string, params?: Record<string, string>) => string
): string {
  const day = buildRollingWeekDays(todayKey, 0).find((d) => d.date === todayKey);
  if (!day) return todayKey;
  return formatWeekdayLabel(day.day, locale, t, false);
}
