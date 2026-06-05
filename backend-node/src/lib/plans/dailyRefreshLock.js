/**
 * Redis lock — daily plan refresh per user (lock:daily:{userId}).
 */
const { redisKey } = require('../redis');
const { getBullConnection, isBullMqConfigured } = require('../redisBull');
const { logger } = require('../logger');

const LOCK_PREFIX = 'lock:daily:';
const DEFAULT_TTL_SEC = Number(process.env.PLAN_DAILY_LOCK_TTL_SEC || 600);

function dailyLockKey(userId) {
  return redisKey(`${LOCK_PREFIX}${userId}`);
}

async function acquireDailyRefreshLock(userId, ttlSec = DEFAULT_TTL_SEC) {
  if (!isBullMqConfigured()) return { acquired: true, reason: 'no_redis_lock' };
  const redis = getBullConnection();
  const result = await redis.set(dailyLockKey(userId), String(Date.now()), 'EX', ttlSec, 'NX');
  if (result === 'OK') return { acquired: true };
  return { acquired: false, reason: 'locked' };
}

async function releaseDailyRefreshLock(userId) {
  if (!isBullMqConfigured()) return;
  try {
    await getBullConnection().del(dailyLockKey(userId));
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'releaseDailyRefreshLock failed');
  }
}

module.exports = { acquireDailyRefreshLock, releaseDailyRefreshLock, dailyLockKey };
