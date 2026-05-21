/**
 * Community — posts, comments, likes, reposts, follows, groups, inbox.
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { notifyWithActor, notifyRingsOnNewContent } = require('../lib/communityNotify');
const { resolveUserIdsFromText, mergeMentionIds, normalizeMentionToken } = require('../lib/communityMentions');
const { canViewPost, canMentionUser, canSharePost } = require('../lib/communityPrivacy');
const { upsertProfile } = require('../lib/profileUpsert');

const router = express.Router();
router.use(authMiddleware);

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });
const REACTION_EMOJIS = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

const feedQuery = z.object({
  query: z.object({
    feed: z.enum(['for_you', 'following', 'coaches', 'athletes', 'trending']).optional(),
    groupId: z.string().uuid().optional(),
    authorId: z.string().uuid().optional(),
  }),
});
const mediaItemSchema = z.object({
  url: z.string().min(1).max(2048),
  mediaType: z.enum(['image', 'video']),
});

const createPostSchema = {
  body: z
    .object({
      content: z.string().max(2000).optional().default(''),
      imageUrl: z.string().min(1).max(2048).optional(),
      videoUrl: z.string().min(1).max(2048).optional(),
      mediaType: z.enum(['image', 'video', 'mixed']).optional(),
      mediaItems: z.array(mediaItemSchema).max(20).optional(),
      groupId: z.string().uuid().optional(),
      commentsLocked: z.boolean().optional(),
      repostsLocked: z.boolean().optional(),
      visibility: z.enum(['everyone', 'followers', 'following', 'mutual', 'nobody', 'only_me']).optional(),
      mentionUserIds: z.array(z.string().uuid()).optional(),
      mentionGymIds: z.array(z.string().uuid()).optional(),
    })
    .superRefine((data, ctx) => {
      const hasText = (data.content || '').trim().length > 0;
      const hasLegacy = Boolean(data.imageUrl || data.videoUrl);
      const hasMulti = (data.mediaItems?.length ?? 0) > 0;
      if (!hasText && !hasLegacy && !hasMulti) {
        ctx.addIssue({
          code: 'custom',
          message: 'Post must include text or media',
          path: ['content'],
        });
      }
    }),
};
const reactSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ emoji: z.enum(['like', 'love', 'haha', 'wow', 'sad', 'angry']) }),
});
const profilePatchSchema = z.object({
  body: z.object({
    bio: z.string().max(2000).optional(),
    displayName: z.string().min(1).max(80).optional(),
    avatarUrl: z.string().min(1).max(2048).optional(),
    coverUrl: z.string().min(1).max(2048).optional(),
  }),
});
const createCommentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    content: z.string().min(1).max(1000),
    parentId: z.string().uuid().optional(),
  }),
});
const commentIdParam = z.object({ params: z.object({ commentId: z.string().uuid() }) });
const updateCommentSchema = z.object({
  params: z.object({ commentId: z.string().uuid() }),
  body: z.object({ content: z.string().min(1).max(1000) }),
});
const commentReactSchema = z.object({
  params: z.object({ commentId: z.string().uuid() }),
  body: z.object({ emoji: z.enum(['like', 'love', 'haha', 'wow', 'sad', 'angry']) }),
});
const createGroupSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80),
    description: z.string().max(500).optional(),
    imageUrl: z.string().min(1).max(2048).optional(),
  }),
});
const updateGroupSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(2).max(80).optional(),
    description: z.string().max(500).nullable().optional(),
    imageUrl: z.string().min(1).max(2048).nullable().optional(),
    postPermission: z.enum(['all_members', 'admins_only']).optional(),
    invitePermission: z.enum(['admins_only', 'all_members']).optional(),
  }),
};
const addGroupMemberSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ userId: z.string().uuid() }),
};
const groupMemberIdParam = {
  params: z.object({ id: z.string().uuid(), userId: z.string().uuid() }),
};
const updateGroupMemberSchema = {
  params: z.object({ id: z.string().uuid(), userId: z.string().uuid() }),
  body: z.object({ role: z.enum(['admin', 'member']) }),
};
const createMessageSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    content: z.string().max(2000).optional(),
    messageType: z.enum(['text', 'image', 'audio', 'emoji']).optional(),
    mediaUrl: z.string().min(1).max(2048).optional(),
  }),
});
const dmSchema = z.object({
  body: z.object({ participantId: z.string().uuid() }),
});
const searchQuery = z.object({
  query: z.object({ q: z.string().min(1).max(100) }),
});

const AUTHOR_SELECT = {
  id: true,
  email: true,
  role: true,
  profile: { select: { displayName: true, avatarUrl: true, coverUrl: true } },
};

const POST_INCLUDE = {
  author: { select: AUTHOR_SELECT },
  group: { select: { id: true, name: true, imageUrl: true } },
  media: { orderBy: { sortOrder: 'asc' } },
  tags: { include: { taggedUser: { select: AUTHOR_SELECT } } },
  gymMentions: { include: { gym: { select: { id: true, name: true, imageUrl: true, ownerId: true } } } },
  _count: { select: { comments: true, likes: true, reposts: true } },
};

function mapPostMediaItems(post) {
  const rows = post.media || [];
  if (rows.length) {
    return rows.map((m) => ({ id: m.id, url: m.url, mediaType: m.mediaType }));
  }
  if (post.videoUrl) return [{ url: post.videoUrl, mediaType: 'video' }];
  if (post.imageUrl) return [{ url: post.imageUrl, mediaType: 'image' }];
  return [];
}

function resolveMediaItemsFromBody(body) {
  if (body.mediaItems?.length) return body.mediaItems;
  if (body.videoUrl) return [{ url: body.videoUrl, mediaType: 'video' }];
  if (body.imageUrl) return [{ url: body.imageUrl, mediaType: 'image' }];
  return [];
}

async function syncPostMedia(tx, postId, items) {
  await tx.communityPostMedia.deleteMany({ where: { postId } });
  if (!items.length) {
    await tx.communityPost.update({
      where: { id: postId },
      data: { imageUrl: null, videoUrl: null, mediaType: null },
    });
    return;
  }
  await tx.communityPostMedia.createMany({
    data: items.map((m, i) => ({
      postId,
      url: m.url,
      mediaType: m.mediaType,
      sortOrder: i,
    })),
  });
  const firstImage = items.find((m) => m.mediaType === 'image');
  const firstVideo = items.find((m) => m.mediaType === 'video');
  const hasImage = Boolean(firstImage);
  const hasVideo = Boolean(firstVideo);
  let mediaType = items[0].mediaType;
  if (hasImage && hasVideo) mediaType = 'mixed';
  else if (items.length > 1) mediaType = hasVideo && !hasImage ? 'video' : 'image';
  await tx.communityPost.update({
    where: { id: postId },
    data: {
      imageUrl: firstImage?.url ?? null,
      videoUrl: firstVideo?.url ?? null,
      mediaType,
    },
  });
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

async function applyMentions(postId, authorId, mentionUserIds = [], mentionGymIds = []) {
  for (const userId of mentionUserIds) {
    if (userId === authorId) continue;
    if (!(await canMentionUser(authorId, userId))) continue;
    try {
      await prisma.communityPostTag.create({ data: { postId, taggedUserId: userId } });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
    }
    await notifyWithActor({
      userId,
      actorId: authorId,
      type: 'community.mention',
      title: 'mentioned you in a post',
      link: '/community',
    });
  }
  for (const gymId of mentionGymIds) {
    try {
      await prisma.communityPostGymMention.create({ data: { postId, gymId } });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
    }
  }
}

function authorHandle(email) {
  const local = (email || 'user').split('@')[0];
  return `@${local.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

/** Always show real name & photos (profile surfaces, search, inbox identity). */
function mapAuthorIdentity(user) {
  if (!user) return user;
  return {
    ...user,
    handle: authorHandle(user.email),
  };
}

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

