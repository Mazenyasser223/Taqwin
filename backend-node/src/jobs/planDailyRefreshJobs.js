/**
 * BullMQ producer — plan-daily-refresh (Block C11).
 */
const { getPlanDailyRefreshQueue } = require('./queues');
const { isPlanQueueEnabled } = require('../lib/redisBull');
const { logger } = require('../lib/logger');

function dailyRefreshJobId(userId, dateKey) {
  return `plan-daily-refresh-${userId}-${dateKey || 'today'}`;
}

/**
 * @param {{
 *   userId: string,
 *   timezone?: string,
 *   days?: number,
 *   dateKey?: string,
 *   todayOnly?: boolean,
 * }} args
 */
async function enqueuePlanDailyRefresh({
  userId,
  timezone = 'UTC',
  days = 7,
  dateKey,
  todayOnly = false,
} = {}) {
  if (!isPlanQueueEnabled()) {
    return { ok: false, reason: 'queue_disabled' };
  }

  const queue = getPlanDailyRefreshQueue();
  if (!queue) return { ok: false, reason: 'queue_unavailable' };

  const jobId = dailyRefreshJobId(userId, dateKey);
  try {
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'active' || state === 'waiting' || state === 'delayed') {
        return { ok: true, jobId: existing.id, duplicate: true };
      }
      try {
        await existing.remove();
      } catch {
        /* continue */
      }
    }

    const job = await queue.add(
      'refresh',
      {
        userId,
        timezone,
        days,
        todayOnly: Boolean(todayOnly),
        dateKey: dateKey || null,
        enqueuedAt: new Date().toISOString(),
      },
      { jobId }
    );
    logger.info({ userId, jobId: job.id, dateKey }, 'plan-daily-refresh enqueued');
    return { ok: true, jobId: job.id };
  } catch (err) {
    logger.error({ err: err.message, userId }, 'enqueuePlanDailyRefresh failed');
    return { ok: false, reason: err.message };
  }
}

module.exports = { enqueuePlanDailyRefresh, dailyRefreshJobId };
