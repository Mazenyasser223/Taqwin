/**
 * Redis cache for league pod weekly stats (reduces repeated DB work on leaderboards).
 */
const { redisGetJson, redisSetJson, redisDel } = require('../redis');
const { TIERS } = require('./leagueConfig');

const DEFAULT_TTL_MS = Number(process.env.GAMIFICATION_LB_CACHE_TTL_MS || 3600000);

function statsCacheKey(weekStart, tier) {
  return `gamification:lb:stats:${weekStart}:${tier}`;
}

async function getCachedPodStats(weekStart, tier) {
  const cached = await redisGetJson(statsCacheKey(weekStart, tier));
  if (!cached || cached.weekStart !== weekStart || !cached.stats) return null;
  return cached.stats;
}

async function setCachedPodStats(weekStart, tier, statsMap, ttlMs = DEFAULT_TTL_MS) {
  const stats = statsMap instanceof Map ? Object.fromEntries(statsMap) : statsMap;
  await redisSetJson(statsCacheKey(weekStart, tier), { weekStart, stats }, ttlMs);
}

async function invalidateWeekLeaderboardCache(weekStart) {
  await Promise.all(TIERS.map((tier) => redisDel(statsCacheKey(weekStart, tier))));
}

module.exports = {
  getCachedPodStats,
  setCachedPodStats,
  invalidateWeekLeaderboardCache,
  statsCacheKey,
};
