/**
 * Taqwin background worker — BullMQ consumers (Block C3 + C10 + C11).
 * Run: npm run worker   or   WORKER_MODE=1 node src/worker.js
 */
require('dotenv').config({ override: true });
const { assertProductionRagReady } = require('./lib/rag/ragConfig');
assertProductionRagReady();
const { initSentry } = require('./lib/sentry');
initSentry();

const { logger } = require('./lib/logger');
const { prisma } = require('./db');
const { connectMongo, disconnectMongo, isMongoConfigured } = require('./db/mongo/client');
const { connectRedis } = require('./lib/redis');
const { closeBullConnection, isBullMqConfigured } = require('./lib/redisBull');
const { startPlanGenerateWorker, stopPlanGenerateWorker } = require('./jobs/workers/planGenerateWorker');
const {
  startPlanAdaptWeeklyWorker,
  stopPlanAdaptWeeklyWorker,
} = require('./jobs/workers/planAdaptWeeklyWorker');
const {
  startWeeklyAdaptScheduler,
  stopWeeklyAdaptScheduler,
} = require('./jobs/schedulers/weeklyAdaptScheduler');
const {
  startPlanDailyRefreshWorker,
  stopPlanDailyRefreshWorker,
} = require('./jobs/workers/planDailyRefreshWorker');
const {
  startPlanMidWeekWorker,
  stopPlanMidWeekWorker,
} = require('./jobs/workers/planMidWeekWorker');
const {
  startDailyRefreshScheduler,
  stopDailyRefreshScheduler,
} = require('./jobs/schedulers/dailyRefreshScheduler');
const {
  startMidWeekScheduler,
  stopMidWeekScheduler,
} = require('./jobs/schedulers/midWeekScheduler');
const {
  startAiMemoryWorker,
  stopAiMemoryWorker,
} = require('./jobs/workers/aiMemoryWorker');
const {
  startMemorySummarizeScheduler,
  stopMemorySummarizeScheduler,
} = require('./jobs/schedulers/memorySummarizeScheduler');
const {
  startSmartNotifyScheduler,
  stopSmartNotifyScheduler,
} = require('./jobs/schedulers/smartNotifyScheduler');
const { closeQueues } = require('./jobs/queues');

async function bootWorkerInfra() {
  if (isMongoConfigured()) {
    try {
      await connectMongo();
    } catch (err) {
      logger.warn({ err: err.message }, 'MongoDB worker connect failed — plan audit logs may skip');
    }
  }

  try {
    await connectRedis();
  } catch (err) {
    logger.warn({ err: err.message }, 'Redis cache connect failed in worker');
  }

  if (!isBullMqConfigured()) {
    throw new Error('REDIS_URL (TCP) is required for the worker. Set FEATURE_PLAN_QUEUE=true on API too.');
  }
}

async function main() {
  await bootWorkerInfra();
  startPlanGenerateWorker();
  startPlanAdaptWeeklyWorker();
  startPlanDailyRefreshWorker();
  startPlanMidWeekWorker();
  startAiMemoryWorker();
  startWeeklyAdaptScheduler();
  startDailyRefreshScheduler();
  startMidWeekScheduler();
  startMemorySummarizeScheduler();
  startSmartNotifyScheduler();
  logger.info('Taqwin worker ready (generate + adapt + refresh + mid-week + ai-memory + smart-notify)');
}

async function shutdown(signal) {
  logger.info({ signal }, 'Worker shutting down');
  try {
    stopDailyRefreshScheduler();
    stopMidWeekScheduler();
    stopMemorySummarizeScheduler();
    stopSmartNotifyScheduler();
    stopWeeklyAdaptScheduler();
    await stopPlanDailyRefreshWorker();
    await stopPlanMidWeekWorker();
    await stopAiMemoryWorker();
    await stopPlanAdaptWeeklyWorker();
    await stopPlanGenerateWorker();
    await closeQueues();
    await closeBullConnection();
  } catch (err) {
    logger.warn({ err: err.message }, 'Worker queue shutdown error');
  }
  try {
    await prisma.$disconnect();
  } catch (err) {
    logger.warn({ err }, 'Prisma disconnect failed');
  }
  try {
    await disconnectMongo();
  } catch (err) {
    logger.warn({ err }, 'Mongo disconnect failed');
  }
  process.exit(0);
}

void main().catch((err) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
