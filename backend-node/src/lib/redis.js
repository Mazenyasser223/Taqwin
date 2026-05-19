/**
 * Optional Redis client (FDC cache, future BullMQ).
 * When REDIS_URL is unset, all helpers no-op safely.
 */
const { logger } = require('./logger');

const KEY_PREFIX = 'taqwin:';

let client = null;
let ready = false;
let disabled = false;

function isRedisEnabled() {
  return Boolean(process.env.REDIS_URL?.trim()) && !disabled;
}

function redisKey(suffix) {
  return `${KEY_PREFIX}${suffix}`;
}

async function getRedis() {
  if (!isRedisEnabled()) return null;
  if (ready && client) return client;

  try {
    const Redis = require('ioredis');
    client = new Redis(process.env.REDIS_URL.trim(), {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    client.on('error', (err) => {
      logger.warn({ err: err.message }, 'Redis error');
    });

    await client.connect();
    ready = true;
    logger.info('Redis connected (FDC cache enabled)');
    return client;
  } catch (err) {
    disabled = true;
    client = null;
    ready = false;
    logger.warn({ err: err.message }, 'Redis unavailable — using in-memory FDC cache only');
    return null;
  }
}

async function redisGetJson(key) {
  const redis = await getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(redisKey(key));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    logger.warn({ err: err.message, key }, 'Redis GET failed');
    return null;
  }
}

async function redisSetJson(key, value, ttlMs) {
  const redis = await getRedis();
  if (!redis) return false;
  try {
    await redis.set(redisKey(key), JSON.stringify(value), 'PX', Math.max(ttlMs, 1000));
    return true;
  } catch (err) {
    logger.warn({ err: err.message, key }, 'Redis SET failed');
    return false;
  }
}

async function closeRedis() {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    /* ignore */
  }
  client = null;
  ready = false;
}

module.exports = {
  isRedisEnabled,
  getRedis,
  redisGetJson,
  redisSetJson,
  closeRedis,
  redisKey,
};
