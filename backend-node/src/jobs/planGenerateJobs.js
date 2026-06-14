/**
 * Producers + job status for plan:generate queue (Block C3).
 */
const { getPlanGenerateQueue } = require('./queues');
const { isPlanQueueEnabled } = require('../lib/redisBull');
const { acquirePlanGenerateLock, releasePlanGenerateLock } = require('./planGenerateLock');
const { logger } = require('../lib/logger');

function planJobIdForUser(userId) {
  return `plan-generate-${userId}`;
}

/**
 * @param {{
 *   userId: string,
 *   locale?: 'ar'|'en',
 *   regenerationReason?: string,
 *   source?: string,
 * }} args
 * @returns {Promise<{ ok: true, jobId: string, queued: true } | { ok: false, reason: string, jobId?: string }>}
 */
async function enqueuePlanGenerate({
  userId,
  locale = 'ar',
  regenerationReason = '',
  source = 'api',
} = {}) {
  if (!isPlanQueueEnabled()) {
    return { ok: false, reason: 'queue_disabled' };
  }

  const queue = getPlanGenerateQueue();
  if (!queue) {
    return { ok: false, reason: 'queue_unavailable' };
  }

  const lock = await acquirePlanGenerateLock(userId);
  if (!lock.acquired) {
    return { ok: false, reason: lock.reason || 'locked' };
  }

  const jobId = planJobIdForUser(userId);
  const payload = {
    userId,
    locale: locale === 'en' ? 'en' : 'ar',
    regenerationReason: String(regenerationReason || '').slice(0, 120),
    source,
    enqueuedAt: new Date().toISOString(),
  };

  try {
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'active' || state === 'waiting' || state === 'delayed') {
        await releasePlanGenerateLock(userId);
        return { ok: true, jobId: existing.id, queued: false, state, duplicate: true };
      }
      try {
        await existing.remove();
      } catch {
        /* stale job — continue */
      }
    }

    const job = await queue.add('generate', payload, { jobId });
    logger.info({ userId, jobId: job.id, source }, 'plan:generate job enqueued');
    return { ok: true, jobId: job.id, queued: true };
  } catch (err) {
    await releasePlanGenerateLock(userId);
    logger.error({ err: err.message, userId }, 'enqueuePlanGenerate failed');
    return { ok: false, reason: err.message };
  }
}

/**
 * @param {string} jobId
 * @param {string} userId — must match job owner
 */
async function getPlanGenerateJobStatus(jobId, userId) {
  const queue = getPlanGenerateQueue();
  if (!queue) return null;

  const job = await queue.getJob(jobId);
  if (!job || job.data?.userId !== userId) return null;

  const state = await job.getState();
  return {
    jobId: job.id,
    state,
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason || null,
    result: job.returnvalue || null,
    enqueuedAt: job.data?.enqueuedAt,
  };
}

module.exports = {
  isPlanQueueEnabled,
  enqueuePlanGenerate,
  getPlanGenerateJobStatus,
  planJobIdForUser,
};
