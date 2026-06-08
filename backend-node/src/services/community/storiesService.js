const { prisma } = require('../../db');
const { redisGetJson, redisSetJson } = require('../../lib/redis');
const { audienceAllowsSync, buildEnrichContext } = require('./postsService');
const { isOnlineFromLastSeen, serializeLastSeen } = require('../../lib/presence');

const STORIES_FEED_CACHE_TTL_MS = 20_000;

function storiesFeedCacheKey(viewerId) {
  return `community:stories:feed:v1:${viewerId}`;
}

async function getCachedStoriesFeed(viewerId) {
  try {
    return await redisGetJson(storiesFeedCacheKey(viewerId));
  } catch {
    return null;
  }
}

async function setCachedStoriesFeed(viewerId, data) {
  try {
    await redisSetJson(storiesFeedCacheKey(viewerId), data, STORIES_FEED_CACHE_TTL_MS);
  } catch {
    /* optional */
  }
}

/** Throttle expired-story cleanup to at most once per 5 minutes per process. */
let lastStoryCleanupAt = 0;
const STORY_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

async function maybeCleanupExpiredStories(now = new Date()) {
  if (Date.now() - lastStoryCleanupAt < STORY_CLEANUP_INTERVAL_MS) return;
  lastStoryCleanupAt = Date.now();
  await prisma.communityStory.deleteMany({ where: { expiresAt: { lte: now } } });
}

/** Batch privacy settings lookup; creates missing rows lazily only when needed. */
async function batchPrivacySettings(userIds) {
  if (!userIds.length) return new Map();
  const unique = [...new Set(userIds)];
  const rows = await prisma.communityPrivacySettings.findMany({
    where: { userId: { in: unique } },
  });
  const map = new Map(rows.map((r) => [r.userId, r]));
  return map;
}

function canViewStorySync(viewerId, authorId, settings, followCtx) {
  if (viewerId === authorId) return true;
  const audience = settings?.storyAudience || 'followers';
  return audienceAllowsSync(viewerId, authorId, audience, followCtx);
}

/** Batch presence visibility for many user IDs (2–3 queries total). */
async function batchPresenceForViewer(viewerId, userIds) {
  const unique = [...new Set(userIds.filter(Boolean))].slice(0, 100);
  if (!unique.length) return {};

  const ctx = await buildEnrichContext(viewerId, unique.map((id) => ({ id, authorId: id })));
  const rows = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, lastSeenAt: true },
  });

  const presence = {};
  for (const row of rows) {
    if (row.id === viewerId) {
      const lastSeenAt = serializeLastSeen(row.lastSeenAt);
      presence[row.id] = { lastSeenAt, isOnline: isOnlineFromLastSeen(lastSeenAt) };
      continue;
    }
    const settings = ctx.privacyByUser.get(row.id);
    const audience = settings?.presenceAudience || 'everyone';
    if (!audienceAllowsSync(viewerId, row.id, audience, ctx.followCtx)) continue;
    const lastSeenAt = serializeLastSeen(row.lastSeenAt);
    presence[row.id] = { lastSeenAt, isOnline: isOnlineFromLastSeen(lastSeenAt) };
  }
  return presence;
}

module.exports = {
  maybeCleanupExpiredStories,
  batchPrivacySettings,
  canViewStorySync,
  batchPresenceForViewer,
  getCachedStoriesFeed,
  setCachedStoriesFeed,
};
