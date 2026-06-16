/**
 * Hourly tick — close league seasons whose week has ended (UTC weekEnd date).
 */
const { logger } = require('../../lib/logger');
const { runLeagueWeekCloseBatch } = require('../../lib/gamification/leagueService');

let intervalHandle = null;
let lastBatchKey = null;

function isLeagueWeekSchedulerEnabled() {
  const flag = (process.env.FEATURE_GAMIFICATION_LEAGUE_CRON || '').toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  return process.env.NODE_ENV === 'production' || flag === 'true' || flag === '1' || flag === 'yes';
}

async function tickLeagueWeekScheduler() {
  const now = new Date();
  const batchKey = `${now.toISOString().slice(0, 13)}`;
  if (lastBatchKey === batchKey) return;
  lastBatchKey = batchKey;

  const result = await runLeagueWeekCloseBatch({ dryRun: false, now });
  if (result.closed > 0) {
    logger.info(result, 'league week close scheduler tick');
  }
}

function startLeagueWeekScheduler() {
  if (!isLeagueWeekSchedulerEnabled()) {
    logger.info('League week scheduler disabled (FEATURE_GAMIFICATION_LEAGUE_CRON)');
    return null;
  }
  if (intervalHandle) return intervalHandle;

  const intervalMs = Math.max(
    15 * 60 * 1000,
    Number(process.env.GAMIFICATION_LEAGUE_CRON_INTERVAL_MS || 3600000)
  );

  intervalHandle = setInterval(() => {
    void tickLeagueWeekScheduler().catch((err) => {
      logger.error({ err: err.message }, 'league week scheduler tick failed');
    });
  }, intervalMs);

  void tickLeagueWeekScheduler().catch((err) => {
    logger.error({ err: err.message }, 'league week scheduler initial tick failed');
  });

  logger.info({ intervalMs }, 'League week scheduler started');
  return intervalHandle;
}

function stopLeagueWeekScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startLeagueWeekScheduler,
  stopLeagueWeekScheduler,
  tickLeagueWeekScheduler,
  isLeagueWeekSchedulerEnabled,
};
