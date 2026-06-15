/**
 * Redis cache for AI commerce recommendations (per user + locale).
 */
const { redisGetJson, redisSetJson } = require('../redis');

const TTL_SEC = Number(process.env.SHOP_AI_RECOMMENDATIONS_CACHE_TTL_SEC) || 300;

function cacheKey(userId, locale) {
  return `commerce:rec:${userId}:${locale || 'ar'}`;
}

async function getCachedRecommendations(userId, locale) {
  return redisGetJson(cacheKey(userId, locale));
}

async function setCachedRecommendations(userId, locale, bundle) {
  if (!bundle || bundle.empty) return;
  await redisSetJson(cacheKey(userId, locale), bundle, TTL_SEC);
}

async function invalidateRecommendations(userId) {
  const { redisDel } = require('../redis');
  await redisDel(cacheKey(userId, 'ar'));
  await redisDel(cacheKey(userId, 'en'));
}

module.exports = {
  getCachedRecommendations,
  setCachedRecommendations,
  invalidateRecommendations,
  TTL_SEC,
};
