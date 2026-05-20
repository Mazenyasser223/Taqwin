/**
 * FDC cache: L1 in-memory + optional L2 Redis (REDIS_URL).
 * In-flight deduplication is process-local.
 */
const { redisGetJson, redisSetJson } = require('./redis');

const DEFAULT_TTL_MS = Number(process.env.FDC_PAGE_CACHE_TTL_MS) || 10 * 60 * 1000;
const MAX_ENTRIES = Number(process.env.FDC_MEMORY_CACHE_MAX) || 400;

const store = new Map();
const inflight = new Map();

function getMemory(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function setMemory(key, value, ttlMs = DEFAULT_TTL_MS) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function get(key) {
  const mem = getMemory(key);
  if (mem != null) return mem;
  const remote = await redisGetJson(`fdc:${key}`);
  if (remote != null) {
    setMemory(key, remote, DEFAULT_TTL_MS);
  }
  return remote;
}

async function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  setMemory(key, value, ttlMs);
  redisSetJson(`fdc:${key}`, value, ttlMs).catch(() => {});
}

/**
 * Cache async factory; deduplicates concurrent identical requests.
 */
async function getOrFetch(key, factory, ttlMs = DEFAULT_TTL_MS) {
  const hit = await get(key);
  if (hit != null) return hit;

  if (inflight.has(key)) return inflight.get(key);

  const promise = Promise.resolve()
    .then(factory)
    .then(async (value) => {
      await set(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

module.exports = { get, set, getOrFetch, DEFAULT_TTL_MS };