function emptyReactionCounts() {
  return Object.fromEntries(REACTION_EMOJIS.map((e) => [e, 0]));
}

async function buildCommentReactionMeta(commentIds, viewerId) {
  const map = new Map();
  if (!commentIds.length) return map;
  for (const id of commentIds) {
    map.set(id, { counts: emptyReactionCounts(), myReaction: null, total: 0 });
  }
  const rows = await prisma.communityCommentLike.findMany({
    where: { commentId: { in: commentIds } },
    select: { commentId: true, userId: true, emoji: true },
  });
  for (const row of rows) {
    const emoji = REACTION_EMOJIS.includes(row.emoji) ? row.emoji : 'like';
    const entry = map.get(row.commentId);
    if (!entry) continue;
    entry.counts[emoji] = (entry.counts[emoji] || 0) + 1;
    entry.total += 1;
    if (row.userId === viewerId) entry.myReaction = emoji;
  }
  return map;
}

function mapComment(comment, reactionMeta) {
  const meta = reactionMeta.get(comment.id) || {
    counts: emptyReactionCounts(),
    myReaction: null,
    total: 0,
  };
  return {
    ...comment,
    author: mapAuthorIdentity(comment.author),
    reactions: meta.counts,
    myReaction: meta.myReaction,
    likesCount: meta.total,
  };
}

async function applyCommentReaction(comment, userId, emoji) {
  const existing = await prisma.communityCommentLike.findUnique({
    where: { commentId_userId: { commentId: comment.id, userId } },
  });

  if (existing) {
    if (existing.emoji === emoji) {
      await prisma.communityCommentLike.delete({ where: { id: existing.id } });
    } else {
      await prisma.communityCommentLike.update({
        where: { id: existing.id },
        data: { emoji },
      });
    }
  } else {
    await prisma.communityCommentLike.create({
      data: { commentId: comment.id, userId, emoji },
    });
  }
}

function redactPost(post, viewerId, repostedSet, reactionMeta, canShare = true) {
  const meta = reactionMeta.get(post.id) || {
    counts: emptyReactionCounts(),
    myReaction: null,
    total: 0,
  };
  return {
    ...post,
    author: mapAuthorIdentity(post.author),
    mentions: mapMentions(post),
    likedByMe: !!meta.myReaction,
    myReaction: meta.myReaction,
    reactions: meta.counts,
    repostedByMe: repostedSet.has(post.id),
    commentsCount: post._count?.comments ?? 0,
    likesCount: meta.total ?? post.likesCount ?? post._count?.likes ?? 0,
    repostsCount: post.repostsCount ?? post._count?.reposts ?? 0,
    mediaItems: mapPostMediaItems(post),
    mediaType: post.mediaType || (post.videoUrl ? 'video' : post.imageUrl ? 'image' : null),
    canShare,
  };
}

async function buildReactionMeta(postIds, viewerId) {
  const map = new Map();
  if (!postIds.length) return map;
  for (const id of postIds) {
    map.set(id, { counts: emptyReactionCounts(), myReaction: null, total: 0 });
  }
  const rows = await prisma.communityPostLike.findMany({
    where: { postId: { in: postIds } },
    select: { postId: true, userId: true, emoji: true },
  });
  for (const row of rows) {
    const emoji = REACTION_EMOJIS.includes(row.emoji) ? row.emoji : 'like';
    const entry = map.get(row.postId);
    if (!entry) continue;
    entry.counts[emoji] = (entry.counts[emoji] || 0) + 1;
    entry.total += 1;
    if (row.userId === viewerId) entry.myReaction = emoji;
  }
  return map;
}

async function enrichPosts(posts, viewerId) {
  if (!posts.length) return [];
  const visible = [];
  for (const p of posts) {
    const taggedMe = (p.tags || []).some((t) => t.taggedUserId === viewerId);
    const accountOk = taggedMe || (await canViewUserPosts(viewerId, p.authorId));
    const postOk = accountOk && (taggedMe || (await canViewPost(viewerId, p)));
    if (postOk) visible.push(p);
  }
  if (!visible.length) return [];
  const ids = visible.map((p) => p.id);
  const [reactionMeta, userReposts] = await Promise.all([
    buildReactionMeta(ids, viewerId),
    prisma.communityPostRepost.findMany({
      where: { userId: viewerId, postId: { in: ids } },
      select: { postId: true },
    }),
  ]);
  const repostedSet = new Set(userReposts.map((r) => r.postId));
  const shareCache = new Map();
  const enriched = [];
  for (const p of visible) {
    if (!shareCache.has(p.authorId)) {
      shareCache.set(p.authorId, await canSharePost(viewerId, p.authorId));
    }
    enriched.push(redactPost(p, viewerId, repostedSet, reactionMeta, shareCache.get(p.authorId)));
  }
  return enriched;
}

// ─── Posts ───────────────────────────────────────────────────────────────────

