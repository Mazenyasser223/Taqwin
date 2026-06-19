const { prisma } = require('../../db');
const { redisGetJson, redisSetJson } = require('../../lib/redis');
const { FEED_POST_INCLUDE, FEED_PAGE_SIZE } = require('./constants');
const { enrichPosts } = require('./postsService');
const { getBlockedUserIds } = require('./followService');
const { WEIGHTS, POOL, GOAL_BUCKETS } = require('./recommendationConfig');

const REC_POST_INCLUDE = {
  ...FEED_POST_INCLUDE,
  author: {
    select: {
      ...FEED_POST_INCLUDE.author.select,
      athleteProfile: {
        select: {
          displayName: true,
          communityAvatarUrl: true,
          avatarUrl: true,
          fitnessGoal: true,
        },
      },
    },
  },
};

const memoryServedPosts = new Map();

async function loadPostMetaByIds(postIds, { withContent = false } = {}) {
  const ids = [...new Set(postIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const posts = await prisma.communityPost.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      authorId: true,
      ...(withContent ? { content: true } : {}),
    },
  });
  return new Map(posts.map((p) => [p.id, p]));
}

function authorIdsFromPostRows(rows, postMetaById) {
  const ids = new Set();
  for (const row of rows) {
    const authorId = postMetaById.get(row.postId)?.authorId;
    if (authorId) ids.add(authorId);
  }
  return ids;
}

function normalizeGoal(goal) {
  return String(goal || '').trim().toLowerCase();
}

function goalBucket(goal) {
  const g = normalizeGoal(goal);
  if (!g) return null;
  for (const [bucket, values] of Object.entries(GOAL_BUCKETS)) {
    if (values.some((alias) => g === alias || g.includes(alias) || alias.includes(g))) {
      return bucket;
    }
  }
  // Fallback aligned with plan target bucketing (Hypertrophy, Build Muscle, etc.).
  if (
    g.includes('hyper')
    || g.includes('strength')
    || g.includes('muscle')
    || g.includes('build')
    || g.includes('gain')
    || g.includes('bulk')
    || g.includes('recomp')
  ) {
    return 'strength';
  }
  if (
    g.includes('endurance')
    || g.includes('cardio')
    || g.includes('lose')
    || g.includes('fat')
    || g.includes('cut')
    || g.includes('weight')
  ) {
    return 'endurance';
  }
  return 'general';
}

function goalsRelated(viewerGoal, authorGoal) {
  const v = normalizeGoal(viewerGoal);
  const a = normalizeGoal(authorGoal);
  if (!v || !a) return false;
  if (v === a) return true;
  const viewerBucket = goalBucket(viewerGoal);
  const authorBucket = goalBucket(authorGoal);
  return Boolean(
    viewerBucket
    && authorBucket
    && viewerBucket === authorBucket
    && viewerBucket !== 'general',
  );
}

const HASHTAG_TOKEN_RE = /#([a-z0-9_\u0600-\u06FF]{2,})/gi;
const HASHTAG_STRIP_RE = /#[a-z0-9_\u0600-\u06FF]+/gi;

function extractKeywords(text) {
  const raw = String(text || '').toLowerCase();
  HASHTAG_TOKEN_RE.lastIndex = 0;
  HASHTAG_STRIP_RE.lastIndex = 0;
  const tags = [...raw.matchAll(HASHTAG_TOKEN_RE)].map((m) => m[1]);
  const words = raw
    .replace(HASHTAG_STRIP_RE, ' ')
    .split(/[^a-z0-9\u0600-\u06FF]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4);
  return [...new Set([...tags, ...words])].slice(0, 40);
}

function keywordOverlapScore(postContent, interestKeywords) {
  if (!interestKeywords.size) return 0;
  const postKeys = extractKeywords(postContent);
  let hits = 0;
  for (const k of postKeys) {
    if (interestKeywords.has(k)) hits += 1;
  }
  return hits;
}

function postContentType(post) {
  if (post.poll) return 'poll';
  if (post.media?.length || post.imageUrl || post.videoUrl) return 'media';
  return 'text';
}

function servedPostsKey(viewerId) {
  return `community:rec:served:${viewerId}`;
}

