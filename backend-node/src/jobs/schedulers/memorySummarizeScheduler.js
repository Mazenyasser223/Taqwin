/**
 * Block E4 — hourly tick enqueues nightly memory jobs (02:00–04:59 local).
 */
const { logger } = require('../../lib/logger');
const { isPlanQueueEnabled } = require('../../lib/redisBull');
const { runMemorySummarizeBatch } = require('../../lib/ai/memorySummarizeBatch');

let intervalHandle = null;
let lastBatchKey = null;

function isMemorySchedulerEnabled() {
  const flag = (process.env.FEATURE_AI_MEMORY_CRON || '').toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  if (flag === 'true' || flag === '1' || flag === 'yes') return true;
  return process.env.NODE_ENV === 'production';
}

async function tickMemorySummarizeScheduler() {
  if (!isPlanQueueEnabled()) return;

  const now = new Date();
  const batchKey = `${now.toISOString().slice(0, 13)}`;
  if (lastBatchKey === batchKey) return;
  lastBatchKey = batchKey;

  const result = await runMemorySummarizeBatch({
    respectTimezoneWindow: true,
    dryRun: false,
  });

  if (result.enqueued > 0) {
    logger.info(result, 'memory summarize scheduler tick');
  }
}

function startMemorySummarizeScheduler() {
  if (!isMemorySchedulerEnabled()) {
    logger.info('Memory summarize scheduler disabled (FEATURE_AI_MEMORY_CRON)');
    return null;
  }
  if (intervalHandle) return intervalHandle;

  const intervalMs = Math.max(
    15 * 60 * 1000,
    Number(process.env.AI_MEMORY_CRON_INTERVAL_MS || 3600000)
  );

  intervalHandle = setInterval(() => {
    void tickMemorySummarizeScheduler().catch((err) => {
      logger.error({ err: err.message }, 'memory summarize scheduler tick failed');
    });
  }, intervalMs);

  void tickMemorySummarizeScheduler().catch((err) => {
    logger.error({ err: err.message }, 'memory summarize scheduler initial tick failed');
  });

  logger.info({ intervalMs }, 'Memory summarize scheduler started');
  return intervalHandle;
}

function stopMemorySummarizeScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startMemorySummarizeScheduler,
  stopMemorySummarizeScheduler,
  tickMemorySummarizeScheduler,
  isMemorySchedulerEnabled,
};