router.get('/posts', validate(feedQuery), async (req, res, next) => {
  try {
    const feed = req.query.feed || 'for_you';
    const groupId = req.query.groupId;
    const authorId = req.query.authorId;

    let where = {};
    let orderBy = { createdAt: 'desc' };

    if (authorId) {
      where = { authorId, groupId: null };
    } else if (groupId) {
      const member = await prisma.communityGroupMember.findUnique({
        where: { groupId_userId: { groupId, userId: req.user.id } },
      });
      if (!member) return res.status(403).json({ error: 'Join this group to view its feed' });
      where = { groupId };
    } else {
      where = { groupId: null };
      if (feed === 'coaches') where = { ...where, author: { role: 'trainer' } };
      else if (feed === 'athletes') where = { ...where, author: { role: 'athlete' } };
      else if (feed === 'following') {
        const follows = await prisma.communityFollow.findMany({
          where: { followerId: req.user.id, status: 'accepted' },
          select: { followingId: true },
        });
        const ids = follows.map((f) => f.followingId);
        if (!ids.length) return res.json([]);
        where = { ...where, authorId: { in: ids } };
      } else if (feed === 'trending') {
        orderBy = [{ likesCount: 'desc' }, { repostsCount: 'desc' }, { createdAt: 'desc' }];
      }
    }

    let posts = await prisma.communityPost.findMany({
      where,
      include: POST_INCLUDE,
      orderBy,
      take: 100,
    });

    if (!authorId && !groupId && (feed === 'for_you' || feed === 'following')) {
      const tagRows = await prisma.communityPostTag.findMany({
        where: { taggedUserId: req.user.id },
        select: { postId: true },
        orderBy: { createdAt: 'desc' },
        take: 40,
      });
      const taggedIds = tagRows.map((t) => t.postId).filter((id) => !posts.some((p) => p.id === id));
      if (taggedIds.length) {
        const taggedPosts = await prisma.communityPost.findMany({
          where: { id: { in: taggedIds }, groupId: null },
          include: POST_INCLUDE,
        });
        posts = [...posts, ...taggedPosts].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      }
    }

    res.json(await enrichPosts(posts, req.user.id));
  } catch (err) {
    next(err);
  }
});

router.post('/posts', validate(createPostSchema), async (req, res, next) => {
  try {
    const {
      content: rawContent,
      groupId,
      commentsLocked,
      repostsLocked,
      visibility,
      mentionUserIds,
      mentionGymIds,
    } = req.body;
    const content = (rawContent || '').trim();
    const mediaItems = resolveMediaItemsFromBody(req.body);
    if (groupId) {
      const member = await prisma.communityGroupMember.findUnique({
        where: { groupId_userId: { groupId, userId: req.user.id } },
        include: { group: true },
      });
      if (!member) return res.status(403).json({ error: 'Join the group before posting' });
      if (!canPostToGroup(member.group, member)) {
        return res.status(403).json({ error: 'Only admins can post in this group' });
      }
    }
    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.communityPost.create({
        data: {
          authorId: req.user.id,
          content,
          imageUrl: null,
          videoUrl: null,
          mediaType: null,
          groupId: groupId ?? null,
          commentsLocked: commentsLocked ?? false,
          repostsLocked: repostsLocked ?? false,
          visibility: visibility ?? 'everyone',
        },
      });
      await syncPostMedia(tx, created.id, mediaItems);
      return tx.communityPost.findUnique({
        where: { id: created.id },
        include: POST_INCLUDE,
      });
    });
    const blockedIds = [...(await getBlockedUserIds(req.user.id))];
    const fromContent = await resolveUserIdsFromText(content, req.user.id, blockedIds);
    const allMentionUserIds = mergeMentionIds(mentionUserIds ?? [], fromContent);
    await applyMentions(post.id, req.user.id, allMentionUserIds, mentionGymIds ?? []);
    if (!groupId) {
      await notifyRingsOnNewContent(req.user.id, '/community', 'post');
    }
    const refreshed = await prisma.communityPost.findUnique({
      where: { id: post.id },
      include: POST_INCLUDE,
    });
    const [enriched] = await enrichPosts([refreshed], req.user.id);
    res.status(201).json(enriched);
  } catch (err) {
    next(err);
  }
});