async function loadRecentlyServedPostIds(viewerId) {
  const fromRedis = await redisGetJson(servedPostsKey(viewerId));
  if (Array.isArray(fromRedis)) return new Set(fromRedis);
  const mem = memoryServedPosts.get(viewerId);
  return mem ? new Set(mem) : new Set();
}

async function recordServedPostIds(viewerId, postIds) {
  if (!postIds.length) return;
  const existing = [...(await loadRecentlyServedPostIds(viewerId))];
  const merged = [...new Set([...postIds, ...existing])].slice(0, POOL.servedPostMax);
  memoryServedPosts.set(viewerId, merged);
  await redisSetJson(servedPostsKey(viewerId), merged, POOL.servedPostTtlMs);
}

function parseExcludeIds(raw) {
  if (!raw) return new Set();
  const ids = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(ids);
}

/** Load viewer-specific signals used for ranking. */
async function loadViewerSignals(viewerId) {
  const engagementSince = new Date(Date.now() - POOL.recentEngagementDays * 86_400_000);
  const interestSince = new Date(Date.now() - POOL.interestLookbackDays * 86_400_000);

  const [
    follows,
    rings,
    blockedSet,
    memberships,
    viewer,
    inboundFollows,
    taggedRows,
    groupMemberships,
    savedRows,
    recentLikes,
    recentComments,
    recentReposts,
    consumedLikes,
    consumedComments,
    consumedReposts,
    interestLikePosts,
    recentlyServed,
  ] = await Promise.all([
    prisma.communityFollow.findMany({
      where: { followerId: viewerId, status: 'accepted' },
      select: { followingId: true },
    }),
    prisma.communityPostRing.findMany({
      where: { subscriberId: viewerId },
      select: { targetUserId: true },
    }),
    getBlockedUserIds(viewerId),
    prisma.gymMembership.findMany({
      where: { userId: viewerId, isActive: true },
      select: { gymId: true },
    }),
    prisma.user.findUnique({
      where: { id: viewerId },
      select: {
        role: true,
        athleteProfile: { select: { fitnessGoal: true } },
      },
    }),
    prisma.communityFollow.findMany({
      where: { followingId: viewerId, status: 'accepted' },
      select: { followerId: true },
    }),
    prisma.communityPostTag.findMany({
      where: { taggedUserId: viewerId },
      select: { postId: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.communityGroupMember.findMany({
      where: { userId: viewerId, status: 'accepted' },
      select: { groupId: true },
    }),
    prisma.communitySavedPost.findMany({
      where: { userId: viewerId },
      select: { postId: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    prisma.communityPostLike.findMany({
      where: { userId: viewerId, createdAt: { gte: engagementSince } },
      select: { postId: true },
    }),
    prisma.communityComment.findMany({
      where: { authorId: viewerId, createdAt: { gte: engagementSince } },
      select: { postId: true },
    }),
    prisma.communityPostRepost.findMany({
      where: { userId: viewerId, createdAt: { gte: engagementSince } },
      select: { postId: true },
    }),
    prisma.communityPostLike.findMany({
      where: { userId: viewerId },
      select: { postId: true },
    }),
    prisma.communityComment.findMany({
      where: { authorId: viewerId },
      select: { postId: true },
    }),
    prisma.communityPostRepost.findMany({
      where: { userId: viewerId },
      select: { postId: true },
    }),
    prisma.communityPostLike.findMany({
      where: { userId: viewerId, createdAt: { gte: interestSince } },
      select: { postId: true },
      take: 30,
    }),
    loadRecentlyServedPostIds(viewerId),
  ]);

  const followedIds = new Set(follows.map((f) => f.followingId));
  const ringedIds = new Set(rings.map((r) => r.targetUserId));
  const followerIds = new Set(inboundFollows.map((f) => f.followerId));
  const mutualIds = new Set([...followedIds].filter((id) => followerIds.has(id)));
  const viewerGymIds = new Set(memberships.map((m) => m.gymId));
  const taggedPostIds = new Set(taggedRows.map((t) => t.postId));
  const blockedIds = [...blockedSet];

  const linkedPostIds = [
    ...savedRows.map((r) => r.postId),
    ...recentLikes.map((r) => r.postId),
    ...recentComments.map((r) => r.postId),
    ...recentReposts.map((r) => r.postId),
    ...interestLikePosts.map((r) => r.postId),
  ];
  const postMetaById = await loadPostMetaByIds(linkedPostIds, { withContent: true });

  const savedAuthorIds = authorIdsFromPostRows(savedRows, postMetaById);

  const recentEngagementAuthorIds = new Set([
    ...authorIdsFromPostRows(recentLikes, postMetaById),
    ...authorIdsFromPostRows(recentComments, postMetaById),
    ...authorIdsFromPostRows(recentReposts, postMetaById),
  ]);

  const consumedPostIds = new Set([
    ...consumedLikes.map((r) => r.postId),
    ...consumedComments.map((r) => r.postId),
    ...consumedReposts.map((r) => r.postId),
  ]);

  const interestKeywords = new Set();
  for (const row of interestLikePosts) {
    for (const k of extractKeywords(postMetaById.get(row.postId)?.content)) interestKeywords.add(k);
  }

  const groupIds = groupMemberships.map((g) => g.groupId);
  let groupPeerAuthorIds = new Set();
  if (groupIds.length) {
    const peers = await prisma.communityGroupMember.findMany({
      where: {
        groupId: { in: groupIds },
        userId: { not: viewerId },
        status: 'accepted',
      },
      select: { userId: true },
      distinct: ['userId'],
      take: 150,
    });
    groupPeerAuthorIds = new Set(peers.map((p) => p.userId));
  }

  return {
    followedIds,
    ringedIds,
    mutualIds,
    viewerGymIds,
    taggedPostIds,
    blockedIds,
    savedAuthorIds,
    groupPeerAuthorIds,
    recentEngagementAuthorIds,
    consumedPostIds,
    interestKeywords,
    recentlyServedPostIds: recentlyServed,
    viewerRole: viewer?.role ?? 'athlete',
    fitnessGoal: viewer?.athleteProfile?.fitnessGoal ?? null,
  };
}

function authorBaseWhere(viewerId, blockedIds) {
  return {
    groupId: null,
    authorId: {
      not: viewerId,
      ...(blockedIds.length ? { notIn: blockedIds } : {}),
    },
  };
}

/** Viewer’s own public feed posts — always shown at top of For You (first page). */
async function fetchViewerOwnForYouPosts(viewerId, { take = 10, excludeIds = new Set() } = {}) {
  return prisma.communityPost.findMany({
    where: {
      authorId: viewerId,
      groupId: null,
      ...(excludeIds.size ? { id: { notIn: [...excludeIds] } } : {}),
    },
    include: REC_POST_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take,
  });
}

function prependOwnPosts(ownPosts, rankedPosts, take) {
  if (!ownPosts.length) return rankedPosts.slice(0, take);
  const ownIds = new Set(ownPosts.map((p) => p.id));
  const rest = rankedPosts.filter((p) => !ownIds.has(p.id));
  return [...ownPosts, ...rest].slice(0, take);
}

async function fetchGymPeerAuthorIds(viewerId, viewerGymIds, blockedIds, excludeIds) {
  if (!viewerGymIds.size) return [];

  const rows = await prisma.gymMembership.findMany({
    where: {
      gymId: { in: [...viewerGymIds] },
      isActive: true,
      userId: {
        not: viewerId,
        ...(blockedIds.length ? { notIn: blockedIds } : {}),
        ...(excludeIds.length ? { notIn: excludeIds } : {}),
      },
    },
    select: { userId: true },
    distinct: ['userId'],
    take: 120,
  });

  return rows.map((r) => r.userId);
}

/** Authors followed by people the viewer follows (2nd-degree graph). */
async function fetchSecondDegreeAuthorIds(viewerId, signals) {
  const seedIds = [...signals.followedIds];
  if (!seedIds.length) return new Set();

  const rows = await prisma.communityFollow.findMany({
    where: {
      followerId: { in: seedIds },
      status: 'accepted',
      followingId: {
        not: viewerId,
        notIn: [...signals.followedIds, ...signals.blockedIds],
      },
    },
    select: { followingId: true },
    distinct: ['followingId'],
    take: 80,
  });

  return new Set(rows.map((r) => r.followingId));
}

/** Merge candidate posts from social graph, gym peers, trending, discovery, and tags. */
async function fetchCandidatePosts(viewerId, signals, gymPeerIds = [], secondDegreeIds = new Set()) {
  const since = new Date(Date.now() - POOL.lookbackDays * 86_400_000);
  const trendingSince = new Date(Date.now() - POOL.trendingLookbackDays * 86_400_000);
  const baseWhere = {
    ...authorBaseWhere(viewerId, signals.blockedIds),
    createdAt: { gte: since },
  };

  const socialAuthorIds = [...new Set([...signals.followedIds, ...signals.ringedIds])];
  const secondDegreeArr = [...secondDegreeIds];

  const [
    socialPosts,
    gymPosts,
    trendingPosts,
    discoveryPosts,
    taggedPosts,
    secondDegreePosts,
    groupPeerPosts,
  ] = await Promise.all([
    socialAuthorIds.length
      ? prisma.communityPost.findMany({
          where: { ...baseWhere, authorId: { in: socialAuthorIds } },
          include: REC_POST_INCLUDE,
          take: 80,
          orderBy: { createdAt: 'desc' },
        })
      : [],
    gymPeerIds.length
      ? prisma.communityPost.findMany({
          where: { ...baseWhere, authorId: { in: gymPeerIds } },
          include: REC_POST_INCLUDE,
          take: 40,
          orderBy: { createdAt: 'desc' },
        })
      : [],
    prisma.communityPost.findMany({
      where: {
        ...authorBaseWhere(viewerId, signals.blockedIds),
        groupId: null,
        createdAt: { gte: trendingSince },
      },
      include: REC_POST_INCLUDE,
      take: 40,
      orderBy: [{ likesCount: 'desc' }, { repostsCount: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.communityPost.findMany({
      where: baseWhere,
      include: REC_POST_INCLUDE,
      take: 25,
      orderBy: { createdAt: 'desc' },
    }),
    signals.taggedPostIds.size
      ? prisma.communityPost.findMany({
          where: {
            id: { in: [...signals.taggedPostIds] },
            groupId: null,
            authorId: {
              not: viewerId,
              ...(signals.blockedIds.length ? { notIn: signals.blockedIds } : {}),
            },
          },
          include: REC_POST_INCLUDE,
        })
      : [],
    secondDegreeArr.length
      ? prisma.communityPost.findMany({
          where: { ...baseWhere, authorId: { in: secondDegreeArr } },
          include: REC_POST_INCLUDE,
          take: 30,
          orderBy: { createdAt: 'desc' },
        })
      : [],
    signals.groupPeerAuthorIds.size
      ? prisma.communityPost.findMany({
          where: { ...baseWhere, authorId: { in: [...signals.groupPeerAuthorIds] } },
          include: REC_POST_INCLUDE,
          take: 30,
          orderBy: { createdAt: 'desc' },
        })
      : [],
  ]);

  const byId = new Map();
  for (const post of [
    ...socialPosts,
    ...gymPosts,
    ...trendingPosts,
    ...discoveryPosts,
    ...taggedPosts,
    ...secondDegreePosts,
    ...groupPeerPosts,
  ]) {
    byId.set(post.id, post);
  }

  return [...byId.values()].slice(0, POOL.candidatePoolSize);
}

function roleAffinityScore(viewerRole, authorRole) {
  if (viewerRole === 'athlete') {
    if (authorRole === 'gym') return WEIGHTS.roleAffinityMax;
    if (authorRole === 'athlete') return 1;
  }
  if (viewerRole === 'gym') {
    if (authorRole === 'athlete') return WEIGHTS.roleAffinityMax;
    if (authorRole === 'gym') return 1;
  }
  return 0;
}

function postMentionsViewerGym(post, viewerGymIds) {
  if (!viewerGymIds.size || !post.gymMentions?.length) return false;
  return post.gymMentions.some((m) => viewerGymIds.has(m.gymId));
}

function postTagsViewer(post, viewerId) {
  return (post.tags || []).some((t) => t.taggedUserId === viewerId);
}

function agePenaltyHours(hours) {
  return Math.min(30, hours * 0.5);
}

/** Weighted score for a single post with optional breakdown for debug. */
function scorePost(post, viewerId, signals, opts = {}) {
  const { withBreakdown = false, secondDegreeIds = new Set() } = opts;
  const authorId = post.authorId;
  const breakdown = {};
  let score = 0;

  const add = (key, delta) => {
    score += delta;
    if (withBreakdown && delta !== 0) breakdown[key] = (breakdown[key] || 0) + delta;
  };

  if (signals.followedIds.has(authorId)) add('follow', WEIGHTS.follow);
  if (signals.ringedIds.has(authorId)) add('ring', WEIGHTS.ring);
  if (signals.mutualIds.has(authorId)) add('mutual', WEIGHTS.mutual);
  if (signals.gymPeerAuthorIds?.has(authorId)) add('gymPeer', WEIGHTS.gymPeer);
  if (signals.taggedPostIds.has(post.id) || postTagsViewer(post, viewerId)) add('tag', WEIGHTS.tag);
  if (signals.savedAuthorIds.has(authorId)) add('savedAuthor', WEIGHTS.savedAuthor);
  if (signals.groupPeerAuthorIds.has(authorId)) add('groupMember', WEIGHTS.groupMember);
  if (signals.recentEngagementAuthorIds.has(authorId)) add('recentEngagement', WEIGHTS.recentEngagement);
  if (secondDegreeIds.has(authorId)) add('secondDegree', WEIGHTS.secondDegree);

  const authorGoal = post.author?.athleteProfile?.fitnessGoal;
  if (signals.fitnessGoal && authorGoal) {
    const v = normalizeGoal(signals.fitnessGoal);
    const a = normalizeGoal(authorGoal);
    if (v === a) add('fitnessGoalExact', WEIGHTS.fitnessGoalExact);
    else if (goalsRelated(signals.fitnessGoal, authorGoal)) add('fitnessGoalRelated', WEIGHTS.fitnessGoalRelated);
  }

  const kwHits = keywordOverlapScore(post.content, signals.interestKeywords);
  if (kwHits) add('keywordOverlap', kwHits * WEIGHTS.keywordMatch);

  const likes = post.likesCount ?? post._count?.likes ?? 0;
  const reposts = post.repostsCount ?? post._count?.reposts ?? 0;
  const comments = post._count?.comments ?? 0;
  add('engagement', WEIGHTS.engagementLogMult * Math.log(1 + likes + reposts * 2 + comments * 3));

  const hoursOld = (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000;
  if (hoursOld < 24) add('recency24h', WEIGHTS.recencyBoost);
  add('agePenalty', -agePenaltyHours(hoursOld));

  add('roleAffinity', roleAffinityScore(signals.viewerRole, post.author?.role));

  if (postMentionsViewerGym(post, signals.viewerGymIds)) add('gymMention', WEIGHTS.gymMention);

  if (signals.consumedPostIds.has(post.id)) add('consumed', WEIGHTS.consumedPost);
  if (signals.recentlyServedPostIds.has(post.id)) add('recentlyServed', WEIGHTS.recentlyServed);

  if (withBreakdown) {
    return { score, breakdown, contentType: postContentType(post) };
  }
  return score;
}

/** Limit repeated authors near the top of the feed. */
function diversifyRankedPosts(
  ranked,
  limit,
  maxPerAuthorInWindow = POOL.maxPerAuthorInWindow,
  windowSize = POOL.diversityWindowSize,
) {
  const result = [];
  const authorCounts = new Map();
  const seen = new Set();

  for (const item of ranked) {
    if (result.length >= limit) break;
    const { post } = item;
    if (seen.has(post.id)) continue;

    if (result.length < windowSize) {
      const count = authorCounts.get(post.authorId) || 0;
      if (count >= maxPerAuthorInWindow) continue;
      authorCounts.set(post.authorId, count + 1);
    }

    result.push(post);
    seen.add(post.id);
  }

  if (result.length < limit) {
    for (const item of ranked) {
      if (result.length >= limit) break;
      if (!seen.has(item.post.id)) {
        result.push(item.post);
        seen.add(item.post.id);
      }
    }
  }

  return result;
}

/** Ensure at least one poll and one media post appear early when available. */
function diversifyContentTypes(posts, windowSize = POOL.diversityWindowSize) {
  if (posts.length <= 2) return posts;

  const head = posts.slice(0, windowSize);
  const tail = posts.slice(windowSize);

  const swapIn = (type, slotIdx) => {
    if (slotIdx < 0 || slotIdx >= head.length) return;
    if (head.some((p) => postContentType(p) === type)) return;
    const fromTail = tail.findIndex((p) => postContentType(p) === type);
    if (fromTail < 0) return;
    const [candidate] = tail.splice(fromTail, 1);
    const displaced = head[slotIdx];
    head[slotIdx] = candidate;
    tail.unshift(displaced);
  };

  const pollSlot = Math.max(0, head.length - 1);
  const mediaSlot = Math.max(0, head.length - 2);
  swapIn('poll', pollSlot);
  swapIn('media', mediaSlot);

  return [...head, ...tail];
}

function rankCandidates(candidates, viewerId, signals, secondDegreeIds, debug = false) {
  return candidates
    .map((post) => {
      if (debug) {
        const { score, breakdown, contentType } = scorePost(post, viewerId, signals, {
          withBreakdown: true,
          secondDegreeIds,
        });
        return { post, score, breakdown, contentType };
      }
      const score = scorePost(post, viewerId, signals, { secondDegreeIds });
      return { post, score };
    })
    .sort((a, b) => b.score - a.score || new Date(b.post.createdAt) - new Date(a.post.createdAt));
}

/** Personalized For You feed — rule-based ranking over a merged candidate pool. */
async function getForYouPosts(viewerId, opts = {}) {
  const take = opts.take ?? FEED_PAGE_SIZE;
  const debug = Boolean(opts.debug);
  const excludeIds = opts.excludeIds instanceof Set ? opts.excludeIds : parseExcludeIds(opts.excludeIds);
  const skipServedRecord = Boolean(opts.skipServedRecord);

  const signals = await loadViewerSignals(viewerId);
  const socialAuthorIds = [...new Set([...signals.followedIds, ...signals.ringedIds])];
  const secondDegreeIds = await fetchSecondDegreeAuthorIds(viewerId, signals);
  const gymPeerIds = await fetchGymPeerAuthorIds(
    viewerId,
    signals.viewerGymIds,
    signals.blockedIds,
    socialAuthorIds,
  );
  signals.gymPeerAuthorIds = new Set(gymPeerIds);

  const candidates = await fetchCandidatePosts(viewerId, signals, gymPeerIds, secondDegreeIds);

  const isFirstForYouPage = excludeIds.size === 0;
  const ownTake = Math.min(10, take);

  if (!candidates.length) {
    const ownRaw = isFirstForYouPage
      ? await fetchViewerOwnForYouPosts(viewerId, { take: ownTake, excludeIds })
      : [];
    const fallback = await prisma.communityPost.findMany({
      where: authorBaseWhere(viewerId, signals.blockedIds),
      include: REC_POST_INCLUDE,
      take,
      orderBy: { createdAt: 'desc' },
    });
    const merged = prependOwnPosts(ownRaw, fallback, take);
    const enriched = await enrichPosts(merged, viewerId);
    if (debug) return { posts: enriched, hasMore: false, debug: [] };
    return { posts: enriched, hasMore: false };
  }

  const ranked = rankCandidates(candidates, viewerId, signals, secondDegreeIds, debug);
  const bufferSize = Math.max(take + excludeIds.size, POOL.scoreBufferSize);
  let diversified = diversifyRankedPosts(ranked, bufferSize);
  diversified = diversifyContentTypes(diversified);

  const filtered = diversified.filter((p) => !excludeIds.has(p.id));
  let page = filtered.slice(0, take);
  const hasMore = filtered.length > take;

  if (isFirstForYouPage) {
    const ownRaw = await fetchViewerOwnForYouPosts(viewerId, { take: ownTake, excludeIds });
    page = prependOwnPosts(ownRaw, page, take);
  }

  if (!skipServedRecord && page.length) {
    await recordServedPostIds(viewerId, page.map((p) => p.id));
  }

  const enriched = await enrichPosts(page, viewerId);

  const debugRows = debug
    ? ranked
        .filter((r) => page.some((p) => p.id === r.post.id))
        .map((r) => ({
          postId: r.post.id,
          authorId: r.post.authorId,
          score: r.score,
          breakdown: r.breakdown,
          contentType: r.contentType,
        }))
    : undefined;

  return {
    posts: enriched,
    hasMore,
    debug: debugRows,
    nextExcludeIds: [...excludeIds, ...page.map((p) => p.id)].join(','),
  };
}

module.exports = {
  loadViewerSignals,
  scorePost,
  diversifyRankedPosts,
  diversifyContentTypes,
  extractKeywords,
  goalsRelated,
  prependOwnPosts,
  getForYouPosts,
  parseExcludeIds,
};
