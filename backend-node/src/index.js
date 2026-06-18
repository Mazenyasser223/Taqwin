/**
 * Taqwin backend — entry point.
 * Loads env, mounts app, starts HTTP server, and handles graceful shutdown.
 */
const http = require('http');
require('dotenv').config({ override: true });
const { assertProductionRagReady } = require('./lib/rag/ragConfig');
assertProductionRagReady();
const { initSentry } = require('./lib/sentry');
initSentry();
const app = require('./app');
const { logger } = require('./lib/logger');
const { prisma } = require('./db');
const { getFrontendUrl } = require('./lib/frontendUrl');
const { resolveGoogleCallbackUrl } = require('./lib/googleCallbackUrl');
const { getGoogleOAuthDiagnostics } = require('./lib/googleOAuthConfig');
const { getAllowedOrigins, isVercelCorsEnabled } = require('./lib/corsOrigins');
const { closeRedis, connectRedis } = require('./lib/redis');
const { closeBullConnection, isBullMqConfigured, isPlanQueueFeatureEnabled } = require('./lib/redisBull');
const { connectMongo, disconnectMongo, isMongoConfigured } = require('./db/mongo/client');
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
const { closeQueues } = require('./jobs/queues');
const { getInfraHealth } = require('./lib/infraHealth');
const { startFdcCacheWarm } = require('./lib/fdcCacheWarm');
const { ensureSupabaseUploadBucket } = require('./lib/supabaseStorageBucket');
const { attachWebSocketHub, shutdownWebSocketHub } = require('./realtime/wsHub');

const PORT = process.env.PORT || 4000;

/** Block A1 — connect optional Redis/Mongo before accepting traffic. */
async function bootInfra() {
  if (isMongoConfigured()) {
    try {
      await connectMongo();
    } catch (err) {
      logger.warn({ err: err.message }, 'MongoDB boot connect failed — AI features may degrade');
    }
  }

  try {
    await connectRedis();
  } catch (err) {
    logger.warn({ err: err.message }, 'Redis boot connect failed — cache/queues may degrade');
  }

  const infra = await getInfraHealth();
  logger.info(
    {
      postgres: infra.postgres.status,
      redis: infra.redis.status,
      mongo: infra.mongo.status,
      planQueue: isPlanQueueFeatureEnabled(),
      bullMqTcp: isBullMqConfigured(),
    },
    'Infrastructure ready'
  );

  const inlineWorker =
    process.env.WORKER_MODE !== '1' &&
    (process.env.FEATURE_PLAN_INLINE_WORKER || '').toLowerCase() === 'true' &&
    isBullMqConfigured() &&
    isPlanQueueFeatureEnabled();

  if (inlineWorker) {
    startPlanGenerateWorker();
    startPlanAdaptWeeklyWorker();
    startPlanDailyRefreshWorker();
    startPlanMidWeekWorker();
    const { startAiMemoryWorker } = require('./jobs/workers/aiMemoryWorker');
    startAiMemoryWorker();
    startWeeklyAdaptScheduler();
    startDailyRefreshScheduler();
    const { startMidWeekScheduler } = require('./jobs/schedulers/midWeekScheduler');
    startMidWeekScheduler();
    const { startMemorySummarizeScheduler } = require('./jobs/schedulers/memorySummarizeScheduler');
    startMemorySummarizeScheduler();
    logger.info('Inline plan workers + schedulers started (dev)');
  }

  // Smart notifications (Block D10) — queue-independent (cheap DB writes).
  if (process.env.WORKER_MODE !== '1') {
    const { startSmartNotifyScheduler } = require('./jobs/schedulers/smartNotifyScheduler');
    startSmartNotifyScheduler();
    const { startPendingOrderExpiryScheduler } = require('./jobs/schedulers/pendingOrderExpiryScheduler');
    startPendingOrderExpiryScheduler();
    const { startDailyScoreScheduler } = require('./jobs/schedulers/dailyScoreScheduler');
    startDailyScoreScheduler();
    const { startLeagueWeekScheduler } = require('./jobs/schedulers/leagueWeekScheduler');
    startLeagueWeekScheduler();
    const { startChallengeProgressScheduler } = require('./jobs/schedulers/challengeProgressScheduler');
    startChallengeProgressScheduler();
    const { startNotificationMaintenanceScheduler } = require('./jobs/schedulers/notificationMaintenanceScheduler');
    startNotificationMaintenanceScheduler();
    const { startMetricsFlush } = require('./lib/notifications/notificationMetrics');
    startMetricsFlush();
  }
}

