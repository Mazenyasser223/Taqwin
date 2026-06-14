/**
 * BullMQ worker — plan-daily-refresh (Block C11).
 */
const { Worker } = require('bullmq');
const { PLAN_DAILY_REFRESH_QUEUE } = require('../queues');
const { getBullConnection } = require('../../lib/redisBull');
const { logger } = require('../../lib/logger');
const { runDailyRefreshForUser } = require('../../lib/plans/runDailyRefresh');

let workerInstance = null;

function startPlanDailyRefreshWorker() {
  if (workerInstance) return workerInstance;

  const concurrency = Math.max(1, Number(process.env.PLAN_DAILY_WORKER_CONCURRENCY || 5));

  workerInstance = new Worker(
    PLAN_DAILY_REFRESH_QUEUE,
    async (job) => {
      const { userId, timezone, days, todayOnly } = job.data || {};
      if (!userId) throw new Error('plan-daily-refresh missing userId');

      return runDailyRefreshForUser(userId, {
        timezone,
        days,
        todayOnly,
      });
    },
    { connection: getBullConnection(), concurrency }
  );

  workerInstance.on('completed', (job, ret) => {
    logger.info(
      { jobId: job.id, userId: job.data?.userId, created: ret?.created, ok: ret?.ok },
      'plan-daily-refresh completed'
    );
  });

  workerInstance.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, userId: job?.data?.userId, err: err?.message }, 'plan-daily-refresh failed');
  });

  logger.info({ queue: PLAN_DAILY_REFRESH_QUEUE, concurrency }, 'plan-daily-refresh worker listening');
  return workerInstance;
}

async function stopPlanDailyRefreshWorker() {
  if (!workerInstance) return;
  await workerInstance.close();
  workerInstance = null;
}

module.exports = { startPlanDailyRefreshWorker, stopPlanDailyRefreshWorker };
