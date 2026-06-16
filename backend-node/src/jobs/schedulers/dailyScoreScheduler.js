/**
 * Hourly tick — compute yesterday's fitness score for athletes in local 02:00–03:59 window.
 */
const { logger } = require('../../lib/logger');
const { runDailyScoreBatch } = require('../../lib/gamification/dailyScoreBatch');

let intervalHandle = null;
let lastBatchKey = null;

function isDailyScoreSchedulerEnabled() {
  const flag = (process.env.FEATURE_GAMIFICATION_DAILY_CRON || '').toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  return process.env.NODE_ENV === 'production' || flag === 'true' || flag === '1' || flag === 'yes';
}

async function tickDailyScoreScheduler() {
  const now = new Date();
  const batchKey = `${now.toISOString().slice(0, 13)}`;
  if (lastBatchKey === batchKey) return;
  lastBatchKey = batchKey;

  const result = await runDailyScoreBatch({ dryRun: false, now });
  if (result.processed > 0) {
    logger.info(result, 'daily fitness score scheduler tick');
  }
}

function startDailyScoreScheduler() {
  if (!isDailyScoreSchedulerEnabled()) {
    logger.info('Daily fitness score scheduler disabled (FEATURE_GAMIFICATION_DAILY_CRON)');
    return null;
  }
  if (intervalHandle) return intervalHandle;

  const intervalMs = Math.max(
    15 * 60 * 1000,
    Number(process.env.GAMIFICATION_DAILY_CRON_INTERVAL_MS || 3600000)
  );

  intervalHandle = setInterval(() => {
    void tickDailyScoreScheduler().catch((err) => {
      logger.error({ err: err.message }, 'daily fitness score scheduler tick failed');
    });
  }, intervalMs);

  void tickDailyScoreScheduler().catch((err) => {
    logger.error({ err: err.message }, 'daily fitness score scheduler initial tick failed');
  });

  logger.info({ intervalMs }, 'Daily fitness score scheduler started');
  return intervalHandle;
}

function stopDailyScoreScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startDailyScoreScheduler,
  stopDailyScoreScheduler,
  tickDailyScoreScheduler,
  isDailyScoreSchedulerEnabled,
};
