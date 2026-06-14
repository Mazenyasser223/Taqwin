const { redisGetJson, redisSetJson } = require('../../lib/redis');
const { prisma } = require('../../db');
const { mapAuthorIdentity } = require('../../lib/communityAuthors');
const { canViewPresence } = require('../../lib/communityPrivacy');
const { FEED_POST_INCLUDE, FEED_AUTHOR_SELECT } = require('./constants');
const { enrichPosts } = require('./postsService');
const {
  isUserPrivate,
  canViewUserPosts,
  followStatusFor,
  isBlockedBetween,
  isMutualFollow,
} = require('./followService');
const { getProfileCacheGeneration } = require('./cacheGeneration');

const PROFILE_POST_LIMIT = 15;
const SHELL_CACHE_TTL_MS = 12_000;
const MENTIONS_CACHE_TTL_MS = 12_000;

const USER_PROFILE_SELECT = {
  id: true,
  email: true,
  role: true,
  lastSeenAt: true,
  athleteProfile: {
    select: {
      displayName: true,
      communityAvatarUrl: true,
      coverUrl: true,
    },
  },
  gymProfile: {
    select: {
      displayName: true,
      communityAvatarUrl: true,
      coverUrl: true,
      bio: true,
      businessName: true,
    },
  },
};

function shellCacheKey(gen, viewerId, userId) {
  return `community:profile:shell:v2:${gen}:${viewerId}:${userId}`;
}

function mentionsCacheKey(gen, viewerId, userId) {
  return `community:profile:mentions:v2:${gen}:${viewerId}:${userId}`;
}

async function getCommunityUserProfile(viewerId, userId) {
  const gen = await getProfileCacheGeneration();
  const cacheKey = shellCacheKey(gen, viewerId, userId);
  const hit = await redisGetJson(cacheKey);
  if (hit) return { data: hit };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_PROFILE_SELECT,
  });
  if (!user) return { notFound: true };

  const isMe = userId === viewerId;

  const blockedBetween = !isMe ? await isBlockedBetween(viewerId, userId) : false;
  if (blockedBetween) return { blocked: true };

  const [
    blockedByMe,
    isPrivate,
    followStatus,
    canViewPosts,
    isMutual,
    followersCount,
    followingCount,
    gymMembership,
    incomingRequests,
    presenceAllowed,
    isRinging,
  ] = await Promise.all([
    !isMe
      ? prisma.communityBlock
          .findUnique({
            where: {
              blockerId_blockedId: { blockerId: viewerId, blockedId: userId },
            },
          })
          .then(Boolean)
      : Promise.resolve(false),
    isUserPrivate(userId),
    followStatusFor(viewerId, userId),
    canViewUserPosts(viewerId, userId),
    isMe ? Promise.resolve(false) : isMutualFollow(viewerId, userId),
    prisma.communityFollow.count({ where: { followingId: userId, status: 'accepted' } }),
    prisma.communityFollow.count({ where: { followerId: userId, status: 'accepted' } }),
    prisma.gymMembership.findFirst({
      where: { userId, isActive: true },
      include: { gym: { select: { id: true, name: true, location: true, imageUrl: true } } },
      orderBy: { joinedAt: 'desc' },
    }),
    isMe
      ? prisma.communityFollow.findMany({
          where: { followingId: userId, status: 'pending' },
          include: {
            follower: {
              select: FEED_AUTHOR_SELECT,
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : Promise.resolve([]),
    isMe ? Promise.resolve(true) : canViewPresence(viewerId, userId),
    !isMe
      ? prisma.communityPostRing
          .findUnique({
            where: {
              subscriberId_targetUserId: { subscriberId: viewerId, targetUserId: userId },
            },
          })
          .then(Boolean)
      : Promise.resolve(false),
  ]);

  const payload = {
    user: mapAuthorIdentity(user, { viewerId, presenceAllowed }),
    followersCount,
    followingCount,
    isFollowing: followStatus === 'accepted',
    followStatus,
    isPrivate,
    canViewPosts,
    isMe,
    isMutualFollow: isMutual,
    blockedByMe,
    ringing: isRinging,
    posts: [],
    mentionedPosts: [],
    gym: gymMembership?.gym ?? null,
    incomingFollowRequests: incomingRequests.map((r) => ({
      id: r.id,
      follower: mapAuthorIdentity(r.follower),
      createdAt: r.createdAt,
    })),
  };

  await redisSetJson(cacheKey, payload, SHELL_CACHE_TTL_MS);
  return { data: payload };
}

async function getProfileMentionPosts(viewerId, userId) {
  const canView = await canViewUserPosts(viewerId, userId);
  if (!canView) return [];

  const gen = await getProfileCacheGeneration();
  const cacheKey = mentionsCacheKey(gen, viewerId, userId);
  const hit = await redisGetJson(cacheKey);
  if (hit) return hit;

  const tagRows = await prisma.communityPostTag.findMany({
    where: { taggedUserId: userId },
    include: { post: { include: FEED_POST_INCLUDE } },
    orderBy: { createdAt: 'desc' },
    take: PROFILE_POST_LIMIT,
  });
  const taggedRaw = tagRows.map((t) => t.post).filter((p) => p && !p.groupId);
  const posts = taggedRaw.length ? await enrichPosts(taggedRaw, viewerId) : [];
  await redisSetJson(cacheKey, posts, MENTIONS_CACHE_TTL_MS);
  return posts;
}

module.exports = {
  getCommunityUserProfile,
  getProfileMentionPosts,
  PROFILE_POST_LIMIT,
};
