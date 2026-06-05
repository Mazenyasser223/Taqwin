/**
 * Taqwin background worker — BullMQ consumers (Block C3 + C10 + C11).
 * Run: npm run worker   or   WORKER_MODE=1 node src/worker.js
 */
require('dotenv').config({ override: true });

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
  startDailyRefreshScheduler,
  stopDailyRefreshScheduler,
} = require('./jobs/schedulers/dailyRefreshScheduler');
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
  startWeeklyAdaptScheduler();
  startDailyRefreshScheduler();
  logger.info('Taqwin worker ready (generate + adapt-weekly + daily-refresh)');
}

async function shutdown(signal) {
  logger.info({ signal }, 'Worker shutting down');
  try {
    stopDailyRefreshScheduler();
    stopWeeklyAdaptScheduler();
    await stopPlanDailyRefreshWorker();
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
