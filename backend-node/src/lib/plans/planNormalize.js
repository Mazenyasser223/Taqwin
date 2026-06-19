/**
 * Normalize Claude plan JSON before validation (smaller LLM output + 4-week template).
 */

const { normalizeDietMealsToSlotShape } = require('./planMealShape');
const { buildWorkoutStructureBlueprint } = require('./planWorkoutBlueprint');

const TARGET_WORKOUT_WEEKS = 4;
const TARGET_DIET_DAYS = 7;

/** Postgres text columns reject NUL (0x00) bytes. */
function sanitizePlanString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\0/g, '').trim();
}

/**
 * Deep-strip NUL bytes from plan JSON strings (coach PDF / LLM output).
 * @param {unknown} value
 */
function sanitizePlanStrings(value) {
  if (typeof value === 'string') return sanitizePlanString(value);
  if (Array.isArray(value)) return value.map(sanitizePlanStrings);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      value[key] = sanitizePlanStrings(value[key]);
    }
  }
  return value;
}

/**
 * Clone week 1 into weeks 2–4 when the model only returned one week (saves tokens).
 * @param {object} plan
 */
function expandWorkoutWeeksToFour(plan) {
  if (!plan?.workoutWeeks?.length) return plan;
  const weeks = plan.workoutWeeks;
  if (weeks.length >= TARGET_WORKOUT_WEEKS) {
    plan.workoutWeeks = weeks.slice(0, TARGET_WORKOUT_WEEKS).map((w, i) => ({
      ...w,
      weekIndex: i + 1,
    }));
    return plan;
  }
  const template = weeks[0];
  const baseDays = JSON.parse(JSON.stringify(template.days || []));
  const out = [{ ...template, weekIndex: 1, days: baseDays }];
  for (let w = 2; w <= TARGET_WORKOUT_WEEKS; w += 1) {
    out.push({
      weekIndex: w,
      days: JSON.parse(JSON.stringify(baseDays)),
    });
  }
  plan.workoutWeeks = out;
  return plan;
}

/**
 * Force week 1 shape to match onboarding blueprint (rest/training days, types).
 * @param {object} plan
 * @param {object | null | undefined} blueprint from buildWorkoutStructureBlueprint
 */
function applyWorkoutStructureFromBlueprint(plan, blueprint) {
  const skeleton = blueprint?.workoutSkeleton;
  if (!plan?.workoutWeeks?.length || !Array.isArray(skeleton) || !skeleton.length) return plan;

  const skeletonByDay = new Map(skeleton.map((d) => [d.dayIndex, d]));

  for (const week of plan.workoutWeeks) {
    const existingByDay = new Map((week.days || []).map((d) => [d.dayIndex, d]));
    week.days = skeleton.map((sk) => {
      const existing = existingByDay.get(sk.dayIndex);
      if (sk.isRest) {
        return {
          dayIndex: sk.dayIndex,
          type: 'rest',
          label: sk.label || 'Rest',
          isRest: true,
          exercises: [],
        };
      }
      return {
        ...(existing && typeof existing === 'object' ? existing : {}),
        dayIndex: sk.dayIndex,
        type: sk.type || existing?.type || 'full',
        label: sk.label || existing?.label || sk.type || 'Training',
        isRest: false,
        exercises: Array.isArray(existing?.exercises) ? existing.exercises : [],
      };
    });

    for (const day of week.days) {
      if (!skeletonByDay.has(day.dayIndex)) continue;
      const sk = skeletonByDay.get(day.dayIndex);
      if (sk.isRest) {
        day.isRest = true;
        day.type = 'rest';
        day.exercises = [];
      }
    }
  }

  return plan;
}

/**
 * Ensure 7 diet days with labels; merge meal slots from nutrition blueprint when missing.
 * @param {object} plan
 * @param {object | null | undefined} blueprint from buildNutritionStructureBlueprint
 */
function applyDietStructureFromBlueprint(plan, blueprint) {
  if (!plan || typeof plan !== 'object') return plan;
  if (!Array.isArray(plan.dietDays)) plan.dietDays = [];

  const skeleton = blueprint?.dietSkeleton;
  const skeletonByDay = Array.isArray(skeleton)
    ? new Map(skeleton.map((d) => [d.dayIndex, d]))
    : null;

  const existingByDay = new Map(plan.dietDays.map((d) => [d.dayIndex, d]));
  const nextDays = [];

  for (let dayIndex = 1; dayIndex <= TARGET_DIET_DAYS; dayIndex += 1) {
    const existing = existingByDay.get(dayIndex);
    const sk = skeletonByDay?.get(dayIndex);
    const label = existing?.label || sk?.label || `Day ${dayIndex}`;

    let meals = Array.isArray(existing?.meals) ? existing.meals : [];
    if (!meals.length && sk?.meals?.length) {
      meals = sk.meals.map((m) => ({
        slot: m.slot || 'meal',
        items: [],
      }));
    }

    nextDays.push({
      ...(existing && typeof existing === 'object' ? existing : {}),
      dayIndex,
      label,
      meals,
    });
  }

  plan.dietDays = nextDays;
  return plan;
}

/**
 * @param {object|null} plan
 * @param {{ workoutStructureBlueprint?: object, nutritionStructureBlueprint?: object }} [options]
 */
function normalizeClaudePlanShape(plan, options = {}) {
  if (!plan || typeof plan !== 'object') return plan;
  normalizeDietMealsToSlotShape(plan);
  applyWorkoutStructureFromBlueprint(plan, options.workoutStructureBlueprint);
  applyDietStructureFromBlueprint(plan, options.nutritionStructureBlueprint);
  expandWorkoutWeeksToFour(plan);
  return sanitizePlanStrings(plan);
}

module.exports = {
  expandWorkoutWeeksToFour,
  applyWorkoutStructureFromBlueprint,
  applyDietStructureFromBlueprint,
  normalizeClaudePlanShape,
  sanitizePlanStrings,
  sanitizePlanString,
  TARGET_WORKOUT_WEEKS,
  TARGET_DIET_DAYS,
};
