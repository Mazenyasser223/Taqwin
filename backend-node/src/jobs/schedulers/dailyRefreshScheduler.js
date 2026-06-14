/**
 * Block C11 — hourly scheduler enqueues daily refresh at 00:00–01:59 user local time.
 */
const { logger } = require('../../lib/logger');
const { isPlanQueueEnabled } = require('../../lib/redisBull');
const { runDailyRefreshBatch } = require('../../lib/plans/dailyRefreshBatch');

let intervalHandle = null;
let lastTickKey = null;

function isDailySchedulerEnabled() {
  const flag = (process.env.FEATURE_PLAN_DAILY_CRON || '').toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

async function tickDailyRefreshScheduler() {
  if (!isPlanQueueEnabled()) return;

  const now = new Date();
  const tickKey = `${now.toISOString().slice(0, 13)}`;
  if (lastTickKey === tickKey) return;
  lastTickKey = tickKey;

  const result = await runDailyRefreshBatch({
    respectTimezoneWindow: true,
    dryRun: false,
    days: Number(process.env.PLAN_DAILY_REFRESH_DAYS || 7),
  });

  if (result.enqueued > 0) {
    logger.info(result, 'daily refresh scheduler tick');
  }
}

function startDailyRefreshScheduler() {
  if (!isDailySchedulerEnabled()) {
    logger.info('Daily refresh scheduler disabled (FEATURE_PLAN_DAILY_CRON)');
    return null;
  }
  if (intervalHandle) return intervalHandle;

  const intervalMs = Math.max(
    15 * 60 * 1000,
    Number(process.env.PLAN_DAILY_CRON_INTERVAL_MS || 3600000)
  );

  intervalHandle = setInterval(() => {
    void tickDailyRefreshScheduler().catch((err) => {
      logger.error({ err: err.message }, 'daily refresh scheduler tick failed');
    });
  }, intervalMs);

  void tickDailyRefreshScheduler().catch((err) => {
    logger.error({ err: err.message }, 'daily refresh scheduler initial tick failed');
  });

  logger.info({ intervalMs }, 'Daily refresh scheduler started');
  return intervalHandle;
}

function stopDailyRefreshScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startDailyRefreshScheduler,
  stopDailyRefreshScheduler,
  tickDailyRefreshScheduler,
  isDailySchedulerEnabled,
};
