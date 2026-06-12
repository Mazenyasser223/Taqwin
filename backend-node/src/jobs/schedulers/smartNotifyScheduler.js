/**
 * Block D10 — hourly tick that emits meal/workout reminders.
 *
 * Reminders are cheap DB writes (no queue/LLM), so the batch runs inline. The
 * per-user logic self-gates by local time and dedupes per slot per day.
 */
const { logger } = require('../../lib/logger');
const { runSmartNotifyBatch } = require('../../lib/adaptation/smartNotifyBatch');

let intervalHandle = null;
let lastBatchKey = null;

function isSmartNotifySchedulerEnabled() {
  const flag = (process.env.FEATURE_SMART_NOTIFY_CRON || '').toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

async function tickSmartNotifyScheduler() {
  const now = new Date();
  const batchKey = `${now.toISOString().slice(0, 13)}`;
  if (lastBatchKey === batchKey) return;
  lastBatchKey = batchKey;

  const result = await runSmartNotifyBatch({ dryRun: false, now });
  if (result.emitted > 0) {
    logger.info(result, 'smart notify scheduler tick');
  }
}

function startSmartNotifyScheduler() {
  if (!isSmartNotifySchedulerEnabled()) {
    logger.info('Smart notify scheduler disabled (FEATURE_SMART_NOTIFY_CRON)');
    return null;
  }
  if (intervalHandle) return intervalHandle;

  const intervalMs = Math.max(
    15 * 60 * 1000,
    Number(process.env.SMART_NOTIFY_CRON_INTERVAL_MS || 3600000)
  );

  intervalHandle = setInterval(() => {
    void tickSmartNotifyScheduler().catch((err) => {
      logger.error({ err: err.message }, 'smart notify scheduler tick failed');
    });
  }, intervalMs);

  void tickSmartNotifyScheduler().catch((err) => {
    logger.error({ err: err.message }, 'smart notify scheduler initial tick failed');
  });

  logger.info({ intervalMs }, 'Smart notify scheduler started');
  return intervalHandle;
}

function stopSmartNotifyScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startSmartNotifyScheduler,
  stopSmartNotifyScheduler,
  tickSmartNotifyScheduler,
  isSmartNotifySchedulerEnabled,
};
