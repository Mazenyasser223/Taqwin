/**
 * BullMQ producer — mid-week adaptation (Block D1).
 */
const { getPlanMidWeekQueue } = require('./queues');
const { isPlanQueueEnabled } = require('../lib/redisBull');
const { logger } = require('../lib/logger');

function midWeekJobIdForUser(userId, weekStart) {
  return `plan-mid-week-${userId}-${weekStart || 'latest'}`;
}

/**
 * @param {{ userId: string, locale?: 'ar'|'en', dryRun?: boolean, weekStart?: string }} args
 */
async function enqueuePlanMidWeek({ userId, locale = 'ar', dryRun = false, weekStart } = {}) {
  if (!isPlanQueueEnabled()) {
    return { ok: false, reason: 'queue_disabled' };
  }

  const queue = getPlanMidWeekQueue();
  if (!queue) return { ok: false, reason: 'queue_unavailable' };

  const jobId = midWeekJobIdForUser(userId, weekStart);
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
      'mid-week',
      {
        userId,
        locale: locale === 'en' ? 'en' : 'ar',
        dryRun: Boolean(dryRun),
        weekStart: weekStart || null,
        enqueuedAt: new Date().toISOString(),
      },
      { jobId }
    );
    logger.info({ userId, jobId: job.id }, 'plan-mid-week enqueued');
    return { ok: true, jobId: job.id };
  } catch (err) {
    logger.error({ err: err.message, userId }, 'enqueuePlanMidWeek failed');
    return { ok: false, reason: err.message };
  }
}

module.exports = { enqueuePlanMidWeek, midWeekJobIdForUser };
