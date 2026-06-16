/**
 * BullMQ worker — plan:generate (Block C3).
 * FastAPI / local LLM → validate → Postgres (generator.js).
 */
const { Worker } = require('bullmq');
const { PLAN_GENERATE_QUEUE } = require('../queues');
const { createBullWorkerConnection } = require('../../lib/redisBull');
const { releasePlanGenerateLock } = require('../planGenerateLock');
const { generatePlanForUser } = require('../../lib/plans/generator');
const { logger } = require('../../lib/logger');

let workerInstance = null;

function startPlanGenerateWorker() {
  if (workerInstance) return workerInstance;

  const concurrency = Math.max(1, Number(process.env.PLAN_WORKER_CONCURRENCY || 2));
  const workerConnection = createBullWorkerConnection();

  workerInstance = new Worker(
    PLAN_GENERATE_QUEUE,
    async (job) => {
      const { userId, locale, regenerationReason } = job.data || {};
      if (!userId) throw new Error('plan:generate job missing userId');

      logger.info({ jobId: job.id, userId, attempt: job.attemptsMade + 1 }, 'plan:generate worker started');

      const result = await generatePlanForUser({
        userId,
        locale: locale === 'en' ? 'en' : 'ar',
        regenerationReason: regenerationReason || '',
      });

      return {
        ok: true,
        userId,
        source: result.source,
        attempts: result.attempts,
        storage: result.storage || 'postgres',
        planVersion: result.plan?.version,
        workoutPlanId: result.plan?.postgres?.workoutPlanId,
        dietPlanId: result.plan?.postgres?.dietPlanId,
      };
    },
    {
      connection: workerConnection,
      concurrency,
    }
  );

  workerInstance.on('completed', (job, returnvalue) => {
    const userId = job?.data?.userId;
    if (userId) void releasePlanGenerateLock(userId);
    logger.info(
      { jobId: job.id, userId, source: returnvalue?.source, version: returnvalue?.planVersion },
      'plan:generate job completed'
    );
  });

  workerInstance.on('failed', (job, err) => {
    const userId = job?.data?.userId;
    if (userId) void releasePlanGenerateLock(userId);
    logger.error({ jobId: job?.id, userId, err: err?.message }, 'plan:generate job failed');
  });

  logger.info({ queue: PLAN_GENERATE_QUEUE, concurrency }, 'plan:generate worker listening');
  return workerInstance;
}

async function stopPlanGenerateWorker() {
  if (!workerInstance) return;
  const conn = workerInstance.opts?.connection;
  await workerInstance.close();
  workerInstance = null;
  if (conn && typeof conn.quit === 'function') {
    try {
      await conn.quit();
    } catch {
      try {
        conn.disconnect();
      } catch {
        /* ignore */
      }
    }
  }
}

module.exports = {
  startPlanGenerateWorker,
  stopPlanGenerateWorker,
};
