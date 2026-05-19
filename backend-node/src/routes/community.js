/**
 * Community — posts, comments, likes, reposts, follows, groups, inbox.
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { emitNotification } = require('../lib/notifications');
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
const createPostSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000),
    imageUrl: z.string().min(1).max(2048).optional(),
    videoUrl: z.string().min(1).max(2048).optional(),
    mediaType: z.enum(['image', 'video']).optional(),
    groupId: z.string().uuid().optional(),
  }),
});
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
  body: z.object({ content: z.string().min(1).max(1000) }),
});
const createGroupSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80),
    description: z.string().max(500).optional(),
    imageUrl: z.string().min(1).max(2048).optional(),
  }),
});
const createMessageSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ content: z.string().min(1).max(2000) }),
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
  _count: { select: { comments: true, likes: true, reposts: true } },
};

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

function emptyReactionCounts() {
  return Object.fromEntries(REACTION_EMOJIS.map((e) => [e, 0]));
}

function redactPost(post, viewerId, repostedSet, reactionMeta) {
  const meta = reactionMeta.get(post.id) || {
    counts: emptyReactionCounts(),
    myReaction: null,
    total: 0,
  };
  return {
    ...post,
    author: mapAuthorIdentity(post.author),
    likedByMe: !!meta.myReaction,
    myReaction: meta.myReaction,
    reactions: meta.counts,
    repostedByMe: repostedSet.has(post.id),
    commentsCount: post._count?.comments ?? 0,
    likesCount: meta.total ?? post.likesCount ?? post._count?.likes ?? 0,
    repostsCount: post.repostsCount ?? post._count?.reposts ?? 0,
    mediaType: post.mediaType || (post.videoUrl ? 'video' : post.imageUrl ? 'image' : null),
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
    if (await canViewUserPosts(viewerId, p.authorId)) visible.push(p);
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
  return visible.map((p) => redactPost(p, viewerId, repostedSet, reactionMeta));
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

    const posts = await prisma.communityPost.findMany({
      where,
      include: POST_INCLUDE,
      orderBy,
      take: 100,
    });

    res.json(await enrichPosts(posts, req.user.id));
  } catch (err) {
    next(err);
  }
});

router.post('/posts', validate(createPostSchema), async (req, res, next) => {
  try {
    const { content, imageUrl, videoUrl, mediaType, groupId } = req.body;
    if (groupId) {
      const member = await prisma.communityGroupMember.findUnique({
        where: { groupId_userId: { groupId, userId: req.user.id } },
      });
      if (!member) return res.status(403).json({ error: 'Join the group before posting' });
    }
    let resolvedMedia = mediaType ?? null;
    if (videoUrl) resolvedMedia = 'video';
    else if (imageUrl) resolvedMedia = 'image';
    const post = await prisma.communityPost.create({
      data: {
        authorId: req.user.id,
        content,
        imageUrl: imageUrl ?? null,
        videoUrl: videoUrl ?? null,
        mediaType: resolvedMedia,
        groupId: groupId ?? null,
      },
      include: POST_INCLUDE,
    });
    const [enriched] = await enrichPosts([post], req.user.id);
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
      emitNotification({
        userId: post.authorId,
        type: 'community.reaction',
        title: 'New reaction on your post',
        message: `Someone reacted with ${emoji}.`,
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
        emitNotification({
          userId: post.authorId,
          type: 'community.repost',
          title: 'Someone reposted your post',
          message: 'Your post is getting shared.',
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
    res.json(
      comments.map((c) => ({
        ...c,
        author: mapAuthorIdentity(c.author),
      }))
    );
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
    const comment = await prisma.communityComment.create({
      data: { postId: post.id, authorId: req.user.id, content: req.body.content },
      include: { author: { select: AUTHOR_SELECT } },
    });
    if (post.authorId !== req.user.id) {
      emitNotification({
        userId: post.authorId,
        type: 'community.comment',
        title: 'New comment on your post',
        message: req.body.content.slice(0, 120),
        link: '/community',
      });
    }
    res.status(201).json({
      ...comment,
      author: mapAuthorIdentity(comment.author),
    });
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
      emitNotification({
        userId: followingId,
        type: 'community.follow_request',
        title: 'New follow request',
        message: 'Someone requested to follow you.',
        link: '/community/profile',
      });
      return res.json({ following: false, followStatus: 'pending', requestSent: true });
    }

    await prisma.communityFollow.create({
      data: { followerId: req.user.id, followingId, status: 'accepted' },
    });
    emitNotification({
      userId: followingId,
      type: 'community.follow',
      title: 'New follower',
      message: 'Someone started following you.',
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
    emitNotification({
      userId: followerId,
      type: 'community.follow_accepted',
      title: 'Follow request accepted',
      message: 'Your follow request was accepted.',
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

router.get('/users/search', validate(searchQuery), async (req, res, next) => {
  try {
    const q = req.query.q.trim();
    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
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

router.get('/groups', async (req, res, next) => {
  try {
    const groups = await prisma.communityGroup.findMany({
      include: {
        owner: { select: AUTHOR_SELECT },
        _count: { select: { members: true, posts: true } },
        members: { where: { userId: req.user.id }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        imageUrl: g.imageUrl,
        ownerId: g.ownerId,
        owner: mapAuthorIdentity(g.owner),
        membersCount: g._count.members,
        postsCount: g._count.posts,
        joined: g.members.length > 0,
        createdAt: g.createdAt,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post('/groups', validate(createGroupSchema), async (req, res, next) => {
  try {
    const { name, description, imageUrl } = req.body;
    const group = await prisma.$transaction(async (tx) => {
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
      return g;
    });
    res.status(201).json(group);
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
    res.json({ joined: true });
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
    res.json({ joined: false });
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

  return {
    id: conv.id,
    updatedAt: conv.updatedAt,
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
    res.json(formatted);
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
          participants: {
            create: [{ userId: req.user.id }, { userId: participantId }],
          },
        },
        include: {
          participants: { include: { user: { select: AUTHOR_SELECT } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
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
        content: m.content,
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

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.communityMessage.create({
        data: {
          conversationId: req.params.id,
          senderId: req.user.id,
          content: req.body.content,
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
      emitNotification({
        userId: p.userId,
        type: 'community.message',
        title: 'New message',
        message: req.body.content.slice(0, 120),
        link: `/community/inbox?c=${req.params.id}`,
      });
    }

    res.status(201).json({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
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
    const isPrivate = await isUserPrivate(userId);
    const followStatus = await followStatusFor(req.user.id, userId);
    const canViewPosts = await canViewUserPosts(req.user.id, userId);

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
    if (canViewPosts) {
      const rows = await prisma.communityPost.findMany({
        where: { authorId: userId, groupId: null },
        include: POST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      posts = await enrichPosts(rows, req.user.id);
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
      posts,
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

module.exports = router;
