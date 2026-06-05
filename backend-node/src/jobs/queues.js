/**
 * BullMQ queue registry (Block C3).
 */
const { Queue } = require('bullmq');
const { getBullConnection, isBullMqConfigured } = require('../lib/redisBull');

/** BullMQ queue (architecture doc: plan:generate — colons invalid in BullMQ names). */
const PLAN_GENERATE_QUEUE = 'plan-generate';
const PLAN_ADAPT_WEEKLY_QUEUE = 'plan-adapt-weekly';
const PLAN_DAILY_REFRESH_QUEUE = 'plan-daily-refresh';

let planGenerateQueue = null;
let planAdaptWeeklyQueue = null;
let planDailyRefreshQueue = null;

function getPlanGenerateQueue() {
  if (!isBullMqConfigured()) return null;
  if (!planGenerateQueue) {
    planGenerateQueue = new Queue(PLAN_GENERATE_QUEUE, {
      connection: getBullConnection(),
      defaultJobOptions: {
        removeOnComplete: { age: 86400, count: 200 },
        removeOnFail: { age: 604800, count: 100 },
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      },
    });
  }
  return planGenerateQueue;
}

function getPlanAdaptWeeklyQueue() {
  if (!isBullMqConfigured()) return null;
  if (!planAdaptWeeklyQueue) {
    planAdaptWeeklyQueue = new Queue(PLAN_ADAPT_WEEKLY_QUEUE, {
      connection: getBullConnection(),
      defaultJobOptions: {
        removeOnComplete: { age: 86400, count: 500 },
        removeOnFail: { age: 604800, count: 200 },
        attempts: 2,
        backoff: { type: 'exponential', delay: 8000 },
      },
    });
  }
  return planAdaptWeeklyQueue;
}

function getPlanDailyRefreshQueue() {
  if (!isBullMqConfigured()) return null;
  if (!planDailyRefreshQueue) {
    planDailyRefreshQueue = new Queue(PLAN_DAILY_REFRESH_QUEUE, {
      connection: getBullConnection(),
      defaultJobOptions: {
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 300 },
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
      },
    });
  }
  return planDailyRefreshQueue;
}

async function closeQueues() {
  if (planGenerateQueue) {
    await planGenerateQueue.close();
    planGenerateQueue = null;
  }
  if (planAdaptWeeklyQueue) {
    await planAdaptWeeklyQueue.close();
    planAdaptWeeklyQueue = null;
  }
  if (planDailyRefreshQueue) {
    await planDailyRefreshQueue.close();
    planDailyRefreshQueue = null;
  }
}

module.exports = {
  PLAN_GENERATE_QUEUE,
  PLAN_ADAPT_WEEKLY_QUEUE,
  PLAN_DAILY_REFRESH_QUEUE,
  getPlanGenerateQueue,
  getPlanAdaptWeeklyQueue,
  getPlanDailyRefreshQueue,
  closeQueues,
};
