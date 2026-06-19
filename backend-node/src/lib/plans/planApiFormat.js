/**
 * Block C6 — JSON shapes for GET /api/plans/today and /api/plans/week.
 */
const { inferIsRestWorkoutDay } = require('./planWorkoutDay');
const { mealItemMacrosFromFoodRow, resolveMealMacros } = require('./planDietMacros');

function dailyTargetsFromPlans(workoutPlan, dietPlan) {
  return {
    calories: dietPlan?.targetCalories ?? 2000,
    protein: dietPlan?.targetProteinG ?? 120,
    carbs: dietPlan?.targetCarbsG ?? 200,
    fat: dietPlan?.targetFatG ?? 60,
    waterMl: 2500,
  };
}

function formatWorkoutExercise(row) {
  const ex = row.exercise;
  return {
    exerciseId: row.exerciseId,
    name: ex?.name || row.notes || 'Exercise',
    nameAr: ex?.nameAr ?? null,
    category: ex?.category ?? null,
    sets: row.sets ?? 3,
    reps: Number.parseInt(String(row.reps), 10) || 10,
    restSec: row.restSec ?? 90,
    notes: row.notes || '',
  };
}

function formatWorkoutDay(day) {
  if (!day) {
    return { dayIndex: null, isRest: true, focus: null, exercises: [] };
  }
  const exercises = (day.exercises || []).map(formatWorkoutExercise);
  return {
    dayIndex: day.dayIndex,
    isRest: inferIsRestWorkoutDay(day),
    focus: day.focus || null,
    exercises,
  };
}

function formatDietMeals(day) {
  if (!day) return [];
  const meals = [];
  for (const meal of day.meals || []) {
    for (const item of meal.items || []) {
      const macros = resolveMealMacros({
        grams: item.quantity,
        quantity: item.quantity,
        foodItem: item.foodItem,
      });
      meals.push({
        slot: meal.mealType,
        foodItemId: item.foodItemId ?? null,
        webtebId: item.foodItem?.webtebId ?? null,
        name: item.label || item.foodItem?.name || 'Meal',
        grams: item.quantity ?? 100,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        notes: '',
      });
    }
  }
  return meals;
}

function formatDietDay(day) {
  if (!day) return { dayIndex: null, meals: [] };
  return {
    dayIndex: day.dayIndex,
    meals: formatDietMeals(day),
  };
}

/**
 * @param {{
 *   dailyPlan: object,
 *   dayIndex: number,
 *   date: Date,
 *   timezone: string,
 *   workoutPlan?: object|null,
 *   dietPlan?: object|null,
 * }} ctx
 */
function formatTodayPlanResponse(ctx) {
  const { dailyPlan, dayIndex, date, timezone, workoutPlan, dietPlan } = ctx;
  const workout = formatWorkoutDay(dailyPlan.workoutPlanDay);
  const diet = formatDietDay(dailyPlan.dietPlanDay);

  return {
    date: date.toISOString().slice(0, 10),
    dayIndex,
    timezone,
    status: dailyPlan.status,
    lifeMode: dailyPlan.lifeMode,
    readinessScore: dailyPlan.readinessScore ?? null,
    explainabilityText: dailyPlan.explainabilityText || null,
    dailyTargets: dailyTargetsFromPlans(workoutPlan, dietPlan),
    workout,
    diet,
    meta: {
      dailyAthletePlanId: dailyPlan.id,
      workoutPlanId: workoutPlan?.id ?? null,
      dietPlanId: dietPlan?.id ?? null,
      storage: 'postgres',
    },
  };
}

/**
 * @param {{ workoutPlan?: object|null, dietPlan?: object|null, dailyPlans?: object[] }} ctx
 */
function formatWeekPlanResponse(ctx) {
  const { workoutPlan, dietPlan, dailyPlans = [] } = ctx;
  if (!workoutPlan && !dietPlan) {
    return null;
  }

  const weekStartRaw = workoutPlan?.weekStart ?? dietPlan?.weekStart;
  const weekStart = weekStartRaw ? weekStartRaw.toISOString().slice(0, 10) : null;

  const workoutDays = (workoutPlan?.days || []).map(formatWorkoutDay);
  const dietDays = (dietPlan?.days || []).map(formatDietDay);

  return {
    weekStart,
    locale: workoutPlan?.locale || dietPlan?.locale || 'ar',
    dailyTargets: dailyTargetsFromPlans(workoutPlan, dietPlan),
    explainabilityText:
      workoutPlan?.explainabilityText || dietPlan?.explainabilityText || null,
    workout: {
      planId: workoutPlan?.id ?? null,
      status: workoutPlan?.status ?? null,
      source: workoutPlan?.source ?? null,
      days: workoutDays,
    },
    diet: {
      planId: dietPlan?.id ?? null,
      status: dietPlan?.status ?? null,
      source: dietPlan?.source ?? null,
      days: dietDays,
    },
    dailyPlans: dailyPlans.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      status: row.status,
      lifeMode: row.lifeMode,
      workout: formatWorkoutDay(row.workoutPlanDay),
      diet: formatDietDay(row.dietPlanDay),
    })),
    meta: {
      storage: 'postgres',
      workoutPlanId: workoutPlan?.id ?? null,
      dietPlanId: dietPlan?.id ?? null,
    },
  };
}

module.exports = {
  formatTodayPlanResponse,
  formatWeekPlanResponse,
  formatWorkoutDay,
  formatDietDay,
  dailyTargetsFromPlans,
  resolveMealMacros,
  mealItemMacrosFromFoodRow,
};
