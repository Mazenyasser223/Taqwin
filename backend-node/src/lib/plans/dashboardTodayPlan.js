/**
 * Block C7 — Bridge C6 daily plan into dashboard athlete/home payload.
 */
const { resolveTodayPlan, loadActivePlanDays, fetchDailyAthletePlansInRange } = require('./dailyAthletePlanService');
const { formatTodayPlanResponse, formatWeekPlanResponse } = require('./planApiFormat');
const { weekStartSundayUtc } = require('./planWeek');
const { calendarDateOnly, addCalendarDays } = require('./planCalendar');
const { getOrCreateUserSettings } = require('../userSettings');
const { mapDashboardPlanSource } = require('./planLegacySource');
const { enrichTodayWorkoutExercises } = require('../athletePersonalization');
const { localizePlanDietMeals, enrichWeekPlanDietMeals } = require('./planDietDisplayNames');

async function enrichWeekPlanWorkoutDays(prisma, weekPayload, onboardingData = {}) {
  if (!weekPayload || !prisma) return weekPayload;

  const enrichDay = async (day) => {
    if (!day?.exercises?.length) return day;
    return {
      ...day,
      exercises: await enrichTodayWorkoutExercises(prisma, day.exercises, onboardingData),
    };
  };

  const workout = weekPayload.workout
    ? {
        ...weekPayload.workout,
        days: await Promise.all((weekPayload.workout.days || []).map(enrichDay)),
      }
    : weekPayload.workout;

  const dailyPlans = weekPayload.dailyPlans
    ? await Promise.all(
        weekPayload.dailyPlans.map(async (row) => ({
          ...row,
          workout: row.workout ? await enrichDay(row.workout) : row.workout,
        }))
      )
    : weekPayload.dailyPlans;

  return { ...weekPayload, workout, dailyPlans };
}

function isScaffoldDevInsight(text) {
  return /ANTHROPIC_API_KEY|Safe scaffold|scaffold plan|خطة آمنة/i.test(String(text || ''));
}

function sanitizePlanInsight(text) {
  const t = String(text || '').trim();
  if (!t || isScaffoldDevInsight(t)) return null;
  return t;
}

function mapPlanSourceForDashboard(source, explainabilityText) {
  return mapDashboardPlanSource(source, explainabilityText);
}

/**
 * @param {string} userId
 * @param {Date} [now]
 * @param {'ar'|'en'} [locale='ar']
 * @returns {Promise<null | {
 *   formatted: ReturnType<typeof formatTodayPlanResponse>,
 *   targets: { calorieTarget: number, proteinTarget: number, carbTarget: number, fatTarget: number, waterMl: number },
 *   exercises: Array<{ exerciseId: string|null, name: string, nameAr?: string|null, sets: number, reps: number, restSec: number, notes: string, category?: string|null }>,
 *   meals: Array<{ slot: string, name: string, grams: number, calories: number, protein: number, carbs: number, fat: number, foodItemId: string|null, webtebId: null, notes: string }>,
 *   isRest: boolean,
 *   explainabilityText: string|null,
 *   planSource: string|null,
 *   planVersion: number|null,
 *   storage: string,
 * }>}
 */
async function loadDashboardTodayPlanContext(userId, now = new Date(), locale = 'ar') {
  const resolved = await resolveTodayPlan(userId, now);
  if (!resolved.ok) return null;

  const formatted = formatTodayPlanResponse({
    dailyPlan: resolved.dailyPlan,
    dayIndex: resolved.dayIndex,
    date: resolved.date,
    timezone: resolved.timezone,
    workoutPlan: resolved.workoutPlan,
    dietPlan: resolved.dietPlan,
  });

  const exercises = (formatted.workout.exercises || []).map((e) => ({
    exerciseId: e.exerciseId ?? null,
    name: e.name,
    nameAr: e.nameAr ?? null,
    sets: e.sets,
    reps: e.reps,
    restSec: e.restSec ?? 90,
    notes: e.notes || '',
    category: e.category ?? null,
  }));

  const rawMeals = (formatted.diet.meals || []).map((m) => ({
    slot: m.slot,
    name: m.name,
    grams: m.grams,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    foodItemId: m.foodItemId ?? null,
    webtebId: m.webtebId ?? null,
    notes: m.notes || '',
  }));
  const meals = await localizePlanDietMeals(rawMeals, locale);
  formatted.diet = { ...formatted.diet, meals };

  const dt = formatted.dailyTargets;
  const rawSource = resolved.workoutPlan?.source || resolved.dietPlan?.source || null;

  return {
    formatted,
    targets: {
      calorieTarget: dt.calories,
      proteinTarget: dt.protein,
      carbTarget: dt.carbs,
      fatTarget: dt.fat,
      waterMl: dt.waterMl,
    },
    exercises,
    meals,
    isRest: Boolean(formatted.workout.isRest),
    explainabilityText: formatted.explainabilityText,
    planSource: mapPlanSourceForDashboard(
      rawSource,
      formatted.explainabilityText ||
        resolved.workoutPlan?.explainabilityText ||
        resolved.dietPlan?.explainabilityText
    ),
    planVersion: null,
    storage: 'postgres',
    dailyAthletePlanId: formatted.meta.dailyAthletePlanId,
    dayIndex: formatted.dayIndex,
    date: formatted.date,
    lifeMode: formatted.lifeMode,
    readinessScore: formatted.readinessScore,
  };
}

