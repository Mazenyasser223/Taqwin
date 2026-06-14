const { redisGetJson, redisSetJson } = require('../../lib/redis');
const { prisma } = require('../../db');
const { mapAuthorIdentity } = require('../../lib/communityAuthors');
const { FEED_AUTHOR_SELECT } = require('./constants');
const { getBlockedUserIds, batchUserSearchMeta } = require('./followService');

const USER_LIST_SELECT = FEED_AUTHOR_SELECT;
const SEARCH_CACHE_TTL_MS = 30_000;
const DISCOVER_CACHE_TTL_MS = 60_000;

function mapSearchRow(user, meta) {
  const m = meta.get(user.id) ?? { isPrivate: true, followStatus: 'none', followsViewer: false };
  return {
    ...mapAuthorIdentity(user),
    isPrivate: m.isPrivate,
    followStatus: m.followStatus,
    followsViewer: m.followsViewer,
  };
}

async function searchCommunityUsers(viewerId, rawQuery) {
  const q = rawQuery.trim();
  if (!q.length) return [];

  const cacheKey = `community:browse:search:v3:${viewerId}:${q.toLowerCase()}`;
  const hit = await redisGetJson(cacheKey);
  if (hit) return hit;

  const blockedIds = [...(await getBlockedUserIds(viewerId))];
  const users = await prisma.user.findMany({
    where: {
      id: { not: viewerId, ...(blockedIds.length ? { notIn: blockedIds } : {}) },
      OR: [
        { email: { startsWith: q, mode: 'insensitive' } },
        { athleteProfile: { is: { displayName: { startsWith: q, mode: 'insensitive' } } } },
        { gymProfile: { is: { displayName: { startsWith: q, mode: 'insensitive' } } } },
        { gymProfile: { is: { businessName: { startsWith: q, mode: 'insensitive' } } } },
      ],
    },
    select: USER_LIST_SELECT,
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  const meta = await batchUserSearchMeta(
    viewerId,
    users.map((u) => u.id),
  );
  const results = users.map((u) => mapSearchRow(u, meta));
  await redisSetJson(cacheKey, results, SEARCH_CACHE_TTL_MS);
  return results;
}

/** Suggested public profiles — shown before the user types a query. */
async function discoverCommunityUsers(viewerId) {
  const cacheKey = `community:browse:discover:v2:${viewerId}`;
  const hit = await redisGetJson(cacheKey);
  if (hit) return hit;

  const blockedIds = [...(await getBlockedUserIds(viewerId))];
  const users = await prisma.user.findMany({
    where: {
      id: { not: viewerId, ...(blockedIds.length ? { notIn: blockedIds } : {}) },
      settings: { is: { publicProfile: true } },
      role: { in: ['athlete', 'trainer', 'gym'] },
    },
    select: USER_LIST_SELECT,
    take: 24,
    orderBy: { createdAt: 'desc' },
  });

  const meta = await batchUserSearchMeta(
    viewerId,
    users.map((u) => u.id),
  );
  const results = users.map((u) => mapSearchRow(u, meta));
  await redisSetJson(cacheKey, results, DISCOVER_CACHE_TTL_MS);
  return results;
}

module.exports = {
  searchCommunityUsers,
  discoverCommunityUsers,
};
