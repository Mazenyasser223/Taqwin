/**
 * Redis lock — weekly adaptation per user (architecture: lock:weekly:{userId}).
 */
const { redisKey } = require('../redis');
const { getBullConnection, isBullMqConfigured } = require('../redisBull');
const { logger } = require('../logger');

const LOCK_PREFIX = 'lock:weekly:';
const DEFAULT_TTL_SEC = Number(process.env.PLAN_WEEKLY_LOCK_TTL_SEC || 3600);

function weeklyLockKey(userId) {
  return redisKey(`${LOCK_PREFIX}${userId}`);
}

async function acquireWeeklyAdaptLock(userId, ttlSec = DEFAULT_TTL_SEC) {
  if (!isBullMqConfigured()) return { acquired: true, reason: 'no_redis_lock' };
  const redis = getBullConnection();
  const result = await redis.set(weeklyLockKey(userId), String(Date.now()), 'EX', ttlSec, 'NX');
  if (result === 'OK') return { acquired: true };
  return { acquired: false, reason: 'locked' };
}

async function releaseWeeklyAdaptLock(userId) {
  if (!isBullMqConfigured()) return;
  try {
    await getBullConnection().del(weeklyLockKey(userId));
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'releaseWeeklyAdaptLock failed');
  }
}

module.exports = { acquireWeeklyAdaptLock, releaseWeeklyAdaptLock, weeklyLockKey };
