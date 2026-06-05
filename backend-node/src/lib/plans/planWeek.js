/**
 * Week boundaries for plan persistence.
 * Template dayIndex 1..7 = day 1..7 of the plan week (day 1 = plan weekStart), not always calendar Sunday.
 */
const { calendarDateOnly, utcDateOnly, DAY_MS } = require('./planCalendar');

/** Sunday 00:00 UTC of the calendar week containing `date`. */
function weekStartSundayUtc(date = new Date()) {
  const d = utcDateOnly(date);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

function weekStartIso(date = new Date()) {
  return weekStartSundayUtc(date).toISOString().slice(0, 10);
}

/**
 * Plan week starts on onboarding completion day; otherwise calendar Sunday (cron/adapt).
 * @param {{ regenerationReason?: string, timezone?: string, now?: Date }} [opts]
 */
function resolvePlanWeekStartDate(opts = {}) {
  const timezone = opts.timezone || 'UTC';
  const now = opts.now || new Date();
  const reason = String(opts.regenerationReason || '').toLowerCase();
  if (reason.includes('onboarding')) {
    return calendarDateOnly(now, timezone);
  }
  const planWeekStart = opts.planWeekStart;
  if (planWeekStart) {
    return planWeekStart instanceof Date ? planWeekStart : utcDateOnly(new Date(planWeekStart));
  }
  return weekStartSundayUtc(now);
}

/**
 * Map calendar date → plan template dayIndex (1..7) relative to stored plan weekStart.
 * @param {Date} date
 * @param {Date} weekStartDateOnly — @db.Date from WorkoutPlan.weekStart
 * @param {string} [timezone]
 */
function planDayIndexInPlanWeek(date, weekStartDateOnly, timezone = 'UTC') {
  const dateOnly = calendarDateOnly(date, timezone);
  const start = weekStartDateOnly instanceof Date ? weekStartDateOnly : utcDateOnly(weekStartDateOnly);
  const diff = Math.round((dateOnly.getTime() - start.getTime()) / DAY_MS);
  if (diff >= 0 && diff <= 6) return diff + 1;
  const d = utcDateOnly(date);
  return d.getUTCDay() + 1;
}

module.exports = {
  DAY_MS,
  utcDateOnly,
  weekStartSundayUtc,
  weekStartIso,
  resolvePlanWeekStartDate,
  planDayIndexInPlanWeek,
};
