/**
 * Redis cache for GET /api/dashboard/athlete/home
 * In-memory L1 cache works without Redis (same speed on every dev machine).
 */
const { redisGetJson, redisSetJson, redisDel } = require('./redis');
const { dateKeyInTimezone } = require('./athleteMetrics');
const { invalidateContextBundle } = require('./contextBundle');

const DEFAULT_TTL_MS = 90 * 1000;
const MEM_CACHE_TTL_MS = Number(process.env.DASHBOARD_MEM_CACHE_TTL_MS || 120_000);
const memCache = new Map();

function dashboardHomeKey(userId, dateKey) {
  return `dashboard:home:${userId}:${dateKey}`;
}

function memCacheKey(userId, dateKey) {
  return `${userId}:${dateKey}`;
}

function getDashboardCacheTtlMs() {
  const n = Number(process.env.DASHBOARD_CACHE_TTL_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_MS;
}

async function getCachedDashboardHome(userId, dateKey) {
  const mKey = memCacheKey(userId, dateKey);
  const memHit = memCache.get(mKey);
  if (memHit && Date.now() - memHit.at < MEM_CACHE_TTL_MS) {
    return memHit.data;
  }

  const redisHit = await redisGetJson(dashboardHomeKey(userId, dateKey));
  if (redisHit) {
    memCache.set(mKey, { data: redisHit, at: Date.now() });
    return redisHit;
  }
  return null;
}

async function setCachedDashboardHome(userId, dateKey, payload) {
  memCache.set(memCacheKey(userId, dateKey), { data: payload, at: Date.now() });
  return redisSetJson(dashboardHomeKey(userId, dateKey), payload, getDashboardCacheTtlMs());
}

async function invalidateDashboardHome(userId, dateKey) {
  if (dateKey) {
    memCache.delete(memCacheKey(userId, dateKey));
    await redisDel(dashboardHomeKey(userId, dateKey));
  }
  return invalidateContextBundle(userId);
}

async function invalidateDashboardForUser(userId, timezone = 'UTC') {
  const todayKey = dateKeyInTimezone(new Date(), timezone);
  return invalidateDashboardHome(userId, todayKey);
}

module.exports = {
  dashboardHomeKey,
  getCachedDashboardHome,
  setCachedDashboardHome,
  invalidateDashboardHome,
  invalidateDashboardForUser,
};
