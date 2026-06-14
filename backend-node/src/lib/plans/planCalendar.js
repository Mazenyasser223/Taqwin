/**
 * Calendar helpers for plans — dayIndex 1=Sun .. 7=Sat (legacy) + plan-relative indexing (C4/C11).
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function utcDateOnly(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const WEEKDAY_TO_INDEX = {
  Sun: 1,
  Mon: 2,
  Tue: 3,
  Wed: 4,
  Thu: 5,
  Fri: 6,
  Sat: 7,
};

/**
 * @param {Date} [date]
 * @param {string} [timezone='UTC']
 * @returns {number} 1..7
 */
function planDayIndex(date = new Date(), timezone = 'UTC') {
  try {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(date);
    return WEEKDAY_TO_INDEX[weekday] || date.getUTCDay() + 1;
  } catch {
    return date.getUTCDay() + 1;
  }
}

/**
 * Calendar date at UTC midnight for Prisma @db.Date (YYYY-MM-DD in user TZ).
 * @param {Date} [date]
 * @param {string} [timezone='UTC']
 */
function calendarDateOnly(date = new Date(), timezone = 'UTC') {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) {
      return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
    }
  } catch {
    /* fall through */
  }
  return utcDateOnly(date);
}

/** @param {Date} dateOnly — UTC midnight calendar day */
function addCalendarDays(dateOnly, days) {
  const next = new Date(dateOnly);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

module.exports = {
  DAY_MS,
  utcDateOnly,
  planDayIndex,
  calendarDateOnly,
  addCalendarDays,
};
