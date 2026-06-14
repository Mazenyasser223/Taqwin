/**
 * Block C11 — refresh DailyAthletePlan rows for one athlete.
 */
const { logger } = require('../logger');
const { invalidateContextBundle } = require('../contextBundle');
const { getOrCreateUserSettings } = require('../userSettings');
const {
  ensureDailyAthletePlanForDate,
  ensureDailyAthletePlansForWeek,
} = require('./dailyAthletePlanService');
const { acquireDailyRefreshLock, releaseDailyRefreshLock } = require('./dailyRefreshLock');
const { calendarDateOnly } = require('./planCalendar');

/**
 * @param {string} userId
 * @param {{ timezone?: string, days?: number, todayOnly?: boolean }} [opts]
 */
async function runDailyRefreshForUser(userId, opts = {}) {
  const lock = await acquireDailyRefreshLock(userId);
  if (!lock.acquired) {
    return { ok: false, reason: lock.reason || 'locked' };
  }

  try {
    const settings = await getOrCreateUserSettings(userId);
    const timezone = opts.timezone || settings?.timezone || 'UTC';
    const days = Math.max(1, Math.min(Number(opts.days) || 7, 14));

    let slice;
    if (opts.todayOnly) {
      const today = await ensureDailyAthletePlanForDate(userId, { timezone });
      slice = {
        ok: today.ok,
        created: today.ok ? 1 : 0,
        total: 1,
        results: [today],
      };
    } else {
      slice = await ensureDailyAthletePlansForWeek(userId, { timezone, days });
    }

    if (slice.ok) {
      await invalidateContextBundle(userId).catch((err) => {
        logger.warn({ err: err.message, userId }, 'invalidateContextBundle after daily refresh');
      });
    }

    const dateKey = calendarDateOnly(new Date(), timezone).toISOString().slice(0, 10);

    return {
      ok: slice.ok,
      userId,
      timezone,
      dateKey,
      created: slice.created,
      total: slice.total,
      reason: slice.ok ? undefined : slice.results?.[0]?.reason || 'no_active_plan',
    };
  } finally {
    await releaseDailyRefreshLock(userId);
  }
}

module.exports = { runDailyRefreshForUser };