router.get('/posts/:id', validate(idParam), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({
      where: { id: req.params.id },
      include: POST_INCLUDE,
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const [enriched] = await enrichPosts([post], req.user.id);
    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

router.delete('/posts/:id', validate(idParam), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.authorId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await prisma.communityPost.delete({ where: { id: post.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function applyReaction(post, userId, emoji) {
  const existing = await prisma.communityPostLike.findUnique({
    where: { postId_userId: { postId: post.id, userId } },
  });

  if (existing) {
    if (existing.emoji === emoji) {
      await prisma.$transaction([
        prisma.communityPostLike.delete({ where: { id: existing.id } }),
        prisma.communityPost.update({
          where: { id: post.id },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
    } else {
      await prisma.communityPostLike.update({
        where: { id: existing.id },
        data: { emoji },
      });
    }
  } else {
    await prisma.$transaction([
      prisma.communityPostLike.create({
        data: { postId: post.id, userId, emoji },
      }),
      prisma.communityPost.update({
        where: { id: post.id },
        data: { likesCount: { increment: 1 } },
      }),
    ]);
    if (post.authorId !== userId) {
      await notifyWithActor({
        userId: post.authorId,
        actorId: userId,
        type: 'community.reaction',
        title: `reacted with ${emoji} to your post`,
        link: '/community',
      });
    }
  }
}

router.post('/posts/:id/react', validate(reactSchema), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    await applyReaction(post, req.user.id, req.body.emoji);
    const updated = await prisma.communityPost.findUnique({
      where: { id: post.id },
      include: POST_INCLUDE,
    });
    const [enriched] = await enrichPosts([updated], req.user.id);
    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/like', validate(idParam), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    await applyReaction(post, req.user.id, 'like');
    const updated = await prisma.communityPost.findUnique({
      where: { id: post.id },
      include: POST_INCLUDE,
    });
    const [enriched] = await enrichPosts([updated], req.user.id);
    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/repost', validate(idParam), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.repostsLocked) return res.status(403).json({ error: 'Reposts are disabled on this post' });

    const existing = await prisma.communityPostRepost.findUnique({
      where: { postId_userId: { postId: post.id, userId: req.user.id } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.communityPostRepost.delete({ where: { id: existing.id } }),
        prisma.communityPost.update({
          where: { id: post.id },
          data: { repostsCount: { decrement: 1 } },
        }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.communityPostRepost.create({ data: { postId: post.id, userId: req.user.id } }),
        prisma.communityPost.update({
          where: { id: post.id },
          data: { repostsCount: { increment: 1 } },
        }),
      ]);
      if (post.authorId !== req.user.id) {
        await notifyWithActor({
          userId: post.authorId,
          actorId: req.user.id,
          type: 'community.repost',
          title: 'reposted your post',
          link: '/community',
        });
      }
    }

    const updated = await prisma.communityPost.findUnique({
      where: { id: post.id },
      include: POST_INCLUDE,
    });
    const [enriched] = await enrichPosts([updated], req.user.id);
    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

router.get('/posts/:id/comments', validate(idParam), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (!(await canViewUserPosts(req.user.id, post.authorId))) {
      return res.status(403).json({ error: 'This account is private' });
    }
    const comments = await prisma.communityComment.findMany({
      where: { postId: req.params.id },
      include: { author: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
    const reactionMeta = await buildCommentReactionMeta(
      comments.map((c) => c.id),
      req.user.id
    );
    res.json(comments.map((c) => mapComment(c, reactionMeta)));
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/comments', validate(createCommentSchema), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (!(await canViewUserPosts(req.user.id, post.authorId))) {
      return res.status(403).json({ error: 'This account is private' });
    }
    if (post.commentsLocked) return res.status(403).json({ error: 'Comments are disabled on this post' });

    let parentId = null;
    if (req.body.parentId) {
      const parent = await prisma.communityComment.findUnique({ where: { id: req.body.parentId } });
      if (!parent || parent.postId !== post.id) {
        return res.status(400).json({ error: 'Invalid reply target' });
      }
      parentId = parent.id;
    }

    const comment = await prisma.communityComment.create({
      data: {
        postId: post.id,
        authorId: req.user.id,
        content: req.body.content,
        parentId,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    const notifyTargets = new Set();
    if (post.authorId !== req.user.id) notifyTargets.add(post.authorId);
    if (parentId) {
      const parent = await prisma.communityComment.findUnique({ where: { id: parentId } });
      if (parent && parent.authorId !== req.user.id) notifyTargets.add(parent.authorId);
    }
    for (const userId of notifyTargets) {
      await notifyWithActor({
        userId,
        actorId: req.user.id,
        type: parentId ? 'community.comment_reply' : 'community.comment',
        title: parentId ? 'replied to a comment' : 'commented on your post',
        message: req.body.content.slice(0, 120),
        link: '/community',
      });
    }

    const reactionMeta = await buildCommentReactionMeta([comment.id], req.user.id);
    res.status(201).json(mapComment(comment, reactionMeta));
  } catch (err) {
    next(err);
  }
});

router.patch('/comments/:commentId', validate(updateCommentSchema), async (req, res, next) => {
  try {
    const comment = await prisma.communityComment.findUnique({
      where: { id: req.params.commentId },
      include: { author: { select: AUTHOR_SELECT } },
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.authorId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.communityComment.update({
      where: { id: comment.id },
      data: { content: req.body.content },
      include: { author: { select: AUTHOR_SELECT } },
    });
    const reactionMeta = await buildCommentReactionMeta([updated.id], req.user.id);
    res.json(mapComment(updated, reactionMeta));
  } catch (err) {
    next(err);
  }
});

router.delete('/comments/:commentId', validate(commentIdParam), async (req, res, next) => {
  try {
    const comment = await prisma.communityComment.findUnique({
      where: { id: req.params.commentId },
      include: { post: { select: { authorId: true } } },
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    const isAuthor = comment.authorId === req.user.id;
    const isPostOwner = comment.post.authorId === req.user.id;
    if (!isAuthor && !isPostOwner) return res.status(403).json({ error: 'Forbidden' });

    await prisma.communityComment.delete({ where: { id: comment.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/comments/:commentId/react', validate(commentReactSchema), async (req, res, next) => {
  try {
    const comment = await prisma.communityComment.findUnique({
      where: { id: req.params.commentId },
      include: { author: { select: AUTHOR_SELECT }, post: { select: { authorId: true } } },
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (!(await canViewUserPosts(req.user.id, comment.post.authorId))) {
      return res.status(403).json({ error: 'This account is private' });
    }

    await applyCommentReaction(comment, req.user.id, req.body.emoji);

    if (comment.authorId !== req.user.id) {
      await notifyWithActor({
        userId: comment.authorId,
        actorId: req.user.id,
        type: 'community.comment_reaction',
        title: `reacted with ${req.body.emoji} to your comment`,
        link: '/community',
      });
    }

    const refreshed = await prisma.communityComment.findUnique({
      where: { id: comment.id },
      include: { author: { select: AUTHOR_SELECT } },
    });
    const reactionMeta = await buildCommentReactionMeta([comment.id], req.user.id);
    res.json(mapComment(refreshed, reactionMeta));
  } catch (err) {
    next(err);
  }
});

// ─── Follow ──────────────────────────────────────────────────────────────────

router.post('/follow/:userId', async (req, res, next) => {
  try {
    const followingId = req.params.userId;
    if (followingId === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });

    const target = await prisma.user.findUnique({ where: { id: followingId } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (await isBlockedBetween(req.user.id, followingId)) {
      return res.status(403).json({ error: 'Unable to follow this user' });
    }

    const existing = await getFollowRelation(req.user.id, followingId);

    if (existing) {
      await prisma.communityFollow.delete({ where: { id: existing.id } });
      return res.json({ following: false, followStatus: 'none', requestSent: false });
    }

    const targetPrivate = await isUserPrivate(followingId);
    if (targetPrivate) {
      await prisma.communityFollow.create({
        data: { followerId: req.user.id, followingId, status: 'pending' },
      });
      await notifyWithActor({
        userId: followingId,
        actorId: req.user.id,
        type: 'community.follow_request',
        title: 'requested to follow you',
        link: '/community/profile',
      });
      return res.json({ following: false, followStatus: 'pending', requestSent: true });
    }

    await prisma.communityFollow.create({
      data: { followerId: req.user.id, followingId, status: 'accepted' },
    });
    await notifyWithActor({
      userId: followingId,
      actorId: req.user.id,
      type: 'community.follow',
      title: 'started following you',
      link: `/community/profile/${req.user.id}`,
    });
    res.json({ following: true, followStatus: 'accepted', requestSent: false });
  } catch (err) {
    next(err);
  }
});

router.post('/follow-requests/:followerId/accept', async (req, res, next) => {
  try {
    const followerId = req.params.followerId;
    const row = await prisma.communityFollow.findUnique({
      where: { followerId_followingId: { followerId, followingId: req.user.id } },
    });
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Follow request not found' });
    }
    await prisma.communityFollow.update({
      where: { id: row.id },
      data: { status: 'accepted' },
    });
    await notifyWithActor({
      userId: followerId,
      actorId: req.user.id,
      type: 'community.follow_accepted',
      title: 'accepted your follow request',
      link: `/community/profile/${req.user.id}`,
    });
    res.json({ following: true, followStatus: 'accepted' });
  } catch (err) {
    next(err);
  }
});

router.post('/follow-requests/:followerId/decline', async (req, res, next) => {
  try {
    const followerId = req.params.followerId;
    const row = await prisma.communityFollow.findUnique({
      where: { followerId_followingId: { followerId, followingId: req.user.id } },
    });
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Follow request not found' });
    }
    await prisma.communityFollow.delete({ where: { id: row.id } });
    res.json({ following: false, followStatus: 'none' });
  } catch (err) {
    next(err);
  }
});

// ─── User search (inbox / new message) ───────────────────────────────────────

const mentionSearchQuery = {
  query: z.object({ q: z.string().max(100).optional().default('') }),
};

router.get('/mentions/search', validate(mentionSearchQuery), async (req, res, next) => {
  try {
    const q = normalizeMentionToken(req.query.q || '');
    const blockedIds = await getBlockedUserIds(req.user.id);
    const userWhere =
      q.length === 0
        ? { id: { not: req.user.id, notIn: [...blockedIds] } }
        : {
            id: { not: req.user.id, notIn: [...blockedIds] },
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { profile: { displayName: { contains: q, mode: 'insensitive' } } },
            ],
          };
    const gymWhere =
      q.length === 0
        ? { isActive: true }
        : {
            isActive: true,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { location: { contains: q, mode: 'insensitive' } },
            ],
          };
    const [users, gyms] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        select: AUTHOR_SELECT,
        take: q.length === 0 ? 50 : 12,
        orderBy: { email: 'asc' },
      }),
      prisma.gym.findMany({
        where: gymWhere,
        select: { id: true, name: true, imageUrl: true, ownerId: true },
        take: q.length === 0 ? 20 : 8,
        orderBy: { name: 'asc' },
      }),
    ]);
    res.json({
      users: users.map((u) => ({ type: 'user', ...mapAuthorIdentity(u) })),
      gyms: gyms.map((g) => ({ type: 'gym', ...g })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users/search', validate(searchQuery), async (req, res, next) => {
  try {
    const q = req.query.q.trim();
    const blockedIds = await getBlockedUserIds(req.user.id);
    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user.id, notIn: [...blockedIds] },
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { profile: { displayName: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: AUTHOR_SELECT,
      take: 20,
    });
    const results = await Promise.all(
      users.map(async (u) => ({
        ...mapAuthorIdentity(u),
        isPrivate: await isUserPrivate(u.id),
        followStatus: await followStatusFor(req.user.id, u.id),
      }))
    );
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// ─── Groups ──────────────────────────────────────────────────────────────────

function isGroupOwner(group, userId) {
  return group.ownerId === userId;
}

function isGroupAdmin(group, membership) {
  if (!membership) return false;
  return isGroupOwner(group, membership.userId) || membership.role === 'admin';
}

function canPostToGroup(group, membership) {
  if (!membership) return false;
  if ((group.postPermission || 'all_members') === 'admins_only') {
    return isGroupAdmin(group, membership);
  }
  return true;
}

function canInviteToGroup(group, membership) {
  if (!membership) return false;
  if ((group.invitePermission || 'admins_only') === 'all_members') return true;
  return isGroupAdmin(group, membership);
}

function formatGroup(g, viewerId, membership) {
  const myRole = isGroupOwner(g, viewerId) ? 'owner' : membership?.role ?? null;
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    imageUrl: g.imageUrl,
    ownerId: g.ownerId,
    owner: g.owner ? mapAuthorIdentity(g.owner) : undefined,
    membersCount: g._count?.members ?? 0,
    postsCount: g._count?.posts ?? 0,
    joined: Boolean(membership),
    myRole,
    canManage: isGroupOwner(g, viewerId) || membership?.role === 'admin',
    canPost: canPostToGroup(g, membership),
    canInvite: canInviteToGroup(g, membership),
    postPermission: g.postPermission || 'all_members',
    invitePermission: g.invitePermission || 'admins_only',
    createdAt: g.createdAt,
  };
}

async function getGroupMembership(groupId, userId) {
  return prisma.communityGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: true },
  });
}

router.get('/groups', async (req, res, next) => {
  try {
    const groups = await prisma.communityGroup.findMany({
      include: {
        owner: { select: AUTHOR_SELECT },
        _count: { select: { members: true, posts: true } },
        members: { where: { userId: req.user.id }, select: { id: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(groups.map((g) => formatGroup(g, req.user.id, g.members[0] ?? null)));
  } catch (err) {
    next(err);
  }
});

router.get('/groups/:id', validate(idParam), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: AUTHOR_SELECT },
        _count: { select: { members: true, posts: true } },
        members: { where: { userId: req.user.id }, select: { id: true, role: true } },
      },
    });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(formatGroup(group, req.user.id, group.members[0] ?? null));
  } catch (err) {
    next(err);
  }
});

router.post('/groups', validate(createGroupSchema), async (req, res, next) => {
  try {
    const { name, description, imageUrl } = req.body;
    const createdId = await prisma.$transaction(async (tx) => {
      const g = await tx.communityGroup.create({
        data: {
          ownerId: req.user.id,
          name,
          description: description ?? null,
          imageUrl: imageUrl ?? null,
        },
      });
      await tx.communityGroupMember.create({
        data: { groupId: g.id, userId: req.user.id, role: 'admin' },
      });
      return g.id;
    });
    const group = await prisma.communityGroup.findUnique({
      where: { id: createdId },
      include: {
        owner: { select: AUTHOR_SELECT },
        _count: { select: { members: true, posts: true } },
        members: { where: { userId: req.user.id }, select: { id: true, role: true } },
      },
    });
    res.status(201).json(formatGroup(group, req.user.id, group.members[0] ?? null));
  } catch (err) {
    next(err);
  }
});

router.patch('/groups/:id', validate(updateGroupSchema), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const membership = await getGroupMembership(group.id, req.user.id);
    if (!isGroupAdmin(group, membership)) {
      return res.status(403).json({ error: 'Only group admins can update settings' });
    }
    const { name, description, imageUrl, postPermission, invitePermission } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (postPermission !== undefined) data.postPermission = postPermission;
    if (invitePermission !== undefined) data.invitePermission = invitePermission;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    await prisma.communityGroup.update({ where: { id: group.id }, data });
    const refreshed = await prisma.communityGroup.findUnique({
      where: { id: group.id },
      include: {
        owner: { select: AUTHOR_SELECT },
        _count: { select: { members: true, posts: true } },
        members: { where: { userId: req.user.id }, select: { id: true, role: true } },
      },
    });
    const freshMembership = await getGroupMembership(group.id, req.user.id);
    res.json(formatGroup(refreshed, req.user.id, freshMembership));
  } catch (err) {
    next(err);
  }
});

router.delete('/groups/:id', validate(idParam), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isGroupOwner(group, req.user.id)) {
      return res.status(403).json({ error: 'Only the group owner can delete the group' });
    }
    await prisma.communityGroup.delete({ where: { id: group.id } });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

router.get('/groups/:id/members', validate(idParam), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const membership = await getGroupMembership(group.id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'Join the group to view members' });
    const members = await prisma.communityGroupMember.findMany({
      where: { groupId: group.id },
      include: { user: { select: AUTHOR_SELECT } },
      orderBy: { joinedAt: 'asc' },
    });
    res.json(
      members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: isGroupOwner(group, m.userId) ? 'owner' : m.role,
        joinedAt: m.joinedAt,
        user: mapAuthorIdentity(m.user),
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post('/groups/:id/members', validate(addGroupMemberSchema), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const membership = await getGroupMembership(group.id, req.user.id);
    if (!canInviteToGroup(group, membership)) {
      return res.status(403).json({ error: 'You cannot add members to this group' });
    }
    const targetId = req.body.userId;
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Already a member' });
    }
    const member = await prisma.communityGroupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: targetId } },
      create: { groupId: group.id, userId: targetId, role: 'member' },
      update: {},
      include: { user: { select: AUTHOR_SELECT } },
    });
    res.status(201).json({
      id: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      user: mapAuthorIdentity(member.user),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/groups/:id/members/:userId', validate(updateGroupMemberSchema), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isGroupOwner(group, req.user.id)) {
      return res.status(403).json({ error: 'Only the owner can change member roles' });
    }
    const targetId = req.params.userId;
    if (isGroupOwner(group, targetId)) {
      return res.status(400).json({ error: 'Cannot change owner role' });
    }
    const member = await prisma.communityGroupMember.update({
      where: { groupId_userId: { groupId: group.id, userId: targetId } },
      data: { role: req.body.role },
      include: { user: { select: AUTHOR_SELECT } },
    });
    res.json({
      id: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      user: mapAuthorIdentity(member.user),
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/groups/:id/members/:userId', validate(groupMemberIdParam), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const membership = await getGroupMembership(group.id, req.user.id);
    const targetId = req.params.userId;
    if (isGroupOwner(group, targetId)) {
      return res.status(400).json({ error: 'Cannot remove the group owner' });
    }
    const selfRemove = targetId === req.user.id;
    if (!selfRemove && !isGroupAdmin(group, membership)) {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }
    await prisma.communityGroupMember.deleteMany({
      where: { groupId: group.id, userId: targetId },
    });
    res.json({ removed: true });
  } catch (err) {
    next(err);
  }
});

router.post('/groups/:id/join', validate(idParam), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    await prisma.communityGroupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: req.user.id } },
      create: { groupId: group.id, userId: req.user.id, role: 'member' },
      update: {},
    });
    const refreshed = await prisma.communityGroup.findUnique({
      where: { id: group.id },
      include: {
        owner: { select: AUTHOR_SELECT },
        _count: { select: { members: true, posts: true } },
        members: { where: { userId: req.user.id }, select: { id: true, role: true } },
      },
    });
    res.json(formatGroup(refreshed, req.user.id, refreshed.members[0] ?? null));
  } catch (err) {
    next(err);
  }
});

router.post('/groups/:id/leave', validate(idParam), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.ownerId === req.user.id) {
      return res.status(400).json({ error: 'Owner cannot leave; delete the group instead' });
    }
    await prisma.communityGroupMember.deleteMany({
      where: { groupId: group.id, userId: req.user.id },
    });
    const refreshed = await prisma.communityGroup.findUnique({
      where: { id: group.id },
      include: {
        owner: { select: AUTHOR_SELECT },
        _count: { select: { members: true, posts: true } },
        members: { where: { userId: req.user.id }, select: { id: true, role: true } },
      },
    });
    res.json(formatGroup(refreshed, req.user.id, null));
  } catch (err) {
    next(err);
  }
});

// ─── Inbox ───────────────────────────────────────────────────────────────────

async function formatConversation(conv, viewerId) {
  const otherParticipants = conv.participants.filter((p) => p.userId !== viewerId);
  const other = otherParticipants[0]?.user;
  const lastMsg = conv.messages[0];
  const myParticipant = conv.participants.find((p) => p.userId === viewerId);
  const lastRead = myParticipant?.lastReadAt;

  let unreadCount = 0;
  if (lastMsg && lastMsg.senderId !== viewerId) {
    if (!lastRead || new Date(lastMsg.createdAt) > new Date(lastRead)) {
      unreadCount = await prisma.communityMessage.count({
        where: {
          conversationId: conv.id,
          senderId: { not: viewerId },
          ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
        },
      });
    }
  }

  const isMessageRequest = conv.status === 'pending' && conv.initiatedById !== viewerId;
  const canSendMessage = conv.status === 'active' || conv.initiatedById === viewerId;

  return {
    id: conv.id,
    updatedAt: conv.updatedAt,
    status: conv.status,
    isMessageRequest,
    canSendMessage,
    otherUser: other ? mapAuthorIdentity(other) : null,
    lastMessage: lastMsg
      ? {
          content: lastMsg.content,
          createdAt: lastMsg.createdAt,
          senderId: lastMsg.senderId,
          isMine: lastMsg.senderId === viewerId,
        }
      : null,
    unreadCount,
  };
}

router.get('/inbox/conversations', async (req, res, next) => {
  try {
    const folder = req.query.folder === 'requests' ? 'requests' : 'primary';
    const memberships = await prisma.communityConversationParticipant.findMany({
      where: { userId: req.user.id },
      select: { conversationId: true },
    });
    const ids = memberships.map((m) => m.conversationId);
    if (!ids.length) return res.json([]);

    const conversations = await prisma.communityConversation.findMany({
      where: { id: { in: ids } },
      include: {
        participants: {
          include: { user: { select: AUTHOR_SELECT } },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formatted = await Promise.all(
      conversations.map((c) => formatConversation(c, req.user.id))
    );
    const filtered = formatted.filter((c) =>
      folder === 'requests' ? c.isMessageRequest : !c.isMessageRequest
    );
    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/conversations', validate(dmSchema), async (req, res, next) => {
  try {
    const { participantId } = req.body;
    if (participantId === req.user.id) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }
    const target = await prisma.user.findUnique({ where: { id: participantId } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (await isBlockedBetween(req.user.id, participantId)) {
      return res.status(403).json({ error: 'You cannot message this user' });
    }

    const mutual = await isMutualFollow(req.user.id, participantId);
    const dmStatus = mutual ? 'active' : 'pending';

    const myConvs = await prisma.communityConversationParticipant.findMany({
      where: { userId: req.user.id },
      select: { conversationId: true },
    });
    const convIds = myConvs.map((c) => c.conversationId);

    let conversation = null;
    if (convIds.length) {
      const shared = await prisma.communityConversationParticipant.findMany({
        where: { userId: participantId, conversationId: { in: convIds } },
        select: { conversationId: true },
      });
      for (const { conversationId } of shared) {
        const parts = await prisma.communityConversationParticipant.findMany({
          where: { conversationId },
        });
        if (parts.length === 2) {
          conversation = await prisma.communityConversation.findUnique({
            where: { id: conversationId },
            include: {
              participants: { include: { user: { select: AUTHOR_SELECT } } },
              messages: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
          });
          break;
        }
      }
    }

    if (!conversation) {
      conversation = await prisma.communityConversation.create({
        data: {
          status: dmStatus,
          initiatedById: req.user.id,
          participants: {
            create: [{ userId: req.user.id }, { userId: participantId }],
          },
        },
        include: {
          participants: { include: { user: { select: AUTHOR_SELECT } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      if (dmStatus === 'pending') {
        await notifyWithActor({
          userId: participantId,
          actorId: req.user.id,
          type: 'community.message_request',
          title: 'sent you a message request',
          link: '/community/inbox?folder=requests',
        });
      }
    }

    res.status(201).json(await formatConversation(conversation, req.user.id));
  } catch (err) {
    next(err);
  }
});

router.get('/inbox/conversations/:id/messages', validate(idParam), async (req, res, next) => {
  try {
    const member = await prisma.communityConversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId: req.params.id, userId: req.user.id },
      },
    });
    if (!member) return res.status(403).json({ error: 'Forbidden' });

    const messages = await prisma.communityMessage.findMany({
      where: { conversationId: req.params.id },
      include: { sender: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    res.json(
      messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        messageType: m.messageType || 'text',
        content: m.content,
        mediaUrl: m.mediaUrl,
        createdAt: m.createdAt,
        sender: mapAuthorIdentity(m.sender),
        isMine: m.senderId === req.user.id,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/conversations/:id/messages', validate(createMessageSchema), async (req, res, next) => {
  try {
    const member = await prisma.communityConversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId: req.params.id, userId: req.user.id },
      },
    });
    if (!member) return res.status(403).json({ error: 'Forbidden' });

    const conv = await prisma.communityConversation.findUnique({
      where: { id: req.params.id },
      select: { status: true, initiatedById: true },
    });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (conv.status === 'pending' && conv.initiatedById !== req.user.id) {
      return res.status(403).json({
        error: 'Accept the message request before replying',
        requiresMessageRequestAccept: true,
      });
    }

    const messageType = req.body.messageType || 'text';
    const content =
      req.body.content ||
      (messageType === 'image' ? '📷 Photo' : messageType === 'audio' ? '🎤 Voice message' : messageType === 'emoji' ? req.body.content || '😀' : '');
    if (!content && !req.body.mediaUrl) {
      return res.status(400).json({ error: 'Message content or media is required' });
    }

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.communityMessage.create({
        data: {
          conversationId: req.params.id,
          senderId: req.user.id,
          messageType,
          content: content || '',
          mediaUrl: req.body.mediaUrl ?? null,
        },
        include: { sender: { select: AUTHOR_SELECT } },
      });
      await tx.communityConversation.update({
        where: { id: req.params.id },
        data: { updatedAt: new Date() },
      });
      return msg;
    });

    const participants = await prisma.communityConversationParticipant.findMany({
      where: { conversationId: req.params.id, userId: { not: req.user.id } },
    });
    for (const p of participants) {
      await notifyWithActor({
        userId: p.userId,
        actorId: req.user.id,
        type: 'community.message',
        title: 'sent you a message',
        message: content.slice(0, 120),
        link: `/community/inbox?c=${req.params.id}`,
      });
    }

    res.status(201).json({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      messageType: message.messageType,
      content: message.content,
      mediaUrl: message.mediaUrl,
      createdAt: message.createdAt,
      sender: mapAuthorIdentity(message.sender),
      isMine: true,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/conversations/:id/read', validate(idParam), async (req, res, next) => {
  try {
    await prisma.communityConversationParticipant.update({
      where: {
        conversationId_userId: { conversationId: req.params.id, userId: req.user.id },
      },
      data: { lastReadAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/conversations/:id/accept', validate(idParam), async (req, res, next) => {
  try {
    const conv = await prisma.communityConversation.findUnique({
      where: { id: req.params.id },
      include: {
        participants: { include: { user: { select: AUTHOR_SELECT } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!conv || conv.status !== 'pending' || conv.initiatedById === req.user.id) {
      return res.status(400).json({ error: 'No message request to accept' });
    }
    const member = conv.participants.find((p) => p.userId === req.user.id);
    if (!member) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.communityConversation.update({
      where: { id: conv.id },
      data: { status: 'active' },
      include: {
        participants: { include: { user: { select: AUTHOR_SELECT } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (conv.initiatedById) {
      await notifyWithActor({
        userId: conv.initiatedById,
        actorId: req.user.id,
        type: 'community.message_request_accepted',
        title: 'accepted your message request',
        link: `/community/inbox?c=${conv.id}`,
      });
    }
    res.json(await formatConversation(updated, req.user.id));
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/conversations/:id/decline', validate(idParam), async (req, res, next) => {
  try {
    const conv = await prisma.communityConversation.findUnique({
      where: { id: req.params.id },
    });
    if (!conv || conv.status !== 'pending' || conv.initiatedById === req.user.id) {
      return res.status(400).json({ error: 'No message request to decline' });
    }
    const member = await prisma.communityConversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId: req.params.id, userId: req.user.id },
      },
    });
    if (!member) return res.status(403).json({ error: 'Forbidden' });

    await prisma.communityConversation.delete({ where: { id: conv.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── Community profile ───────────────────────────────────────────────────────

router.get('/users/:userId/profile', async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
            coverUrl: true,
            bio: true,
            specialties: true,
            businessName: true,
          },
        },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMe = userId === req.user.id;
    if (!isMe && (await isBlockedBetween(req.user.id, userId))) {
      return res.status(403).json({ error: 'Unable to view this profile', isBlocked: true });
    }

    const blockedByMe = !isMe
      ? Boolean(
          await prisma.communityBlock.findUnique({
            where: {
              blockerId_blockedId: { blockerId: req.user.id, blockedId: userId },
            },
          })
        )
      : false;

    const isPrivate = await isUserPrivate(userId);
    const followStatus = await followStatusFor(req.user.id, userId);
    const canViewPosts = await canViewUserPosts(req.user.id, userId);
    const isMutual = isMe ? false : await isMutualFollow(req.user.id, userId);

    const [followersCount, followingCount, gymMembership, incomingRequests] = await Promise.all([
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
            include: { follower: { select: AUTHOR_SELECT } },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : Promise.resolve([]),
    ]);

    let posts = [];
    let mentionedPosts = [];
    if (canViewPosts) {
      const rows = await prisma.communityPost.findMany({
        where: { authorId: userId, groupId: null },
        include: POST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      posts = await enrichPosts(rows, req.user.id);
    }

    const tagRows = await prisma.communityPostTag.findMany({
      where: { taggedUserId: userId },
      include: { post: { include: POST_INCLUDE } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const taggedRaw = tagRows.map((t) => t.post).filter((p) => p && !p.groupId);
    if (taggedRaw.length) {
      mentionedPosts = await enrichPosts(taggedRaw, req.user.id);
    }

    res.json({
      user: mapAuthorIdentity(user),
      followersCount,
      followingCount,
      isFollowing: followStatus === 'accepted',
      followStatus,
      isPrivate,
      canViewPosts,
      isMe,
      isMutualFollow: isMutual,
      blockedByMe,
      posts,
      mentionedPosts,
      gym: gymMembership?.gym ?? null,
      incomingFollowRequests: incomingRequests.map((r) => ({
        id: r.id,
        follower: mapAuthorIdentity(r.follower),
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/me/profile', validate(profilePatchSchema), async (req, res, next) => {
  try {
    const data = {};
    for (const key of ['bio', 'displayName', 'avatarUrl', 'coverUrl']) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    const profile = await upsertProfile(req.user.id, data);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.get('/users/:userId/followers', async (req, res, next) => {
  try {
    const rows = await prisma.communityFollow.findMany({
      where: { followingId: req.params.userId, status: 'accepted' },
      include: { follower: { select: AUTHOR_SELECT } },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows.map((r) => mapAuthorIdentity(r.follower)));
  } catch (err) {
    next(err);
  }
});

router.get('/users/:userId/following', async (req, res, next) => {
  try {
    const rows = await prisma.communityFollow.findMany({
      where: { followerId: req.params.userId, status: 'accepted' },
      include: { following: { select: AUTHOR_SELECT } },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows.map((r) => mapAuthorIdentity(r.following)));
  } catch (err) {
    next(err);
  }
});

// ─── Block ───────────────────────────────────────────────────────────────────

router.post('/users/:userId/block', async (req, res, next) => {
  try {
    const blockedId = req.params.userId;
    if (blockedId === req.user.id) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }
    const target = await prisma.user.findUnique({ where: { id: blockedId } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    await prisma.$transaction(async (tx) => {
      await tx.communityBlock.upsert({
        where: {
          blockerId_blockedId: { blockerId: req.user.id, blockedId },
        },
        create: { blockerId: req.user.id, blockedId },
        update: {},
      });
      await tx.communityFollow.deleteMany({
        where: {
          OR: [
            { followerId: req.user.id, followingId: blockedId },
            { followerId: blockedId, followingId: req.user.id },
          ],
        },
      });
      const shared = await tx.communityConversationParticipant.findMany({
        where: { userId: req.user.id },
        select: { conversationId: true },
      });
      const convIds = shared.map((s) => s.conversationId);
      if (convIds.length) {
        const toDelete = await tx.communityConversationParticipant.findMany({
          where: { userId: blockedId, conversationId: { in: convIds } },
          select: { conversationId: true },
        });
        for (const { conversationId } of toDelete) {
          const parts = await tx.communityConversationParticipant.count({
            where: { conversationId },
          });
          if (parts === 2) {
            await tx.communityConversation.delete({ where: { id: conversationId } });
          }
        }
      }
    });

    res.json({ blocked: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:userId/block', async (req, res, next) => {
  try {
    const blockedId = req.params.userId;
    await prisma.communityBlock.deleteMany({
      where: { blockerId: req.user.id, blockedId },
    });
    res.json({ blocked: false });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.enrichPosts = enrichPosts;
module.exports.applyMentions = applyMentions;
module.exports.POST_INCLUDE = POST_INCLUDE;
module.exports.syncPostMedia = syncPostMedia;
module.exports.resolveMediaItemsFromBody = resolveMediaItemsFromBody;
module.exports.mapPostMediaItems = mapPostMediaItems;
module.exports.mediaItemSchema = mediaItemSchema;

router.use(require('./communityExtras'));
