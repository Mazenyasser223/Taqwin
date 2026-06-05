/**
 * Read-side helper for the user's active AI-generated plan.
 *
 * Official store: Postgres (WorkoutPlan + DietPlan). Mongo is not used for plans.
 */
const { fetchActivePlanFromPostgres } = require('../lib/plans/persistPostgres');
const { logger } = require('../lib/logger');

async function fetchActivePlan(userId) {
  try {
    return await fetchActivePlanFromPostgres(userId);
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'fetchActivePlanFromPostgres failed');
    return null;
  }
}

/**
 * Returns the active plan for the given user, memoized on `req`.
 */
async function getActivePlanForRequest(req, userId) {
  if (!userId) return null;
  if (req?.__activePlan && req.__activePlan.userId === userId) return req.__activePlan.plan;
  const plan = await fetchActivePlan(userId);
  if (req) req.__activePlan = { userId, plan };
  return plan;
}

/**
 * Pick the workout day for "today" (UTC day index 1=Sun .. 7=Sat).
 */
function todayWorkoutDay(plan, now = new Date()) {
  if (!plan?.workoutWeeks?.length) return null;
  const dayIndex = new Date(now).getUTCDay() + 1;
  const week = plan.workoutWeeks[0];
  return week.days?.find((d) => d.dayIndex === dayIndex) || null;
}

function todayDietDay(plan, now = new Date()) {
  if (!plan?.dietDays?.length) return null;
  const dayIndex = new Date(now).getUTCDay() + 1;
  return plan.dietDays.find((d) => d.dayIndex === dayIndex) || plan.dietDays[0];
}

module.exports = {
  fetchActivePlan,
  getActivePlanForRequest,
  todayWorkoutDay,
  todayDietDay,
};
