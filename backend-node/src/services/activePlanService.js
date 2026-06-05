/**
 * Read-side helper for the user's active AI-generated plan.
 *
 * The dashboard and AI coach both need the plan for the current day; this
 * service caches the lookup for a single request (`req` is the cache key)
 * so the same plan isn't fetched twice within one HTTP turn.
 *
 * Returns null when MongoDB isn't configured or the user has no active plan,
 * so callers can keep falling back to formula-based targets seamlessly.
 */
const { isMongoConfigured, connectMongo } = require('../db/mongo/client');
const { logger } = require('../lib/logger');

async function loadPlanModel() {
  if (!isMongoConfigured()) return null;
  try {
    await connectMongo();
  } catch (err) {
    logger.warn({ err: err.message }, 'mongo connect failed for activePlanService');
    return null;
  }
  return require('../db/mongo/models/plan');
}

async function fetchActivePlan(userId) {
  const Plan = await loadPlanModel();
  if (!Plan) return null;
  try {
    const plan = await Plan.findOne({ userId, isActive: true })
      .sort({ createdAt: -1 })
      .lean();
    return plan || null;
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'fetchActivePlan failed');
    return null;
  }
}

/**
 * Returns the active plan for the given user, memoized on `req` so the
 * dashboard handler + downstream helpers share one query.
 */
async function getActivePlanForRequest(req, userId) {
  if (!userId) return null;
  if (req?.__activePlan && req.__activePlan.userId === userId) return req.__activePlan.plan;
  const plan = await fetchActivePlan(userId);
  if (req) req.__activePlan = { userId, plan };
  return plan;
}

/**
 * Pick the workout day for "today" from the active plan, based on UTC day index.
 * `dayIndex` is 1..7; we map Sunday→1, Monday→2, ... Saturday→7.
 */
function todayWorkoutDay(plan, now = new Date()) {
  if (!plan?.workoutWeeks?.length) return null;
  const dow = new Date(now).getUTCDay(); // 0..6 (Sun..Sat)
  const dayIndex = dow + 1;
  const week = plan.workoutWeeks[0]; // Always show week 1 for "today" until weekly progression ships
  const day = week.days?.find((d) => d.dayIndex === dayIndex);
  return day || null;
}

function todayDietDay(plan, now = new Date()) {
  if (!plan?.dietDays?.length) return null;
  const dow = new Date(now).getUTCDay();
  const dayIndex = dow + 1;
  return plan.dietDays.find((d) => d.dayIndex === dayIndex) || plan.dietDays[0];
}

module.exports = {
  fetchActivePlan,
  getActivePlanForRequest,
  todayWorkoutDay,
  todayDietDay,
};
