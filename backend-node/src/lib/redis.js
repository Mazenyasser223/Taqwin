/**
 * Optional Redis client (FDC cache, future BullMQ).
 *
 * Supports:
 *   - TCP: REDIS_URL + ioredis (local Docker or Upstash TCP tab)
 *   - REST: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (@upstash/redis)
 *
 * When neither is set, all helpers no-op safely.
 */
const { logger } = require('./logger');

const KEY_PREFIX = 'taqwin:';

let client = null;
let provider = null; // 'tcp' | 'upstash-rest'
let ready = false;
let disabled = false;

function isUpstashRestConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function resolveProvider() {
  if (disabled) return null;
  if (isUpstashRestConfigured()) return 'upstash-rest';
  if (process.env.REDIS_URL?.trim()) return 'tcp';
  return null;
}

function isRedisEnabled() {
  return Boolean(resolveProvider());
}

function isRedisReady() {
  return ready && Boolean(client);
}

/** Block A1 — status for /health (no network I/O). */
function getRedisStatus() {
  const p = resolveProvider();
  if (!p) {
    return { configured: false, status: 'not_configured' };
  }
  if (disabled) {
    return { configured: true, status: 'error', provider: p, error: 'unavailable after connect failure' };
  }
  if (isRedisReady()) {
    return { configured: true, status: 'connected', provider: p };
  }
  return { configured: true, status: 'disconnected', provider: p };
}

/** Eager connect on server boot (and lazy paths via getRedis). */
async function connectRedis() {
  return getRedis();
}

async function pingRedis() {
  const redis = await getRedis();
  if (!redis) return false;
  try {
    const pong = await redis.ping();
    return pong === 'PONG' || pong === 'PONG\r\n';
  } catch {
    return false;
  }
}

function redisKey(suffix) {
  return `${KEY_PREFIX}${suffix}`;
}

async function connectUpstashRest() {
  const { Redis } = require('@upstash/redis');
  const upstash = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL.trim(),
    token: process.env.UPSTASH_REDIS_REST_TOKEN.trim(),
  });
  const pong = await upstash.ping();
  if (pong !== 'PONG') {
    throw new Error(`Upstash ping unexpected: ${pong}`);
  }
  return upstash;
}

async function connectTcp() {
  const Redis = require('ioredis');
  const tcp = new Redis(process.env.REDIS_URL.trim(), {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
  tcp.on('error', (err) => {
    logger.warn({ err: err.message }, 'Redis error');
  });
  await tcp.connect();
  return tcp;
}

async function getRedis() {
  const p = resolveProvider();
  if (!p) return null;
  if (ready && client) return client;

  try {
    if (p === 'upstash-rest') {
      client = await connectUpstashRest();
      provider = 'upstash-rest';
    } else {
      client = await connectTcp();
      provider = 'tcp';
    }
    ready = true;
    logger.info({ provider: p }, 'Redis connected (FDC cache enabled)');
    return client;
  } catch (err) {
    disabled = true;
    client = null;
    provider = null;
    ready = false;
    logger.warn({ err: err.message, provider: p }, 'Redis unavailable — using in-memory FDC cache only');
    return null;
  }
}

async function redisGetJson(key) {
  const redis = await getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(redisKey(key));
    if (raw == null || raw === '') return null;
    if (typeof raw === 'object') return raw;
    return JSON.parse(String(raw));
  } catch (err) {
    logger.warn({ err: err.message, key }, 'Redis GET failed');
    return null;
  }
}

async function redisSetJson(key, value, ttlMs) {
  const redis = await getRedis();
  if (!redis) return false;
  try {
    const fullKey = redisKey(key);
    const payload = JSON.stringify(value);
    const px = Math.max(ttlMs, 1000);
    if (provider === 'upstash-rest') {
      await redis.set(fullKey, payload, { px });
    } else {
      await redis.set(fullKey, payload, 'PX', px);
    }
    return true;
  } catch (err) {
    logger.warn({ err: err.message, key }, 'Redis SET failed');
    return false;
  }
}

async function redisDel(key) {
  const redis = await getRedis();
  if (!redis) return false;
  try {
    await redis.del(redisKey(key));
    return true;
  } catch (err) {
    logger.warn({ err: err.message, key }, 'Redis DEL failed');
    return false;
  }
}

async function closeRedis() {
  if (!client) return;
  try {
    if (provider === 'tcp' && typeof client.quit === 'function') {
      await client.quit();
    }
  } catch {
    /* ignore */
  }
  client = null;
  provider = null;
  ready = false;
}

module.exports = {
  isRedisEnabled,
  isRedisReady,
  getRedisStatus,
  connectRedis,
  pingRedis,
  getRedis,
  redisGetJson,
  redisSetJson,
  redisDel,
  closeRedis,
  redisKey,
};
