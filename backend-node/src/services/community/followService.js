const { prisma } = require('../../db');
const { redisGetJson, redisSetJson } = require('../../lib/redis');
const { mapAuthorIdentity } = require('../../lib/communityAuthors');
const { getLeagueBadgesForUsers } = require('../../lib/gamification/leagueService');
const { FEED_AUTHOR_SELECT } = require('./constants');
const { getProfileCacheGeneration } = require('./cacheGeneration');

const LIST_CACHE_TTL_MS = 15_000;

async function isUserPrivate(userId) {
  const row = await prisma.userSettings.findUnique({
    where: { userId },
    select: { publicProfile: true },
  });
  return row ? !row.publicProfile : true;
}

async function getFollowRelation(followerId, followingId) {
  return prisma.communityFollow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });
}

async function canViewUserPosts(viewerId, profileUserId) {
  if (viewerId === profileUserId) return true;
  if (!(await isUserPrivate(profileUserId))) return true;
  const rel = await getFollowRelation(viewerId, profileUserId);
  return rel?.status === 'accepted';
}

async function followStatusFor(viewerId, targetUserId) {
  const rel = await getFollowRelation(viewerId, targetUserId);
  if (!rel) return 'none';
  return rel.status === 'accepted' ? 'accepted' : 'pending';
}

async function profileFollowCounts(userId) {
  const [followersCount, followingCount] = await Promise.all([
    prisma.communityFollow.count({ where: { followingId: userId, status: 'accepted' } }),
    prisma.communityFollow.count({ where: { followerId: userId, status: 'accepted' } }),
  ]);
  return { followersCount, followingCount };
}

async function isBlockedBetween(userIdA, userIdB) {
  const row = await prisma.communityBlock.findFirst({
    where: {
      OR: [
        { blockerId: userIdA, blockedId: userIdB },
        { blockerId: userIdB, blockedId: userIdA },
      ],
    },
  });
  return Boolean(row);
}

async function isMutualFollow(userIdA, userIdB) {
  const [aToB, bToA] = await Promise.all([
    getFollowRelation(userIdA, userIdB),
    getFollowRelation(userIdB, userIdA),
  ]);
  return aToB?.status === 'accepted' && bToA?.status === 'accepted';
}

async function getBlockedUserIds(userId) {
  const rows = await prisma.communityBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set();
  for (const r of rows) {
    ids.add(r.blockerId === userId ? r.blockedId : r.blockerId);
  }
  return ids;
}

/** Batch follow status + privacy for user search (avoids N+1). */
async function batchUserSearchMeta(viewerId, userIds) {
  if (!userIds.length) return new Map();

  const [settingsRows, followFromViewer, followToViewer] = await Promise.all([
    prisma.userSettings.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, publicProfile: true },
    }),
    prisma.communityFollow.findMany({
      where: { followerId: viewerId, followingId: { in: userIds } },
      select: { followingId: true, status: true },
    }),
    prisma.communityFollow.findMany({
      where: { followerId: { in: userIds }, followingId: viewerId },
      select: { followerId: true, status: true },
    }),
  ]);

  const settingsMap = new Map(settingsRows.map((s) => [s.userId, s.publicProfile]));
  const followOutMap = new Map(followFromViewer.map((f) => [f.followingId, f.status]));
  const followInMap = new Map(followToViewer.map((f) => [f.followerId, f.status]));

  const map = new Map();
  for (const id of userIds) {
    const pub = settingsMap.get(id);
    const isPrivate = pub === undefined ? true : !pub;
    const status = followOutMap.get(id);
    const followStatus = !status ? 'none' : status === 'accepted' ? 'accepted' : 'pending';
    map.set(id, { isPrivate, followStatus, followsViewer: followInMap.get(id) === 'accepted' });
  }
  return map;
}

async function getFollowersList(userId, viewerId = null) {
  const gen = await getProfileCacheGeneration();
  const cacheKey = `community:followers:v2:${gen}:${viewerId ?? 'anon'}:${userId}`;
  const hit = await redisGetJson(cacheKey);
  if (hit) return hit;

  const rows = await prisma.communityFollow.findMany({
    where: { followingId: userId, status: 'accepted' },
    include: { follower: { select: FEED_AUTHOR_SELECT } },
    take: 100,
    orderBy: { createdAt: 'desc' },
  });
  const followerIds = rows.map((r) => r.follower.id);
  const leagueBadges = await getLeagueBadgesForUsers(followerIds, viewerId);
  const data = rows.map((r) =>
    mapAuthorIdentity(r.follower, { leagueBadge: leagueBadges.get(r.follower.id) }),
  );
  await redisSetJson(cacheKey, data, LIST_CACHE_TTL_MS);
  return data;
}

async function getFollowingList(userId, viewerId = null) {
  const gen = await getProfileCacheGeneration();
  const cacheKey = `community:following:v2:${gen}:${viewerId ?? 'anon'}:${userId}`;
  const hit = await redisGetJson(cacheKey);
  if (hit) return hit;

  const rows = await prisma.communityFollow.findMany({
    where: { followerId: userId, status: 'accepted' },
    include: { following: { select: FEED_AUTHOR_SELECT } },
    take: 100,
    orderBy: { createdAt: 'desc' },
  });
  const followingIds = rows.map((r) => r.following.id);
  const leagueBadges = await getLeagueBadgesForUsers(followingIds, viewerId);
  const data = rows.map((r) =>
    mapAuthorIdentity(r.following, { leagueBadge: leagueBadges.get(r.following.id) }),
  );
  await redisSetJson(cacheKey, data, LIST_CACHE_TTL_MS);
  return data;
}

module.exports = {
  isUserPrivate,
  getFollowRelation,
  canViewUserPosts,
  followStatusFor,
  profileFollowCounts,
  isBlockedBetween,
  isMutualFollow,
  getBlockedUserIds,
  batchUserSearchMeta,
  getFollowersList,
  getFollowingList,
};