function buildProgressSummary({
  calorieAdherenceToday,
  proteinAdherenceToday,
  workoutCompletionToday,
  workoutCompletionWeek,
  weightDeltaWeek,
  bodyScore,
}) {
  return {
    calorieAdherenceToday,
    proteinAdherenceToday,
    workoutCompletionToday,
    workoutCompletionWeek,
    weightDeltaWeek,
    bodyScore,
  };
}

/**
 * @param {{ isRest: boolean, hasLoggedWorkout: boolean, workoutCompletionToday: number, mealsMet: boolean, explainabilityText?: string|null, locale: 'ar'|'en' }} ctx
 */
function buildNextAction(ctx) {
  const isAr = ctx.locale === 'ar';
  if (ctx.explainabilityText?.trim()) {
    return ctx.explainabilityText.trim();
  }
  if (ctx.isRest) {
    return isAr ? 'يوم راحة — ركز على النوم والترطيب' : 'Rest day — focus on sleep and hydration';
  }
  if (!ctx.hasLoggedWorkout && ctx.workoutCompletionToday < 50) {
    return isAr ? 'ابدأ تمرين اليوم من الخطة' : "Start today's planned workout";
  }
  if (!ctx.mealsMet) {
    return isAr ? 'سجّل وجباتك لتتبع الماكروز' : 'Log meals to track your macros';
  }
  return isAr ? 'أنت على المسار — استمر' : 'You are on track — keep going';
}

/**
 * Active weekly workout + diet template (7 dayIndex rows) for dashboard week navigation.
 * @param {string} userId
 * @param {Date} [now]
 */
function buildDashboardPlanMeta(weekPayload) {
  if (!weekPayload?.meta?.storage) return null;
  return {
    storage: 'postgres',
    weekStart: weekPayload.weekStart ?? null,
    workoutPlanId: weekPayload.workout?.planId ?? null,
    dietPlanId: weekPayload.diet?.planId ?? null,
    prismaSource: weekPayload.workout?.source ?? weekPayload.diet?.source ?? null,
    explainabilityText: weekPayload.explainabilityText ?? null,
    locale: weekPayload.locale ?? 'ar',
  };
}

async function loadDashboardWeekPlanContext(userId, now = new Date(), locale = 'ar') {
  const { workoutPlan, dietPlan } = await loadActivePlanDays(userId, { detailed: true });
  if (!workoutPlan && !dietPlan) return null;

  const settings = await getOrCreateUserSettings(userId);
  const timezone = settings?.timezone || 'UTC';
  const planWeekStartRaw = workoutPlan?.weekStart || dietPlan?.weekStart;
  const weekStartDate = planWeekStartRaw
    ? calendarDateOnly(new Date(planWeekStartRaw.getTime() + 12 * 60 * 60 * 1000), timezone)
    : calendarDateOnly(weekStartSundayUtc(now), timezone);
  const weekEndDate = addCalendarDays(weekStartDate, 6);

  const dailyPlans = await fetchDailyAthletePlansInRange(userId, weekStartDate, weekEndDate);
  const week = formatWeekPlanResponse({ workoutPlan, dietPlan, dailyPlans });
  return enrichWeekPlanDietMeals(week, locale);
}

module.exports = {
  loadDashboardTodayPlanContext,
  loadDashboardWeekPlanContext,
  enrichWeekPlanWorkoutDays,
  enrichWeekPlanDietMeals,
  buildDashboardPlanMeta,
  buildProgressSummary,
  buildNextAction,
  sanitizePlanInsight,
  isScaffoldDevInsight,
};
