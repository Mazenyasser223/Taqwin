const { redisGetJson, redisSetJson } = require('../../lib/redis');
const { prisma } = require('../../db');
const { mapAuthorIdentity } = require('../../lib/communityAuthors');
const { getLeagueBadgesForUsers } = require('../../lib/gamification/leagueService');
const { profileNamePrefixSearchFilter } = require('../../lib/profile');
const { FEED_AUTHOR_SELECT } = require('./constants');
const { getBlockedUserIds, batchUserSearchMeta } = require('./followService');
const { getBrowseCacheGeneration } = require('./cacheGeneration');

const USER_LIST_SELECT = FEED_AUTHOR_SELECT;
const SEARCH_CACHE_TTL_MS = 30_000;
const DISCOVER_CACHE_TTL_MS = 60_000;
const BROWSE_MEM_TTL_MS = 90_000;
const memBrowseCache = new Map();

function mapSearchRow(user, meta, leagueBadge) {
  const m = meta.get(user.id) ?? { isPrivate: true, followStatus: 'none', followsViewer: false };
  return {
    ...mapAuthorIdentity(user, leagueBadge ? { leagueBadge } : {}),
    isPrivate: m.isPrivate,
    followStatus: m.followStatus,
    followsViewer: m.followsViewer,
  };
}

async function readBrowseCache(key) {
  const mem = memBrowseCache.get(key);
  if (mem && Date.now() - mem.at < BROWSE_MEM_TTL_MS) return mem.data;
  const hit = await redisGetJson(key);
  if (hit) memBrowseCache.set(key, { data: hit, at: Date.now() });
  return hit;
}

async function writeBrowseCache(key, data, ttlMs) {
  memBrowseCache.set(key, { data, at: Date.now() });
  await redisSetJson(key, data, ttlMs);
}

function displayNameForUser(user) {
  return (
    user.athleteProfile?.displayName ??
    user.gymProfile?.displayName ??
    user.gymProfile?.businessName ??
    ''
  );
}

/** Prefer prefix hits on display name, then email local part, then other matches. */
function rankBrowseSearchResults(users, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return users;

  const score = (user) => {
    const name = displayNameForUser(user).trim().toLowerCase();
    const email = (user.email ?? '').toLowerCase();
    const local = email.split('@')[0] ?? '';
    if (name.startsWith(needle)) return 0;
    if (local.startsWith(needle) || email.startsWith(needle)) return 1;
    return 2;
  };

  return [...users].sort((a, b) => {
    const diff = score(a) - score(b);
    if (diff !== 0) return diff;
    return displayNameForUser(a).localeCompare(displayNameForUser(b), undefined, { sensitivity: 'base' });
  });
}

async function searchCommunityUsers(viewerId, rawQuery, { skipCache = false } = {}) {
  const q = rawQuery.trim();
  if (!q.length) return [];

  const gen = await getBrowseCacheGeneration();
  const cacheKey = `community:browse:search:v5:${gen}:${viewerId}:${q.toLowerCase()}`;
  if (!skipCache) {
    const hit = await readBrowseCache(cacheKey);
    if (hit) return hit;
  }

  const blockedIds = [...(await getBlockedUserIds(viewerId))];
  const take = q.length <= 2 ? 50 : 24;
  const users = await prisma.user.findMany({
    where: {
      id: { not: viewerId, ...(blockedIds.length ? { notIn: blockedIds } : {}) },
      OR: [
        { email: { startsWith: q, mode: 'insensitive' } },
        ...profileNamePrefixSearchFilter(q).OR,
      ],
    },
    select: USER_LIST_SELECT,
    take,
    orderBy: { createdAt: 'desc' },
  });

  const ranked = rankBrowseSearchResults(users, q);

  const meta = await batchUserSearchMeta(
    viewerId,
    ranked.map((u) => u.id),
  );
  const leagueBadges = await getLeagueBadgesForUsers(
    ranked.map((u) => u.id),
    viewerId,
  );
  const results = ranked.map((u) => mapSearchRow(u, meta, leagueBadges.get(u.id)));
  await writeBrowseCache(cacheKey, results, SEARCH_CACHE_TTL_MS);
  return results;
}

/** Suggested public profiles — shown before the user types a query. */
async function discoverCommunityUsers(viewerId, { skipCache = false } = {}) {
  const gen = await getBrowseCacheGeneration();
  const cacheKey = `community:browse:discover:v3:${gen}:${viewerId}`;
  if (!skipCache) {
    const hit = await readBrowseCache(cacheKey);
    if (hit) return hit;
  }

  const blockedIds = [...(await getBlockedUserIds(viewerId))];
  const users = await prisma.user.findMany({
    where: {
      id: { not: viewerId, ...(blockedIds.length ? { notIn: blockedIds } : {}) },
      settings: { is: { publicProfile: true } },
      role: { in: ['athlete', 'gym'] },
    },
    select: USER_LIST_SELECT,
    take: 24,
    orderBy: { createdAt: 'desc' },
  });

  const meta = await batchUserSearchMeta(
    viewerId,
    users.map((u) => u.id),
  );
  const leagueBadges = await getLeagueBadgesForUsers(
    users.map((u) => u.id),
    viewerId,
  );
  const results = users.map((u) => mapSearchRow(u, meta, leagueBadges.get(u.id)));
  await writeBrowseCache(cacheKey, results, DISCOVER_CACHE_TTL_MS);
  return results;
}

module.exports = {
  searchCommunityUsers,
  discoverCommunityUsers,
};
