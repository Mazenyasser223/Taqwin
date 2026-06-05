/**
 * Block C10 — in-process scheduler: hourly tick enqueues Sunday weekly jobs.
 * Production: prefer `npm run cron:weekly-adapt` via host crontab (Sun 00:00).
 */
const { logger } = require('../../lib/logger');
const { isPlanQueueEnabled } = require('../../lib/redisBull');
const { runWeeklyAdaptBatch } = require('../../lib/adaptation/weeklyAdaptBatch');

let intervalHandle = null;
let lastBatchKey = null;

function isWeeklySchedulerEnabled() {
  const flag = (process.env.FEATURE_PLAN_WEEKLY_CRON || '').toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

/**
 * Hourly: athletes in Sunday 00:00–03:59 local window get jobs + metrics snapshot.
 */
async function tickWeeklyScheduler() {
  if (!isPlanQueueEnabled()) return;

  const now = new Date();
  const batchKey = `${now.toISOString().slice(0, 13)}`;
  if (lastBatchKey === batchKey) return;
  lastBatchKey = batchKey;

  const result = await runWeeklyAdaptBatch({
    respectTimezoneWindow: true,
    dryRun: false,
    precomputeMetrics: true,
  });

  if (result.enqueued > 0 || result.metricsWritten > 0) {
    logger.info(result, 'weekly adapt scheduler tick');
  }
}

function startWeeklyAdaptScheduler() {
  if (!isWeeklySchedulerEnabled()) {
    logger.info('Weekly adapt scheduler disabled (FEATURE_PLAN_WEEKLY_CRON)');
    return null;
  }
  if (intervalHandle) return intervalHandle;

  const intervalMs = Math.max(15 * 60 * 1000, Number(process.env.PLAN_WEEKLY_CRON_INTERVAL_MS || 3600000));

  intervalHandle = setInterval(() => {
    void tickWeeklyScheduler().catch((err) => {
      logger.error({ err: err.message }, 'weekly adapt scheduler tick failed');
    });
  }, intervalMs);

  void tickWeeklyScheduler().catch((err) => {
    logger.error({ err: err.message }, 'weekly adapt scheduler initial tick failed');
  });

  logger.info({ intervalMs }, 'Weekly adapt scheduler started');
  return intervalHandle;
}

function stopWeeklyAdaptScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startWeeklyAdaptScheduler,
  stopWeeklyAdaptScheduler,
  tickWeeklyScheduler,
  isWeeklySchedulerEnabled,
};
