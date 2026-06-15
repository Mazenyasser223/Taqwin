/**
 * Block A1+ — Postgres / Redis / Mongo / pgvector / production feature probes.
 */
const { prisma } = require('../db');
const { getRedisStatus, pingRedis, connectRedis, isRedisEnabled } = require('./redis');
const {
  isMongoConfigured,
  isMongoReady,
  connectMongo,
  mongoose,
} = require('../db/mongo/client');
const { isBullMqConfigured, isPlanQueueFeatureEnabled } = require('./redisBull');
const { isFastApiBridgeEnabled } = require('../services/aiFastApiClient');
const { isEmbeddingsConfigured } = require('../services/embeddingsProvider');
const { preferPgvector, isMongoVectorSearchEnabled } = require('./rag/ragConfig');

async function checkPostgres() {
  if (process.env.NODE_ENV === 'test') {
    return { status: 'connected' };
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'connected' };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

async function checkPgvector() {
  if (process.env.NODE_ENV === 'test') {
    return { status: 'skipped' };
  }
  try {
    const ext = await prisma.$queryRaw`
      SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'
    `;
    if (!ext.length) {
      return { status: 'missing', hint: 'Enable vector extension in Supabase → Database → Extensions' };
    }
    const counts = await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM knowledge_chunks) AS chunks,
        (SELECT COUNT(*)::int FROM knowledge_chunks WHERE embedding IS NOT NULL) AS embedded
    `;
    const { chunks, embedded } = counts[0] || { chunks: 0, embedded: 0 };
    return {
      status: 'enabled',
      version: ext[0].extversion,
      chunks,
      embedded,
      ready: embedded > 0,
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

async function checkRedis() {
  if (process.env.NODE_ENV === 'test') {
    return { configured: false, status: 'not_configured' };
  }
  if (!isRedisEnabled()) {
    return getRedisStatus();
  }
  if (getRedisStatus().status !== 'connected') {
    await connectRedis();
  }
  const base = getRedisStatus();
  if (base.status === 'connected') {
    const pong = await pingRedis();
    if (!pong) return { ...base, status: 'error', error: 'PING failed' };
  }
  return base;
}

async function checkMongo() {
  if (process.env.NODE_ENV === 'test') {
    return { configured: false, status: 'not_configured' };
  }
  if (!isMongoConfigured()) {
    return { configured: false, status: 'not_configured' };
  }
  if (!isMongoReady()) {
    try {
      await connectMongo();
    } catch (err) {
      return { configured: true, status: 'error', error: err.message };
    }
  }
  if (isMongoReady()) {
    return {
      configured: true,
      status: 'connected',
      host: mongoose.connection.host,
      db: mongoose.connection.name,
    };
  }
  return { configured: true, status: 'error', error: 'not connected' };
}

function getProductionFeatures() {
  let pendingOrderExpiryScheduler = false;
  try {
    const {
      isPendingOrderExpirySchedulerRunning,
    } = require('../jobs/schedulers/pendingOrderExpiryScheduler');
    pendingOrderExpiryScheduler = isPendingOrderExpirySchedulerRunning();
  } catch {
    /* optional */
  }

  let shopShipping = null;
  try {
    const { getShippingRules } = require('./shopShipping');
    shopShipping = getShippingRules();
  } catch {
    /* optional */
  }

  let sentry = false;
  try {
    const { isSentryReady } = require('./sentry');
    sentry = isSentryReady();
  } catch {
    sentry = false;
  }
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    planQueue: isPlanQueueFeatureEnabled(),
    bullMqTcp: isBullMqConfigured(),
    fastApiBridge: isFastApiBridgeEnabled(),
    embeddings: isEmbeddingsConfigured(),
    ragPgvectorPreferred: preferPgvector(),
    mongoVectorSearch: isMongoVectorSearchEnabled(),
    sentry,
    sentryConfigured: Boolean(process.env.SENTRY_DSN?.trim()),
    workerMode: process.env.WORKER_MODE === '1',
    pendingOrderExpiryScheduler,
    shopShipping,
  };
}

/**
 * @returns {Promise<{ postgres: object, redis: object, mongo: object, pgvector: object, features: object, ok: boolean }>}
 */
async function getInfraHealth() {
  const [postgres, redis, mongo, pgvector] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkMongo(),
    checkPgvector(),
  ]);
  const features = getProductionFeatures();
  let websocket = { enabled: false, onlineUsers: 0, connections: 0 };
  try {
    const { isRealtimeEnabled } = require('../realtime/wsHub');
    const { getWebSocketStats } = require('../realtime/registry');
    if (isRealtimeEnabled()) websocket = getWebSocketStats();
  } catch {
    /* optional */
  }

  const redisOk =
    redis.status === 'connected' ||
    redis.status === 'not_configured';
  const ok =
    postgres.status === 'connected' &&
    redisOk &&
    (mongo.status === 'connected' || mongo.status === 'not_configured');

  return { postgres, redis, mongo, pgvector, features, websocket, ok };
}

module.exports = {
  getInfraHealth,
  checkPostgres,
  checkRedis,
  checkMongo,
  checkPgvector,
  getProductionFeatures,
};
