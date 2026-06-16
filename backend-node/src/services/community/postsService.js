const { prisma } = require('../../db');
const { mapAuthorIdentity } = require('../../lib/communityAuthors');
const { getLeagueBadgesForUsers } = require('../../lib/gamification/leagueService');
const { canMentionUser } = require('../../lib/communityPrivacy');
const { notifyWithActor } = require('../../lib/communityNotify');
const { REACTION_EMOJIS, AUDIENCE_VALUES, emptyReactionCounts } = require('./constants');
const { mapPostMediaItems } = require('./postMedia');
const { buildPollMeta, mapPoll } = require('./pollService');

function communityPostLink(postId, commentId) {
  const params = new URLSearchParams({ post: postId });
  if (commentId) params.set('comment', commentId);
  return `/community?${params.toString()}`;
}

function mapMentions(post) {
  const users = (post.tags || [])
    .filter((t) => t.taggedUser)
    .map((t) => ({
      type: 'user',
      id: t.taggedUser.id,
      user: mapAuthorIdentity(t.taggedUser),
    }));
  const gyms = (post.gymMentions || []).map((g) => ({
    type: 'gym',
    id: g.gym.id,
    gym: {
      id: g.gym.id,
      name: g.gym.name,
      imageUrl: g.gym.imageUrl,
      ownerId: g.gym.ownerId,
    },
  }));
  return [...users, ...gyms];
}

async function resolveMentionUserIds(authorId, mentionUserIds = []) {
  const valid = [];
  for (const userId of mentionUserIds) {
    if (userId === authorId) continue;
    if (await canMentionUser(authorId, userId)) valid.push(userId);
  }
  return valid;
}

async function savePostMentions(tx, postId, mentionUserIds = [], mentionGymIds = []) {
  for (const userId of mentionUserIds) {
    try {
      await tx.communityPostTag.create({ data: { postId, taggedUserId: userId } });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
    }
  }
  for (const gymId of mentionGymIds) {
    try {
      await tx.communityPostGymMention.create({ data: { postId, gymId } });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
    }
  }
}

async function notifyPostMentions(postId, authorId, mentionUserIds = []) {
  for (const userId of mentionUserIds) {
    await notifyWithActor({
      userId,
      actorId: authorId,
      type: 'community.mention',
      title: 'mentioned you in a post',
      link: communityPostLink(postId),
    });
  }
}

async function applyMentions(postId, authorId, mentionUserIds = [], mentionGymIds = []) {
  const validUserIds = await resolveMentionUserIds(authorId, mentionUserIds);
  await savePostMentions(prisma, postId, validUserIds, mentionGymIds);
  await notifyPostMentions(postId, authorId, validUserIds);
}

function audienceAllowsSync(viewerId, ownerId, audience, followCtx) {
  if (!AUDIENCE_VALUES.includes(audience)) audience = 'only_me';
  if (viewerId === ownerId) return true;
  if (audience === 'only_me' || audience === 'nobody') return false;
  if (audience === 'everyone') return true;
  const viewerFollowsOwner = followCtx.viewerFollowsOwner.has(ownerId);
  const ownerFollowsViewer = followCtx.ownerFollowsViewer.has(ownerId);
  if (audience === 'followers') return viewerFollowsOwner;
  if (audience === 'following') return ownerFollowsViewer;
  if (audience === 'mutual') return viewerFollowsOwner && ownerFollowsViewer;
  return false;
}

