/** Short-lived cache for GET /api/dashboard/gym */
const { redisGetJson, redisSetJson } = require('./redis');

const DEFAULT_TTL_MS = 60 * 1000;
const MEM_TTL_MS = Number(process.env.GYM_DASHBOARD_MEM_CACHE_TTL_MS || 90_000);
const memCache = new Map();

function cacheKey(gymId, range) {
  return `gym:dashboard:${gymId}:${range}`;
}

function getCacheTtlMs() {
  const n = Number(process.env.GYM_DASHBOARD_CACHE_TTL_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_MS;
}

async function getCachedGymDashboard(gymId, range) {
  const key = cacheKey(gymId, range);
  const memHit = memCache.get(key);
  if (memHit && Date.now() - memHit.at < MEM_TTL_MS) {
    return memHit.data;
  }
  const redisHit = await redisGetJson(key);
  if (redisHit) {
    memCache.set(key, { data: redisHit, at: Date.now() });
    return redisHit;
  }
  return null;
}

async function setCachedGymDashboard(gymId, range, payload) {
  const key = cacheKey(gymId, range);
  memCache.set(key, { data: payload, at: Date.now() });
  return redisSetJson(key, payload, getCacheTtlMs());
}

module.exports = {
  getCachedGymDashboard,
  setCachedGymDashboard,
};
