/**
 * Block D1 — hourly tick enqueues Wed mid-week jobs.
 */
const { logger } = require('../../lib/logger');
const { isPlanQueueEnabled } = require('../../lib/redisBull');
const { runMidWeekBatch } = require('../../lib/adaptation/midWeekBatch');

let intervalHandle = null;
let lastBatchKey = null;

function isMidWeekSchedulerEnabled() {
  const flag = (process.env.FEATURE_PLAN_MID_WEEK_CRON || '').toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

async function tickMidWeekScheduler() {
  if (!isPlanQueueEnabled()) return;

  const now = new Date();
  const batchKey = `${now.toISOString().slice(0, 13)}`;
  if (lastBatchKey === batchKey) return;
  lastBatchKey = batchKey;

  const result = await runMidWeekBatch({
    respectTimezoneWindow: true,
    dryRun: false,
  });

  if (result.enqueued > 0) {
    logger.info(result, 'mid-week scheduler tick');
  }
}

function startMidWeekScheduler() {
  if (!isMidWeekSchedulerEnabled()) {
    logger.info('Mid-week scheduler disabled (FEATURE_PLAN_MID_WEEK_CRON)');
    return null;
  }
  if (intervalHandle) return intervalHandle;

  const intervalMs = Math.max(15 * 60 * 1000, Number(process.env.PLAN_MID_WEEK_CRON_INTERVAL_MS || 3600000));

  intervalHandle = setInterval(() => {
    void tickMidWeekScheduler().catch((err) => {
      logger.error({ err: err.message }, 'mid-week scheduler tick failed');
    });
  }, intervalMs);

  void tickMidWeekScheduler().catch((err) => {
    logger.error({ err: err.message }, 'mid-week scheduler initial tick failed');
  });

  logger.info({ intervalMs }, 'Mid-week scheduler started');
  return intervalHandle;
}

function stopMidWeekScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startMidWeekScheduler,
  stopMidWeekScheduler,
  tickMidWeekScheduler,
  isMidWeekSchedulerEnabled,
};