async function buildEnrichContext(viewerId, posts) {
  const authorIds = [...new Set(posts.map((p) => p.authorId).filter(Boolean))];
  const postIds = posts.map((p) => p.id);
  const emptyFollow = { viewerFollowsOwner: new Set(), ownerFollowsViewer: new Set() };

  if (!authorIds.length) {
    return {
      followCtx: emptyFollow,
      privateAuthors: new Set(),
      privacyByUser: new Map(),
      savedSet: new Set(),
      ringSet: new Set(),
    };
  }

  const [viewerFollowing, followersOfViewer, userSettings, privacyRows, savedRows, ringRows] =
    await Promise.all([
      prisma.communityFollow.findMany({
        where: { followerId: viewerId, followingId: { in: authorIds }, status: 'accepted' },
        select: { followingId: true },
      }),
      prisma.communityFollow.findMany({
        where: { followerId: { in: authorIds }, followingId: viewerId, status: 'accepted' },
        select: { followerId: true },
      }),
      prisma.userSettings.findMany({
        where: { userId: { in: authorIds } },
        select: { userId: true, publicProfile: true },
      }),
      prisma.communityPrivacySettings.findMany({
        where: { userId: { in: authorIds } },
      }),
      postIds.length
        ? prisma.communitySavedPost.findMany({
            where: { userId: viewerId, postId: { in: postIds } },
            select: { postId: true },
          })
        : [],
      prisma.communityPostRing.findMany({
        where: { subscriberId: viewerId, targetUserId: { in: authorIds } },
        select: { targetUserId: true },
      }),
    ]);

  const settingsMap = new Map(userSettings.map((s) => [s.userId, s.publicProfile]));
  const privateAuthors = new Set(
    authorIds.filter((id) => {
      if (id === viewerId) return false;
      const pub = settingsMap.get(id);
      return pub === undefined ? true : !pub;
    }),
  );

  return {
    followCtx: {
      viewerFollowsOwner: new Set(viewerFollowing.map((f) => f.followingId)),
      ownerFollowsViewer: new Set(followersOfViewer.map((f) => f.followerId)),
    },
    privateAuthors,
    privacyByUser: new Map(privacyRows.map((r) => [r.userId, r])),
    savedSet: new Set(savedRows.map((r) => r.postId)),
    ringSet: new Set(ringRows.map((r) => r.targetUserId)),
  };
}

function canViewUserPostsSync(viewerId, profileUserId, ctx) {
  if (viewerId === profileUserId) return true;
  if (!ctx.privateAuthors.has(profileUserId)) return true;
  return ctx.followCtx.viewerFollowsOwner.has(profileUserId);
}

function canViewPostSync(viewerId, post, ctx) {
  if (viewerId === post.authorId) return true;
  return audienceAllowsSync(viewerId, post.authorId, post.visibility || 'everyone', ctx.followCtx);
}

function canSharePostSync(viewerId, authorId, ctx) {
  if (viewerId === authorId) return true;
  const settings = ctx.privacyByUser.get(authorId);
  const audience = settings?.sharesAudience || 'everyone';
  return audienceAllowsSync(viewerId, authorId, audience, ctx.followCtx);
}

function buildPresenceAccessMapSync(viewerId, ownerIds, ctx) {
  const map = new Map();
  for (const ownerId of ownerIds) {
    if (ownerId === viewerId) {
      map.set(ownerId, true);
      continue;
    }
    const settings = ctx.privacyByUser.get(ownerId);
    const audience = settings?.presenceAudience || 'everyone';
    map.set(ownerId, audienceAllowsSync(viewerId, ownerId, audience, ctx.followCtx));
  }
  return map;
}

/** Aggregated reaction counts — 2 queries instead of loading every like row. */
async function buildReactionMeta(postIds, viewerId) {
  const map = new Map();
  if (!postIds.length) return map;
  for (const id of postIds) {
    map.set(id, { counts: emptyReactionCounts(), myReaction: null, total: 0 });
  }

  const [groups, mine] = await Promise.all([
    prisma.communityPostLike.groupBy({
      by: ['postId', 'emoji'],
      where: { postId: { in: postIds } },
      _count: { _all: true },
    }),
    viewerId
      ? prisma.communityPostLike.findMany({
          where: { postId: { in: postIds }, userId: viewerId },
          select: { postId: true, emoji: true },
        })
      : [],
  ]);

  for (const row of groups) {
    const emoji = REACTION_EMOJIS.includes(row.emoji) ? row.emoji : 'like';
    const entry = map.get(row.postId);
    if (!entry) continue;
    const n = row._count._all;
    entry.counts[emoji] = (entry.counts[emoji] || 0) + n;
    entry.total += n;
  }
  for (const row of mine) {
    const emoji = REACTION_EMOJIS.includes(row.emoji) ? row.emoji : 'like';
    const entry = map.get(row.postId);
    if (entry) entry.myReaction = emoji;
  }
  return map;
}

