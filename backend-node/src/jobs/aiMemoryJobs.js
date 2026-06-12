/**
 * BullMQ producer — nightly AI memory summarization (Block E4).
 */
const { getAiMemorySummarizeQueue } = require('./queues');
const { isPlanQueueEnabled } = require('../lib/redisBull');
const { logger } = require('../lib/logger');

function memoryJobIdForUser(userId, dateKey) {
  return `ai-memory-${userId}-${dateKey || 'latest'}`;
}

/**
 * @param {{ userId: string, locale?: 'ar'|'en', hours?: number, dryRun?: boolean }} args
 */
async function enqueueAiMemorySummarize({
  userId,
  locale = 'ar',
  hours = 48,
  dryRun = false,
  source = 'nightly_chat',
} = {}) {
  if (!isPlanQueueEnabled()) {
    return { ok: false, reason: 'queue_disabled' };
  }

  const queue = getAiMemorySummarizeQueue();
  if (!queue) return { ok: false, reason: 'queue_unavailable' };

  const dateKey = new Date().toISOString().slice(0, 10);
  const jobId = memoryJobIdForUser(userId, dateKey);

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
      'summarize',
      {
        userId,
        locale: locale === 'en' ? 'en' : 'ar',
        hours,
        dryRun: Boolean(dryRun),
        source:
          source === 'session_chat'
            ? 'session_chat'
            : source === 'tool_success'
              ? 'tool_success'
              : 'nightly_chat',
        enqueuedAt: new Date().toISOString(),
      },
      { jobId }
    );
    logger.info({ userId, jobId: job.id }, 'ai-memory-summarize enqueued');
    return { ok: true, jobId: job.id };
  } catch (err) {
    logger.error({ err: err.message, userId }, 'enqueueAiMemorySummarize failed');
    return { ok: false, reason: err.message };
  }
}

module.exports = { enqueueAiMemorySummarize, memoryJobIdForUser };