let server;

async function start() {
  await bootInfra();

  const httpServer = http.createServer(app);
  attachWebSocketHub(httpServer);

  server = httpServer.listen(PORT, () => {
    httpServer.timeout = Number(process.env.HTTP_SERVER_TIMEOUT_MS || 300_000);
    httpServer.requestTimeout = Number(process.env.HTTP_REQUEST_TIMEOUT_MS || 300_000);
    logger.info(`Taqwin API listening on http://localhost:${PORT}`);
    logger.info(
      {
        frontendUrl: getFrontendUrl(),
        googleCallbackUrl: resolveGoogleCallbackUrl(),
        googleOAuth: getGoogleOAuthDiagnostics(),
        corsOrigins: getAllowedOrigins(),
        corsAllowVercel: isVercelCorsEnabled(),
      },
      'CORS / OAuth origins'
    );
    startFdcCacheWarm();
    void ensureSupabaseUploadBucket().then((result) => {
      if (result.updated) logger.info('Supabase upload bucket patched for video/* support');
      else if (result.created) logger.info('Supabase upload bucket created with video/* support');
      else if (result.error) logger.warn({ err: result.error }, 'Supabase upload bucket check failed');
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error({ port: PORT }, 'Port already in use — stop the other backend process and retry');
      process.exit(1);
    }
    throw err;
  });
}

void start().catch((err) => {
  logger.error({ err }, 'Server failed to start');
  process.exit(1);
});

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  try {
    await shutdownWebSocketHub();
  } catch (err) {
    logger.warn({ err }, 'WebSocket hub shutdown failed');
  }
  if (server) server.close(() => logger.info('HTTP server closed'));
  try {
    await prisma.$disconnect();
  } catch (err) {
    logger.warn({ err }, 'Prisma disconnect failed');
  }
  try {
    const { stopSmartNotifyScheduler } = require('./jobs/schedulers/smartNotifyScheduler');
    stopSmartNotifyScheduler();
    const { stopPendingOrderExpiryScheduler } = require('./jobs/schedulers/pendingOrderExpiryScheduler');
    stopPendingOrderExpiryScheduler();
    const { stopDailyScoreScheduler } = require('./jobs/schedulers/dailyScoreScheduler');
    stopDailyScoreScheduler();
    const { stopLeagueWeekScheduler } = require('./jobs/schedulers/leagueWeekScheduler');
    stopLeagueWeekScheduler();
    const { stopChallengeProgressScheduler } = require('./jobs/schedulers/challengeProgressScheduler');
    stopChallengeProgressScheduler();
    await stopPlanGenerateWorker();
    stopDailyRefreshScheduler();
    stopWeeklyAdaptScheduler();
    await stopPlanDailyRefreshWorker();
    await stopPlanMidWeekWorker();
    await stopPlanAdaptWeeklyWorker();
    await closeQueues();
    await closeBullConnection();
  } catch (err) {
    logger.warn({ err }, 'BullMQ shutdown failed');
  }
  try {
    await closeRedis();
  } catch (err) {
    logger.warn({ err }, 'Redis disconnect failed');
  }
  try {
    await disconnectMongo();
  } catch (err) {
    logger.warn({ err }, 'Mongo disconnect failed');
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled rejection'));
process.on('uncaughtException', (err) => logger.error({ err }, 'Uncaught exception'));
