/**
 * Normalize Claude plan JSON before validation (smaller LLM output + 4-week template).
 */

const TARGET_WORKOUT_WEEKS = 4;

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
 * @param {object|null} plan
 */
function normalizeClaudePlanShape(plan) {
  if (!plan || typeof plan !== 'object') return plan;
  return expandWorkoutWeeksToFour(plan);
}

module.exports = {
  expandWorkoutWeeksToFour,
  normalizeClaudePlanShape,
  TARGET_WORKOUT_WEEKS,
};
