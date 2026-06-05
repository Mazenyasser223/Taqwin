/**
 * Block A1 — Postgres + Redis + Mongo health probes for /health and ops.
 */
const { prisma } = require('../db');
const { getRedisStatus, pingRedis, connectRedis, isRedisEnabled } = require('./redis');
const {
  isMongoConfigured,
  isMongoReady,
  connectMongo,
  mongoose,
} = require('../db/mongo/client');

async function checkPostgres() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'connected' };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

async function checkRedis() {
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

/**
 * @returns {Promise<{ postgres: object, redis: object, mongo: object, ok: boolean }>}
 */
async function getInfraHealth() {
  const [postgres, redis, mongo] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkMongo(),
  ]);

  const redisOk =
    redis.status === 'connected' ||
    redis.status === 'not_configured';
  const ok =
    postgres.status === 'connected' &&
    redisOk &&
    (mongo.status === 'connected' || mongo.status === 'not_configured');

  return { postgres, redis, mongo, ok };
}

module.exports = { getInfraHealth, checkPostgres, checkRedis, checkMongo };
