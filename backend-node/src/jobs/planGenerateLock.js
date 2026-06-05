/**
 * Redis lock to prevent duplicate plan generation per user (Block C3).
 * Key: lock:plan:generate:{userId}
 */
const { redisKey } = require('../lib/redis');
const { getBullConnection, isBullMqConfigured } = require('../lib/redisBull');
const { logger } = require('../lib/logger');

const LOCK_PREFIX = 'lock:plan:generate:';
const DEFAULT_LOCK_TTL_SEC = Number(process.env.PLAN_GENERATE_LOCK_TTL_SEC || 900);

function lockRedisKey(userId) {
  return redisKey(`${LOCK_PREFIX}${userId}`);
}

async function acquirePlanGenerateLock(userId, ttlSec = DEFAULT_LOCK_TTL_SEC) {
  if (!isBullMqConfigured()) return { acquired: false, reason: 'redis_tcp_unavailable' };
  const redis = getBullConnection();
  const key = lockRedisKey(userId);
  const result = await redis.set(key, String(Date.now()), 'EX', ttlSec, 'NX');
  if (result === 'OK') return { acquired: true };
  return { acquired: false, reason: 'locked' };
}

async function releasePlanGenerateLock(userId) {
  if (!isBullMqConfigured()) return;
  try {
    const redis = getBullConnection();
    await redis.del(lockRedisKey(userId));
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'releasePlanGenerateLock failed');
  }
}

module.exports = {
  acquirePlanGenerateLock,
  releasePlanGenerateLock,
  lockRedisKey,
};
