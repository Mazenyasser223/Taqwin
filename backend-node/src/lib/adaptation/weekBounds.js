/**
 * Week boundaries for weekly adaptation review (Sun–Sat, UTC date keys).
 */
const { weekStartSundayUtc } = require('../plans/planWeek');
const { calendarDateOnly, addCalendarDays } = require('../plans/planCalendar');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {string|Date} [weekStartIso] YYYY-MM-DD
 * @param {Date} [now]
 * @returns {Date}
 */
function parseWeekStart(weekStartIso, now = new Date()) {
  if (!weekStartIso) return weekStartSundayUtc(now);
  const s = String(weekStartIso).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return weekStartSundayUtc(now);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * The calendar week that just finished and should be reviewed (previous Sun).
 * @param {Date} [now]
 */
function completedReviewWeekStart(now = new Date()) {
  const current = weekStartSundayUtc(now);
  return new Date(current.getTime() - 7 * DAY_MS);
}

/**
 * @param {Date} weekStart Sunday UTC midnight
 * @returns {{ start: Date, end: Date, startIso: string, endIso: string }}
 */
function weekRange(weekStart) {
  const start = utcDateOnly(weekStart);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  return {
    start,
    end,
    startIso: start.toISOString().slice(0, 10),
    endIso: end.toISOString().slice(0, 10),
  };
}

function utcDateOnly(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Review can be submitted after the reviewed week has ended (today > week end).
 * @param {Date} weekStart
 * @param {Date} [now]
 */
function isWeekEndedForReview(weekStart, now = new Date()) {
  const { end } = weekRange(weekStart);
  const today = utcDateOnly(now);
  return today.getTime() > end.getTime();
}

/**
 * Inclusive date bounds for Prisma @db.Date filters.
 * @param {Date} weekStart
 * @param {string} timezone
 */
function weekDateOnlyBounds(weekStart, timezone = 'UTC') {
  const { start, end } = weekRange(weekStart);
  return {
    startDateOnly: calendarDateOnly(new Date(start.getTime() + 12 * 60 * 60 * 1000), timezone),
    endDateOnly: calendarDateOnly(new Date(end.getTime() + 12 * 60 * 60 * 1000), timezone),
  };
}

module.exports = {
  DAY_MS,
  parseWeekStart,
  completedReviewWeekStart,
  weekRange,
  isWeekEndedForReview,
  weekDateOnlyBounds,
  utcDateOnly,
  addCalendarDays,
};
