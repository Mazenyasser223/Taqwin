/**
 * Nightly/hourly tick — refresh active challenge progress + close expired.
 */
const { logger } = require('../../lib/logger');
const { runChallengeProgressBatch } = require('../../lib/gamification/challengeService');

let intervalHandle = null;
let lastBatchKey = null;

function isChallengeProgressSchedulerEnabled() {
  const flag = (process.env.FEATURE_GAMIFICATION_CHALLENGE_CRON || '').toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  return process.env.NODE_ENV === 'production' || flag === 'true' || flag === '1' || flag === 'yes';
}

async function tickChallengeProgressScheduler() {
  const now = new Date();
  const batchKey = `${now.toISOString().slice(0, 13)}`;
  if (lastBatchKey === batchKey) return;
  lastBatchKey = batchKey;

  const result = await runChallengeProgressBatch({ limit: 2000 });
  if (result.refreshed > 0) {
    logger.info(result, 'challenge progress scheduler tick');
  }
}

function startChallengeProgressScheduler() {
  if (!isChallengeProgressSchedulerEnabled()) {
    logger.info('Challenge progress scheduler disabled (FEATURE_GAMIFICATION_CHALLENGE_CRON)');
    return null;
  }
  if (intervalHandle) return intervalHandle;

  const intervalMs = Math.max(
    15 * 60 * 1000,
    Number(process.env.GAMIFICATION_CHALLENGE_CRON_INTERVAL_MS || 3600000)
  );

  intervalHandle = setInterval(() => {
    void tickChallengeProgressScheduler().catch((err) => {
      logger.error({ err: err.message }, 'challenge progress scheduler tick failed');
    });
  }, intervalMs);

  void tickChallengeProgressScheduler().catch((err) => {
    logger.error({ err: err.message }, 'challenge progress scheduler initial tick failed');
  });

  logger.info({ intervalMs }, 'Challenge progress scheduler started');
  return intervalHandle;
}

function stopChallengeProgressScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startChallengeProgressScheduler,
  stopChallengeProgressScheduler,
  tickChallengeProgressScheduler,
  isChallengeProgressSchedulerEnabled,
};
