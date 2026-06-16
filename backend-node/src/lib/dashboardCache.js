/**
 * Redis cache for GET /api/dashboard/athlete/home
 */
const { redisGetJson, redisSetJson, redisDel } = require('./redis');
const { dateKeyInTimezone } = require('./athleteMetrics');
const { invalidateContextBundle } = require('./contextBundle');

const DEFAULT_TTL_MS = 90 * 1000;

function dashboardHomeKey(userId, dateKey) {
  return `dashboard:home:${userId}:${dateKey}`;
}

function getDashboardCacheTtlMs() {
  const n = Number(process.env.DASHBOARD_CACHE_TTL_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_MS;
}

async function getCachedDashboardHome(userId, dateKey) {
  return redisGetJson(dashboardHomeKey(userId, dateKey));
}

async function setCachedDashboardHome(userId, dateKey, payload) {
  return redisSetJson(dashboardHomeKey(userId, dateKey), payload, getDashboardCacheTtlMs());
}

async function invalidateDashboardHome(userId, dateKey) {
  if (dateKey) {
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
