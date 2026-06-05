/**
 * BullMQ producer — weekly adaptation (Block C9 / C10).
 */
const { getPlanAdaptWeeklyQueue } = require('./queues');
const { isPlanQueueEnabled } = require('../lib/redisBull');
const { logger } = require('../lib/logger');

function adaptJobIdForUser(userId, weekStart) {
  return `plan-adapt-weekly-${userId}-${weekStart || 'latest'}`;
}

/**
 * @param {{ userId: string, weekStart?: string, locale?: 'ar'|'en', notifyOnly?: boolean }} args
 */
async function enqueuePlanAdaptWeekly({
  userId,
  weekStart,
  locale = 'ar',
  notifyOnly = false,
} = {}) {
  if (!isPlanQueueEnabled()) {
    return { ok: false, reason: 'queue_disabled' };
  }

  const queue = getPlanAdaptWeeklyQueue();
  if (!queue) return { ok: false, reason: 'queue_unavailable' };

  const jobId = adaptJobIdForUser(userId, weekStart);
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
      'weekly',
      {
        userId,
        weekStart: weekStart || null,
        locale: locale === 'en' ? 'en' : 'ar',
        notifyOnly: Boolean(notifyOnly),
        enqueuedAt: new Date().toISOString(),
      },
      { jobId }
    );
    logger.info({ userId, jobId: job.id, weekStart }, 'plan-adapt-weekly enqueued');
    return { ok: true, jobId: job.id };
  } catch (err) {
    logger.error({ err: err.message, userId }, 'enqueuePlanAdaptWeekly failed');
    return { ok: false, reason: err.message };
  }
}

module.exports = { enqueuePlanAdaptWeekly, adaptJobIdForUser };