function redactPost(post, viewerId, repostedSet, reactionMeta, canShare = true, presenceMap, extras = {}) {
  const meta = reactionMeta.get(post.id) || {
    counts: emptyReactionCounts(),
    myReaction: null,
    total: 0,
  };
  const presenceAllowed = presenceMap?.get(post.authorId);
  return {
    ...post,
    author: mapAuthorIdentity(post.author, {
      viewerId,
      presenceAllowed,
      leagueBadge: extras.leagueBadge,
    }),
    mentions: mapMentions(post),
    likedByMe: !!meta.myReaction,
    myReaction: meta.myReaction,
    reactions: meta.counts,
    repostedByMe: repostedSet.has(post.id),
    savedByMe: extras.savedByMe ?? false,
    authorRinging: extras.authorRinging ?? false,
    commentsCount: post._count?.comments ?? 0,
    likesCount: meta.total ?? post.likesCount ?? post._count?.likes ?? 0,
    repostsCount: post.repostsCount ?? post._count?.reposts ?? 0,
    mediaItems: mapPostMediaItems(post),
    mediaType: post.mediaType || (post.videoUrl ? 'video' : post.imageUrl ? 'image' : null),
    canShare,
    poll: extras.poll ?? (post.poll ? mapPoll(post.poll, viewerId) : null),
    isProfilePinned: Boolean(post.profilePinnedAt),
    profilePinnedAt: post.profilePinnedAt ?? null,
    isGroupFeatured: Boolean(post.groupPinnedAt),
    groupPinnedAt: post.groupPinnedAt ?? null,
    locationName: post.locationName ?? null,
  };
}

async function enrichPosts(posts, viewerId) {
  if (!posts.length) return [];
  const ctx = await buildEnrichContext(viewerId, posts);
  const visible = [];
  for (const p of posts) {
    const taggedMe = (p.tags || []).some((t) => t.taggedUserId === viewerId);
    const accountOk = taggedMe || canViewUserPostsSync(viewerId, p.authorId, ctx);
    const postOk = accountOk && (taggedMe || canViewPostSync(viewerId, p, ctx));
    if (postOk) visible.push(p);
  }
  if (!visible.length) return [];
  const ids = visible.map((p) => p.id);
  const [reactionMeta, userReposts, pollMeta] = await Promise.all([
    buildReactionMeta(ids, viewerId),
    prisma.communityPostRepost.findMany({
      where: { userId: viewerId, postId: { in: ids } },
      select: { postId: true },
    }),
    buildPollMeta(ids, viewerId),
  ]);
  const repostedSet = new Set(userReposts.map((r) => r.postId));
  const shareCache = new Map();
  const authorIds = visible.map((p) => p.authorId);
  const [presenceMap, leagueBadges] = await Promise.all([
    Promise.resolve(buildPresenceAccessMapSync(viewerId, authorIds, ctx)),
    getLeagueBadgesForUsers(authorIds, viewerId),
  ]);
  return visible.map((p) => {
    if (!shareCache.has(p.authorId)) {
      shareCache.set(p.authorId, canSharePostSync(viewerId, p.authorId, ctx));
    }
    return redactPost(p, viewerId, repostedSet, reactionMeta, shareCache.get(p.authorId), presenceMap, {
      savedByMe: ctx.savedSet.has(p.id),
      authorRinging: ctx.ringSet.has(p.authorId),
      poll: pollMeta.get(p.id) ?? null,
      leagueBadge: leagueBadges.get(p.authorId),
    });
  });
}

