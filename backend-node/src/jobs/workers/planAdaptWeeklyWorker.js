/**
 * BullMQ worker — plan-adapt-weekly (Block C9/C10).
 */
const { Worker } = require('bullmq');
const { PLAN_ADAPT_WEEKLY_QUEUE } = require('../queues');
const { getBullConnection } = require('../../lib/redisBull');
const { logger } = require('../../lib/logger');
const { getOrCreateUserSettings } = require('../../lib/userSettings');
const { getWeeklyReviewStatus } = require('../../lib/adaptation/weeklyReview');
const { runWeeklyAdaptation } = require('../../lib/adaptation/runWeeklyAdaptation');
const { ensureWeeklyMetricsSnapshot } = require('../../lib/adaptation/progressSnapshot');
const { emitAdaptationNotification } = require('../../lib/adaptation/notifyAdaptation');
const { acquireWeeklyAdaptLock, releaseWeeklyAdaptLock } = require('../../lib/adaptation/weeklyAdaptLock');
const { runWeeklyAdaptBatch } = require('../../lib/adaptation/weeklyAdaptBatch');
let workerInstance = null;

function startPlanAdaptWeeklyWorker() {
  if (workerInstance) return workerInstance;

  const concurrency = Math.max(1, Number(process.env.PLAN_ADAPT_WORKER_CONCURRENCY || 3));

  workerInstance = new Worker(
    PLAN_ADAPT_WEEKLY_QUEUE,
    async (job) => {
      const { userId, weekStart, locale: jobLocale, notifyOnly } = job.data || {};

      if (!userId) throw new Error('plan-adapt-weekly missing userId');

      const lock = await acquireWeeklyAdaptLock(userId);
      if (!lock.acquired) {
        return { ok: false, reason: lock.reason || 'locked' };
      }

      try {
        const settings = await getOrCreateUserSettings(userId);
        const locale = jobLocale === 'en' || jobLocale === 'ar' ? jobLocale : settings?.language === 'en' ? 'en' : 'ar';
        const timezone = settings?.timezone || 'UTC';

        const status = await getWeeklyReviewStatus(userId, { weekStart, locale });

        if (!status.weekEnded) {
          return { ok: false, code: 'WEEK_NOT_ENDED' };
        }

        if (!status.submitted) {
          await ensureWeeklyMetricsSnapshot(userId, { weekStart: status.weekStart, timezone, locale });
        }

        if (notifyOnly || status.missing?.length > 0) {
          if (status.due || status.missing?.length) {
            await emitAdaptationNotification({
              userId,
              kind: 'weekly_review_due',
              locale,
            });
          }
          return { ok: true, mode: 'notify', due: status.due, missing: status.missing };
        }

        const result = await runWeeklyAdaptation(userId, { weekStart, locale });
        return {
          ok: result.ok,
          decision: result.evaluation?.decision,
          code: result.code,
          snapshotId: result.snapshot?.id,
        };
      } finally {
        await releaseWeeklyAdaptLock(userId);
      }
    },
    { connection: getBullConnection(), concurrency }
  );

  workerInstance.on('completed', (job, ret) => {
    logger.info({ jobId: job.id, userId: job.data?.userId, ret }, 'plan-adapt-weekly completed');
  });

  workerInstance.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, userId: job?.data?.userId, err: err?.message }, 'plan-adapt-weekly failed');
  });

  logger.info({ queue: PLAN_ADAPT_WEEKLY_QUEUE, concurrency }, 'plan-adapt-weekly worker listening');
  return workerInstance;
}

/** @deprecated Use runWeeklyAdaptBatch — kept for scripts */
async function enqueueDueWeeklyAdaptations() {
  return runWeeklyAdaptBatch({ respectTimezoneWindow: false });
}

async function stopPlanAdaptWeeklyWorker() {
  if (!workerInstance) return;
  await workerInstance.close();
  workerInstance = null;
}

module.exports = {
  startPlanAdaptWeeklyWorker,
  stopPlanAdaptWeeklyWorker,
  enqueueDueWeeklyAdaptations,
};
