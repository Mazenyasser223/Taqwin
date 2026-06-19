const { redisGetJson, redisSetJson, redisDel, redisGetString, redisIncr } = require('../../lib/redis');
const { prisma } = require('../../db');
const { POST_INCLUDE, FEED_POST_INCLUDE, FEED_PAGE_SIZE } = require('./constants');
const { enrichPosts } = require('./postsService');
const { sortPostsWithPins } = require('./pinService');
const { getForYouPosts } = require('./recommendationService');

const FEED_CACHE_TTL_MS = 8_000;
const FEED_MEM_TTL_MS = 12_000;
const FEED_TYPES = ['for_you', 'following', 'coaches', 'athletes', 'gyms', 'trending'];
const FEED_GEN_KEY = 'community:feed:gen';
let memoryFeedGen = 0;
/** In-memory L1 — same repeat-visit speed without Redis (dev + fallback). */
const memFeedCache = new Map();

async function getFeedCacheGeneration() {
  const fromRedis = await redisGetString(FEED_GEN_KEY);
  if (fromRedis != null) {
    memoryFeedGen = Number(fromRedis) || 0;
    return fromRedis;
  }
  return String(memoryFeedGen);
}

/** Bump generation so all viewers miss stale feed caches after likes/comments/reposts. */
async function bumpFeedCacheGeneration() {
  const n = await redisIncr(FEED_GEN_KEY);
  if (n != null) memoryFeedGen = n;
  else memoryFeedGen += 1;
}

function feedCacheKey(viewerId, feed, groupId, authorId, gen) {
  return `community:feed:v2:${gen}:${viewerId}:${feed}:${groupId ?? ''}:${authorId ?? ''}`;
}

async function readFeedCache(key) {
  const memHit = memFeedCache.get(key);
  if (memHit && Date.now() - memHit.at < FEED_MEM_TTL_MS) {
    return memHit.data;
  }
  try {
    const fromRedis = await redisGetJson(key);
    if (fromRedis) {
      memFeedCache.set(key, { data: fromRedis, at: Date.now() });
      return fromRedis;
    }
  } catch {
    /* optional */
  }
  return null;
}

async function writeFeedCache(key, data) {
  memFeedCache.set(key, { data, at: Date.now() });
  try {
    await redisSetJson(key, data, FEED_CACHE_TTL_MS);
  } catch {
    /* optional */
  }
}

/** Invalidate feed caches for a user (after posting). */
async function invalidateFeedCacheForUser(userId) {
  const gen = await getFeedCacheGeneration();
  await Promise.all(
    FEED_TYPES.map((feed) => redisDel(feedCacheKey(userId, feed, null, null, gen))),
  );
  await bumpFeedCacheGeneration();
}

async function queryFeedPosts(viewerId, { feed = 'for_you', groupId, authorId, forYouOpts = {} }) {
  if (feed === 'for_you' && !authorId && !groupId) {
    return getForYouPosts(viewerId, { take: FEED_PAGE_SIZE, ...forYouOpts });
  }

  let where = {};
  let orderBy = { createdAt: 'desc' };
  const include = groupId ? POST_INCLUDE : FEED_POST_INCLUDE;
  const take = FEED_PAGE_SIZE;
  const needsTaggedMerge = !authorId && !groupId && (feed === 'for_you' || feed === 'following');

  if (authorId) {
    where = { authorId, groupId: null };
  } else if (groupId) {
    where = { groupId };
  } else {
    where = { groupId: null };
    if (feed === 'coaches') where = { ...where, author: { role: 'gym' } };
    else if (feed === 'athletes') where = { ...where, author: { role: 'athlete' } };
    else if (feed === 'gyms') where = { ...where, author: { role: 'gym' } };
    else if (feed === 'following') {
      const follows = await prisma.communityFollow.findMany({
        where: { followerId: viewerId, status: 'accepted' },
        select: { followingId: true },
      });
      const ids = follows.map((f) => f.followingId);
      if (!ids.length) return [];
      where = { ...where, authorId: { in: ids } };
    } else if (feed === 'trending') {
      orderBy = [{ likesCount: 'desc' }, { repostsCount: 'desc' }, { createdAt: 'desc' }];
    }
  }

  const [posts, tagRows] = await Promise.all([
    prisma.communityPost.findMany({ where, include, orderBy, take }),
    needsTaggedMerge
      ? prisma.communityPostTag.findMany({
          where: { taggedUserId: viewerId },
          select: { postId: true },
          orderBy: { createdAt: 'desc' },
          take: 15,
        })
      : Promise.resolve([]),
  ]);

  if (needsTaggedMerge && tagRows.length) {
    const taggedIds = tagRows.map((t) => t.postId).filter((id) => !posts.some((p) => p.id === id));
    if (taggedIds.length) {
      const taggedPosts = await prisma.communityPost.findMany({
        where: { id: { in: taggedIds }, groupId: null },
        include: FEED_POST_INCLUDE,
      });
      const merged = sortPostsWithPins(
        [...posts, ...taggedPosts],
        { profile: Boolean(authorId), group: Boolean(groupId) },
      ).slice(0, take + 10);
      return enrichPosts(merged, viewerId);
    }
  }

  const sorted = sortPostsWithPins(posts, { profile: Boolean(authorId), group: Boolean(groupId) });
  return enrichPosts(sorted, viewerId);
}

async function getFeedPosts(viewerId, opts = {}) {
  const {
    feed = 'for_you',
    groupId,
    authorId,
    skipCache = false,
    excludeIds,
    debug = false,
  } = opts;
  const isPaginatedForYou = feed === 'for_you' && !authorId && !groupId && Boolean(excludeIds);
  const isForYouDebug = feed === 'for_you' && !authorId && !groupId && debug;
  const gen = await getFeedCacheGeneration();
  const cacheKey = feedCacheKey(viewerId, feed, groupId, authorId, gen);

  if (!skipCache && !isPaginatedForYou && !isForYouDebug) {
    const hit = await readFeedCache(cacheKey);
    if (hit) return hit;
  }

  const forYouOpts = isPaginatedForYou || isForYouDebug ? { excludeIds, debug } : {};
  const data = await queryFeedPosts(viewerId, { feed, groupId, authorId, forYouOpts });

  if (!isPaginatedForYou && !isForYouDebug) {
    const cachePayload =
      feed === 'for_you' && !authorId && !groupId && data?.posts ? data.posts : data;
    await writeFeedCache(cacheKey, cachePayload);
  }

  return data;
}

module.exports = {
  FEED_PAGE_SIZE,
  getFeedPosts,
  invalidateFeedCacheForUser,
  bumpFeedCacheGeneration,
};