/** Reuse enrich context when enriching multiple post lists in one request (e.g. profile). */
async function enrichPostsWithContext(posts, viewerId, existingCtx) {
  if (!posts.length) return [];
  const ctx = existingCtx ?? (await buildEnrichContext(viewerId, posts));
  const visible = [];
  for (const p of posts) {
    const taggedMe = (p.tags || []).some((t) => t.taggedUserId === viewerId);
    const accountOk = taggedMe || canViewUserPostsSync(viewerId, p.authorId, ctx);
    const postOk = accountOk && (taggedMe || canViewPostSync(viewerId, p, ctx));
    if (postOk) visible.push(p);
  }
  if (!visible.length) return [];
  const ids = visible.map((p) => p.id);
  const [reactionMeta, userReposts, pollMeta] = await Promise.all([
    buildReactionMeta(ids, viewerId),
    prisma.communityPostRepost.findMany({
      where: { userId: viewerId, postId: { in: ids } },
      select: { postId: true },
    }),
    buildPollMeta(ids, viewerId),
  ]);
  const repostedSet = new Set(userReposts.map((r) => r.postId));
  const shareCache = new Map();
  const authorIds = visible.map((p) => p.authorId);
  const [presenceMap, leagueBadges] = await Promise.all([
    Promise.resolve(buildPresenceAccessMapSync(viewerId, authorIds, ctx)),
    getLeagueBadgesForUsers(authorIds, viewerId),
  ]);
  return visible.map((p) => {
    if (!shareCache.has(p.authorId)) {
      shareCache.set(p.authorId, canSharePostSync(viewerId, p.authorId, ctx));
    }
    return redactPost(p, viewerId, repostedSet, reactionMeta, shareCache.get(p.authorId), presenceMap, {
      savedByMe: ctx.savedSet.has(p.id),
      authorRinging: ctx.ringSet.has(p.authorId),
      poll: pollMeta.get(p.id) ?? null,
      leagueBadge: leagueBadges.get(p.authorId),
    });
  });
}

async function buildPostInteractionPatch(postId, viewerId) {
  const [post, myLike, myRepost, reactionGroups] = await Promise.all([
    prisma.communityPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        likesCount: true,
        repostsCount: true,
        _count: { select: { comments: true } },
      },
    }),
    viewerId
      ? prisma.communityPostLike.findUnique({
          where: { postId_userId: { postId, userId: viewerId } },
          select: { emoji: true },
        })
      : null,
    viewerId
      ? prisma.communityPostRepost.findUnique({
          where: { postId_userId: { postId, userId: viewerId } },
          select: { id: true },
        })
      : null,
    prisma.communityPostLike.groupBy({
      by: ['emoji'],
      where: { postId },
      _count: { _all: true },
    }),
  ]);

  if (!post) return null;

  const reactions = emptyReactionCounts();
  let total = 0;
  for (const row of reactionGroups) {
    const emoji = REACTION_EMOJIS.includes(row.emoji) ? row.emoji : 'like';
    reactions[emoji] = row._count._all;
    total += row._count._all;
  }
  const myReaction =
    myLike?.emoji && REACTION_EMOJIS.includes(myLike.emoji) ? myLike.emoji : null;

  return {
    id: post.id,
    likesCount: total || post.likesCount,
    repostsCount: post.repostsCount,
    commentsCount: post._count.comments,
    myReaction,
    likedByMe: !!myReaction,
    repostedByMe: !!myRepost,
    reactions,
  };
}

module.exports = {
  communityPostLink,
  emptyReactionCounts,
  mapMentions,
  applyMentions,
  resolveMentionUserIds,
  savePostMentions,
  notifyPostMentions,
  buildEnrichContext,
  buildPostInteractionPatch,
  buildReactionMeta,
  enrichPosts,
  enrichPostsWithContext,
  redactPost,
  audienceAllowsSync,
  canViewUserPostsSync,
  canViewPostSync,
  canSharePostSync,
  buildPresenceAccessMapSync,
};
