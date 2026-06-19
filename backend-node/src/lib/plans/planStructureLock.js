/**
 * Preserve weekly plan skeleton on regeneration so Claude does not reshuffle structure.
 */

const FRESH_GENERATION_REASONS = new Set([
  'onboarding_complete',
  'first_plan',
  'profile_change',
  'goal_change',
  'fresh',
  'new_user',
]);

function shouldApplyPlanStructureLock(regenerationReason = '') {
  const reason = String(regenerationReason || '').trim().toLowerCase();
  if (!reason) return true;
  return !FRESH_GENERATION_REASONS.has(reason);
}

function uniqueStrings(values, cap = 40) {
  const out = [];
  const seen = new Set();
  for (const raw of values || []) {
    const value = String(raw || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * @param {object | null | undefined} plan - legacy plan document from fetchActivePlan
 * @returns {object | null}
 */
function buildPlanStructureLock(plan) {
  if (!plan?.dietDays?.length && !plan?.workoutWeeks?.length) return null;

  const dailyTargets = plan.dailyTargets
    ? {
        calories: Number(plan.dailyTargets.calories) || 0,
        protein: Number(plan.dailyTargets.protein) || 0,
        carbs: Number(plan.dailyTargets.carbs) || 0,
        fat: Number(plan.dailyTargets.fat) || 0,
        waterMl: Number(plan.dailyTargets.waterMl) || 2500,
      }
    : null;

  const week = plan.workoutWeeks?.[0];
  const workoutSkeleton = (week?.days || [])
    .slice()
    .sort((a, b) => (a.dayIndex || 0) - (b.dayIndex || 0))
    .map((day) => ({
      dayIndex: day.dayIndex,
      type: day.type || (day.isRest ? 'rest' : 'full'),
      isRest: Boolean(day.isRest),
      label: day.label || '',
    }));

  const dietSkeleton = (plan.dietDays || [])
    .slice()
    .sort((a, b) => (a.dayIndex || 0) - (b.dayIndex || 0))
    .map((day) => ({
      dayIndex: day.dayIndex,
      label: day.label || '',
      mealSlots: (day.meals || []).map((meal) => meal.slot).filter(Boolean),
    }));

  const anchorFoods = uniqueStrings(
    (plan.dietDays || []).flatMap((day) =>
      (day.meals || []).flatMap((meal) => (meal.items || []).map((item) => item.name)),
    ),
    36,
  );

  const anchorExercises = uniqueStrings(
    (week?.days || [])
      .filter((day) => !day.isRest)
      .flatMap((day) => (day.exercises || []).map((ex) => ex.exerciseId || ex.name)),
    24,
  );

  if (!dailyTargets && !workoutSkeleton.length && !dietSkeleton.length) return null;

  return {
    dailyTargets,
    workoutSkeleton,
    dietSkeleton,
    anchorFoods,
    anchorExercises,
  };
}

module.exports = {
  shouldApplyPlanStructureLock,
  buildPlanStructureLock,
  FRESH_GENERATION_REASONS,
};
