/**
 * Social compete overview — duels, squads, mutual friends.
 */
const { listMutualFriends, listMutualFriendIds } = require('./socialChallengeHelpers');
const { listDuelsForUser } = require('./duelService');
const {
  listSquadsForUser,
  listRecruitingSquadsForFriends,
} = require('./squadService');
const { CHALLENGE_TEMPLATES } = require('./challengeConfig');

const SOCIAL_CACHE_TTL_MS = Number(process.env.GAMIFICATION_SOCIAL_CACHE_TTL_MS || 120000);
const socialMemCache = new Map();

async function getSocialOverview(userId) {
  const hit = socialMemCache.get(userId);
  if (hit && Date.now() - hit.at < SOCIAL_CACHE_TTL_MS) {
    return hit.data;
  }

  const friendIds = await listMutualFriendIds(userId);

  const [friends, duels, squads, openSquads] = await Promise.all([
    listMutualFriends(userId),
    listDuelsForUser(userId),
    listSquadsForUser(userId),
    listRecruitingSquadsForFriends(userId, friendIds),
  ]);

  const data = {
    friends,
    duels,
    squads,
    openSquads,
    challengeOptions: CHALLENGE_TEMPLATES.map((t) => ({
      slug: t.slug,
      durationDays: t.durationDays,
      target: t.target,
      icon: t.icon,
    })),
  };

  socialMemCache.set(userId, { at: Date.now(), data });
  if (socialMemCache.size > 200) {
    const cutoff = Date.now() - SOCIAL_CACHE_TTL_MS;
    for (const [k, v] of socialMemCache) {
      if (v.at < cutoff) socialMemCache.delete(k);
    }
  }

  return data;
}

function invalidateSocialCache(userId) {
  if (userId) socialMemCache.delete(userId);
}

module.exports = {
  getSocialOverview,
  invalidateSocialCache,
  listMutualFriends,
};
