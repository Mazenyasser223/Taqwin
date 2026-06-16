/**
 * BullMQ worker — plan-mid-week (Block D1).
 */
const { Worker } = require('bullmq');
const { PLAN_MID_WEEK_QUEUE } = require('../queues');
const { getBullConnection } = require('../../lib/redisBull');
const { logger } = require('../../lib/logger');
const { getOrCreateUserSettings } = require('../../lib/userSettings');
const { runMidWeekCheck } = require('../../lib/adaptation/midWeekTriggers');

let workerInstance = null;

function startPlanMidWeekWorker() {
  if (workerInstance) return workerInstance;

  const concurrency = Math.max(1, Number(process.env.PLAN_MID_WEEK_WORKER_CONCURRENCY || 3));

  workerInstance = new Worker(
    PLAN_MID_WEEK_QUEUE,
    async (job) => {
      const { userId, locale: jobLocale, dryRun } = job.data || {};
      if (!userId) throw new Error('plan-mid-week missing userId');

      const settings = await getOrCreateUserSettings(userId);
      const locale =
        jobLocale === 'en' || jobLocale === 'ar' ? jobLocale : settings?.language === 'en' ? 'en' : 'ar';
      const timezone = settings?.timezone || 'UTC';

      return runMidWeekCheck(userId, { locale, timezone, dryRun: Boolean(dryRun) });
    },
    { connection: getBullConnection(), concurrency }
  );

  workerInstance.on('completed', (job, ret) => {
    logger.info(
      { jobId: job.id, userId: job.data?.userId, applied: ret?.applied, missed: ret?.missedWorkoutDays },
      'plan-mid-week completed'
    );
  });

  workerInstance.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, userId: job?.data?.userId, err: err?.message }, 'plan-mid-week failed');
  });

  logger.info({ queue: PLAN_MID_WEEK_QUEUE, concurrency }, 'plan-mid-week worker listening');
  return workerInstance;
}

async function stopPlanMidWeekWorker() {
  if (!workerInstance) return;
  await workerInstance.close();
  workerInstance = null;
}

module.exports = { startPlanMidWeekWorker, stopPlanMidWeekWorker };
