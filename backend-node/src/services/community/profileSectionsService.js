const { redisGetJson, redisSetJson } = require('../../lib/redis');
const { prisma } = require('../../db');
const { audienceAllows, getOrCreatePrivacySettings } = require('../../lib/communityPrivacy');
const { FEED_POST_INCLUDE, FEED_AUTHOR_SELECT } = require('./constants');
const { enrichPosts } = require('./postsService');
const { mapAuthorIdentity } = require('../../lib/communityAuthors');
const { getProfileCacheGeneration } = require('./cacheGeneration');

const SECTION_CACHE_TTL_MS = 15_000;
const SECTION_POST_LIMIT = 25;

async function getUserRepostsPosts(viewerId, ownerId) {
  const settings = await getOrCreatePrivacySettings(ownerId);
  const allowed = await audienceAllows(viewerId, ownerId, settings.repostsAudience);
  if (!allowed) return { forbidden: true };

  const gen = await getProfileCacheGeneration();
  const cacheKey = `community:profile:reposts:v1:${gen}:${viewerId}:${ownerId}`;
  const hit = await redisGetJson(cacheKey);
  if (hit) return { data: hit };

  const reposts = await prisma.communityPostRepost.findMany({
    where: { userId: ownerId },
    include: { post: { include: FEED_POST_INCLUDE } },
    orderBy: { createdAt: 'desc' },
    take: SECTION_POST_LIMIT,
  });
  const raw = reposts.map((r) => r.post).filter(Boolean);
  const data = raw.length ? await enrichPosts(raw, viewerId) : [];
  await redisSetJson(cacheKey, data, SECTION_CACHE_TTL_MS);
  return { data };
}

async function getUserSavedPosts(viewerId, ownerId) {
  const settings = await getOrCreatePrivacySettings(ownerId);
  const allowed = await audienceAllows(viewerId, ownerId, settings.savedPostsAudience);
  if (!allowed) return { forbidden: true };

  const gen = await getProfileCacheGeneration();
  const cacheKey = `community:profile:saved:v1:${gen}:${viewerId}:${ownerId}`;
  const hit = await redisGetJson(cacheKey);
  if (hit) return { data: hit };

  const saves = await prisma.communitySavedPost.findMany({
    where: { userId: ownerId },
    include: { post: { include: FEED_POST_INCLUDE } },
    orderBy: { createdAt: 'desc' },
    take: SECTION_POST_LIMIT,
  });
  const raw = saves.map((s) => s.post).filter(Boolean);
  const data = raw.length ? await enrichPosts(raw, viewerId) : [];
  await redisSetJson(cacheKey, data, SECTION_CACHE_TTL_MS);
  return { data };
}

async function getMutualUsers(viewerId, userId) {
  const gen = await getProfileCacheGeneration();
  const cacheKey = `community:profile:mutual:v1:${gen}:${viewerId}:${userId}`;
  const hit = await redisGetJson(cacheKey);
  if (hit) return hit;

  const [myFollowing, theirFollowing] = await Promise.all([
    prisma.communityFollow.findMany({
      where: { followerId: viewerId, status: 'accepted' },
      select: { followingId: true },
    }),
    prisma.communityFollow.findMany({
      where: { followerId: userId, status: 'accepted' },
      select: { followingId: true },
    }),
  ]);
  const mySet = new Set(myFollowing.map((f) => f.followingId));
  const mutualIds = theirFollowing
    .map((f) => f.followingId)
    .filter((id) => mySet.has(id) && id !== viewerId && id !== userId);
  if (!mutualIds.length) {
    await redisSetJson(cacheKey, [], SECTION_CACHE_TTL_MS);
    return [];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: mutualIds } },
    select: FEED_AUTHOR_SELECT,
    take: 50,
  });
  const data = users.map(mapAuthorIdentity);
  await redisSetJson(cacheKey, data, SECTION_CACHE_TTL_MS);
  return data;
}

module.exports = {
  getUserRepostsPosts,
  getUserSavedPosts,
  getMutualUsers,
};
