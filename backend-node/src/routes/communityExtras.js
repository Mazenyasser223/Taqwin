/**
 * Community extras — privacy settings, stories, saves, rings, tags, profile sections.
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { validate } = require('../middleware/validate');
const {
  AUDIENCES,
  audienceAllows,
  getOrCreatePrivacySettings,
  canViewStory,
  canViewPost,
} = require('../lib/communityPrivacy');
const communityCore = require('./community');
const { notifyWithActor, notifyRingsOnNewContent } = require('../lib/communityNotify');
const { sendDirectMessage } = require('../lib/communityInbox');
const { resolveUserIdsFromText, mergeMentionIds } = require('../lib/communityMentions');
const { normalizeMediaUrl } = require('../lib/normalizeMediaUrl');

const router = express.Router();

const AUTHOR_SELECT = {
  id: true,
  email: true,
  role: true,
  profile: { select: { displayName: true, avatarUrl: true, coverUrl: true } },
};

const POST_INCLUDE = communityCore.POST_INCLUDE;

function authorHandle(email) {
  const local = (email || 'user').split('@')[0];
  return `@${local.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function mapAuthorIdentity(user) {
  if (!user) return user;
  return { ...user, handle: authorHandle(user.email) };
}

function mapPost(p) {
  return {
    ...p,
    author: mapAuthorIdentity(p.author),
    taggedUsers: (p.tags || []).map((t) => mapAuthorIdentity(t.taggedUser)),
    commentsCount: p._count?.comments ?? 0,
  };
}

const audienceSchema = z.enum(AUDIENCES);
const privacyPatchSchema = z.object({
  body: z.object({
    repostsAudience: audienceSchema.optional(),
    savedPostsAudience: audienceSchema.optional(),
    storyAudience: audienceSchema.optional(),
    mentionsAudience: audienceSchema.optional(),
    sharesAudience: audienceSchema.optional(),
    storyHideFromIds: z.array(z.string().uuid()).optional(),
  }),
});

const storyCreateSchema = z.object({
  body: z.object({
    mediaUrl: z.string().min(1).max(2048),
    mediaType: z.enum(['image', 'video']).optional(),
  }),
});

const postPatchSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      content: z.string().max(2000).optional(),
      imageUrl: z.string().min(1).max(2048).nullable().optional(),
      videoUrl: z.string().min(1).max(2048).nullable().optional(),
      mediaItems: z.array(communityCore.mediaItemSchema).max(20).optional(),
      commentsLocked: z.boolean().optional(),
      repostsLocked: z.boolean().optional(),
      visibility: audienceSchema.optional(),
      mentionUserIds: z.array(z.string().uuid()).optional(),
      mentionGymIds: z.array(z.string().uuid()).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.content === undefined && data.mediaItems === undefined) return;
      const hasText = data.content !== undefined ? data.content.trim().length > 0 : true;
      const hasMedia = (data.mediaItems?.length ?? 0) > 0;
      if (data.content !== undefined && data.mediaItems !== undefined && !hasText && !hasMedia) {
        ctx.addIssue({
          code: 'custom',
          message: 'Post must include text or media',
          path: ['content'],
        });
      }
      if (data.content !== undefined && data.mediaItems === undefined && !hasText) {
        ctx.addIssue({
          code: 'custom',
          message: 'Post must include text or media',
          path: ['content'],
        });
      }
    }),
};

const STORY_REACTION_EMOJIS = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

const storyReactSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ emoji: z.enum(STORY_REACTION_EMOJIS).optional() }),
});

const storyReplySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ content: z.string().min(1).max(500) }),
});

// ─── Privacy settings ──────────────────────────────────────────────────────────

router.get('/settings/privacy', async (req, res, next) => {
  try {
    const settings = await getOrCreatePrivacySettings(req.user.id);
    res.json({
      repostsAudience: settings.repostsAudience,
      savedPostsAudience: settings.savedPostsAudience,
      storyAudience: settings.storyAudience,
      mentionsAudience: settings.mentionsAudience,
      sharesAudience: settings.sharesAudience,
      storyHideFromIds: settings.storyHideFromIds || [],
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/settings/privacy', validate(privacyPatchSchema), async (req, res, next) => {
  try {
    const data = {};
    for (const key of [
      'repostsAudience',
      'savedPostsAudience',
      'storyAudience',
      'mentionsAudience',
      'sharesAudience',
      'storyHideFromIds',
    ]) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    const settings = await prisma.communityPrivacySettings.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...data },
      update: data,
    });
    res.json({
      repostsAudience: settings.repostsAudience,
      savedPostsAudience: settings.savedPostsAudience,
      storyAudience: settings.storyAudience,
      mentionsAudience: settings.mentionsAudience,
      sharesAudience: settings.sharesAudience,
      storyHideFromIds: settings.storyHideFromIds || [],
    });
  } catch (err) {
    next(err);
  }
});

// ─── Profile sections ────────────────────────────────────────────────────────

router.get('/users/:userId/reposts', async (req, res, next) => {
  try {
    const ownerId = req.params.userId;
    const settings = await getOrCreatePrivacySettings(ownerId);
    const allowed = await audienceAllows(req.user.id, ownerId, settings.repostsAudience);
    if (!allowed) return res.status(403).json({ error: 'Reposts are private' });

    const reposts = await prisma.communityPostRepost.findMany({
      where: { userId: ownerId },
      include: { post: { include: POST_INCLUDE } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const posts = [];
    for (const r of reposts) {
      if (await canViewPost(req.user.id, r.post)) posts.push(mapPost(r.post));
    }
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

router.get('/users/:userId/saved', async (req, res, next) => {
  try {
    const ownerId = req.params.userId;
    const settings = await getOrCreatePrivacySettings(ownerId);
    const allowed = await audienceAllows(req.user.id, ownerId, settings.savedPostsAudience);
    if (!allowed) return res.status(403).json({ error: 'Saved posts are private' });

    const saves = await prisma.communitySavedPost.findMany({
      where: { userId: ownerId },
      include: { post: { include: POST_INCLUDE } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const posts = [];
    for (const s of saves) {
      if (await canViewPost(req.user.id, s.post)) posts.push(mapPost(s.post));
    }
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

router.get('/users/:userId/mutual', async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const myFollowing = await prisma.communityFollow.findMany({
      where: { followerId: req.user.id, status: 'accepted' },
      select: { followingId: true },
    });
    const theirFollowing = await prisma.communityFollow.findMany({
      where: { followerId: userId, status: 'accepted' },
      select: { followingId: true },
    });
    const mySet = new Set(myFollowing.map((f) => f.followingId));
    const mutualIds = theirFollowing.map((f) => f.followingId).filter((id) => mySet.has(id) && id !== req.user.id && id !== userId);
    if (!mutualIds.length) return res.json([]);

    const users = await prisma.user.findMany({
      where: { id: { in: mutualIds } },
      select: AUTHOR_SELECT,
      take: 50,
    });
    res.json(users.map(mapAuthorIdentity));
  } catch (err) {
    next(err);
  }
});

// ─── Save / ring ─────────────────────────────────────────────────────────────

router.post('/posts/:id/save', async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const existing = await prisma.communitySavedPost.findUnique({
      where: { postId_userId: { postId: post.id, userId: req.user.id } },
    });
    if (existing) {
      await prisma.communitySavedPost.delete({ where: { id: existing.id } });
      return res.json({ saved: false });
    }
    await prisma.communitySavedPost.create({
      data: { postId: post.id, userId: req.user.id },
    });
    res.json({ saved: true });
  } catch (err) {
    next(err);
  }
});

router.get('/posts/:id/saved', async (req, res, next) => {
  try {
    const row = await prisma.communitySavedPost.findUnique({
      where: { postId_userId: { postId: req.params.id, userId: req.user.id } },
    });
    res.json({ saved: Boolean(row) });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:userId/ring', async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    if (targetUserId === req.user.id) return res.status(400).json({ error: 'Cannot ring yourself' });
    const existing = await prisma.communityPostRing.findUnique({
      where: {
        subscriberId_targetUserId: { subscriberId: req.user.id, targetUserId },
      },
    });
    if (existing) {
      await prisma.communityPostRing.delete({ where: { id: existing.id } });
      return res.json({ ringing: false });
    }
    await prisma.communityPostRing.create({
      data: { subscriberId: req.user.id, targetUserId },
    });
    res.json({ ringing: true });
  } catch (err) {
    next(err);
  }
});

router.get('/users/:userId/ring', async (req, res, next) => {
  try {
    const row = await prisma.communityPostRing.findUnique({
      where: {
        subscriberId_targetUserId: {
          subscriberId: req.user.id,
          targetUserId: req.params.userId,
        },
      },
    });
    res.json({ ringing: Boolean(row) });
  } catch (err) {
    next(err);
  }
});

// ─── Post update ─────────────────────────────────────────────────────────────

router.patch('/posts/:id', validate(postPatchSchema), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.authorId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const data = {};
    if (req.body.content !== undefined) data.content = req.body.content.trim();
    for (const key of ['commentsLocked', 'repostsLocked', 'visibility']) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    const mediaItems =
      req.body.mediaItems !== undefined
        ? req.body.mediaItems
        : req.body.imageUrl || req.body.videoUrl
          ? communityCore.resolveMediaItemsFromBody(req.body)
          : undefined;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) {
        await tx.communityPost.update({ where: { id: post.id }, data });
      }
      if (mediaItems !== undefined) {
        await communityCore.syncPostMedia(tx, post.id, mediaItems);
      }
      if (req.body.mentionUserIds !== undefined || req.body.mentionGymIds !== undefined) {
        await tx.communityPostTag.deleteMany({ where: { postId: post.id } });
        await tx.communityPostGymMention.deleteMany({ where: { postId: post.id } });
      }
    });

    if (req.body.mentionUserIds !== undefined || req.body.mentionGymIds !== undefined) {
      const contentText = req.body.content ?? post.content;
      const blocked = await prisma.communityBlock.findMany({
        where: { OR: [{ blockerId: req.user.id }, { blockedId: req.user.id }] },
        select: { blockerId: true, blockedId: true },
      });
      const blockedIds = blocked.map((b) =>
        b.blockerId === req.user.id ? b.blockedId : b.blockerId,
      );
      const fromContent = await resolveUserIdsFromText(contentText, req.user.id, blockedIds);
      const allUserIds = mergeMentionIds(req.body.mentionUserIds ?? [], fromContent);
      await communityCore.applyMentions(post.id, req.user.id, allUserIds, req.body.mentionGymIds ?? []);
    }

    const updated = await prisma.communityPost.findUnique({
      where: { id: post.id },
      include: POST_INCLUDE,
    });
    const [enriched] = await communityCore.enrichPosts([updated], req.user.id);
    res.json(enriched ?? mapPost(updated));
  } catch (err) {
    next(err);
  }
});

// ─── Stories ─────────────────────────────────────────────────────────────────

router.get('/stories/feed', async (req, res, next) => {
  try {
    const now = new Date();
    await prisma.communityStory.deleteMany({ where: { expiresAt: { lte: now } } });
    const following = await prisma.communityFollow.findMany({
      where: { followerId: req.user.id, status: 'accepted' },
      select: { followingId: true },
    });
    const authorIds = [req.user.id, ...following.map((f) => f.followingId)];
    const stories = await prisma.communityStory.findMany({
      where: { authorId: { in: authorIds }, expiresAt: { gt: now } },
      include: {
        author: { select: AUTHOR_SELECT },
        views: { where: { viewerId: req.user.id } },
        reactions: { where: { userId: req.user.id } },
        _count: { select: { views: true, reactions: true, replies: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const byAuthor = new Map();
    for (const s of stories) {
      const settings = await getOrCreatePrivacySettings(s.authorId);
      if (!(await canViewStory(req.user.id, s.authorId, settings))) continue;
      if (!byAuthor.has(s.authorId)) {
        byAuthor.set(s.authorId, {
          author: mapAuthorIdentity(s.author),
          stories: [],
          hasUnseen: false,
        });
      }
      const bucket = byAuthor.get(s.authorId);
      const seen = s.views.length > 0;
      if (!seen) bucket.hasUnseen = true;
      bucket.stories.push({
        id: s.id,
        mediaUrl: normalizeMediaUrl(s.mediaUrl),
        mediaType: s.mediaType,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        seen,
        viewCount: s._count?.views ?? 0,
        reactionCount: s._count?.reactions ?? 0,
        replyCount: s._count?.replies ?? 0,
        myReaction: s.reactions?.[0]?.emoji ?? null,
        isMine: s.authorId === req.user.id,
      });
    }
    res.json([...byAuthor.values()]);
  } catch (err) {
    next(err);
  }
});

/** Active stories for one user (for profile / feed avatar — not limited to following feed). */
router.get('/users/:userId/stories', async (req, res, next) => {
  try {
    const authorId = req.params.userId;
    const now = new Date();
    const settings = await getOrCreatePrivacySettings(authorId);
    if (!(await canViewStory(req.user.id, authorId, settings))) {
      return res.json(null);
    }
    const author = await prisma.user.findUnique({
      where: { id: authorId },
      select: AUTHOR_SELECT,
    });
    if (!author) return res.status(404).json({ error: 'User not found' });

    const stories = await prisma.communityStory.findMany({
      where: { authorId, expiresAt: { gt: now } },
      include: {
        views: { where: { viewerId: req.user.id } },
        reactions: { where: { userId: req.user.id } },
        _count: { select: { views: true, reactions: true, replies: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!stories.length) return res.json(null);

    let hasUnseen = false;
    const mapped = stories.map((s) => {
      const seen = s.views.length > 0;
      if (!seen) hasUnseen = true;
      return {
        id: s.id,
        mediaUrl: normalizeMediaUrl(s.mediaUrl),
        mediaType: s.mediaType,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        seen,
        viewCount: s._count?.views ?? 0,
        reactionCount: s._count?.reactions ?? 0,
        replyCount: s._count?.replies ?? 0,
        myReaction: s.reactions?.[0]?.emoji ?? null,
        isMine: s.authorId === req.user.id,
      };
    });

    res.json({
      author: mapAuthorIdentity(author),
      stories: mapped,
      hasUnseen,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/stories', validate(storyCreateSchema), async (req, res, next) => {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const story = await prisma.communityStory.create({
      data: {
        authorId: req.user.id,
        mediaUrl: req.body.mediaUrl,
        mediaType: req.body.mediaType || 'image',
        expiresAt,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });
    await notifyRingsOnNewContent(req.user.id, '/community', 'story');
    res.status(201).json({
      ...story,
      author: mapAuthorIdentity(story.author),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/stories/:id/view', async (req, res, next) => {
  try {
    const story = await prisma.communityStory.findUnique({ where: { id: req.params.id } });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    const settings = await getOrCreatePrivacySettings(story.authorId);
    if (!(await canViewStory(req.user.id, story.authorId, settings))) {
      return res.status(403).json({ error: 'Story not available' });
    }
    await prisma.communityStoryView.upsert({
      where: { storyId_viewerId: { storyId: story.id, viewerId: req.user.id } },
      create: { storyId: story.id, viewerId: req.user.id },
      update: { viewedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/stories/:id', async (req, res, next) => {
  try {
    const story = await prisma.communityStory.findUnique({ where: { id: req.params.id } });
    if (!story) return res.status(404).json({ error: 'Not found' });
    if (story.authorId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await prisma.communityStory.delete({ where: { id: story.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/stories/:id/viewers', async (req, res, next) => {
  try {
    const story = await prisma.communityStory.findUnique({ where: { id: req.params.id } });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (story.authorId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const [views, reactions] = await Promise.all([
      prisma.communityStoryView.findMany({
        where: { storyId: story.id },
        include: { viewer: { select: AUTHOR_SELECT } },
        orderBy: { viewedAt: 'desc' },
        take: 100,
      }),
      prisma.communityStoryReaction.findMany({
        where: { storyId: story.id },
        select: { userId: true, emoji: true },
      }),
    ]);
    const reactionByUser = new Map(reactions.map((r) => [r.userId, r.emoji]));
    res.json(
      views.map((v) => ({
        id: v.viewer.id,
        viewedAt: v.viewedAt,
        reactionEmoji: reactionByUser.get(v.viewer.id) ?? null,
        loved: ['love', 'like'].includes(reactionByUser.get(v.viewer.id) || ''),
        user: mapAuthorIdentity(v.viewer),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/stories/:id/react', validate(storyReactSchema), async (req, res, next) => {
  try {
    const story = await prisma.communityStory.findUnique({ where: { id: req.params.id } });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    const settings = await getOrCreatePrivacySettings(story.authorId);
    if (!(await canViewStory(req.user.id, story.authorId, settings))) {
      return res.status(403).json({ error: 'Story not available' });
    }
    const emoji = req.body.emoji || 'love';
    await prisma.communityStoryReaction.upsert({
      where: { storyId_userId: { storyId: story.id, userId: req.user.id } },
      create: { storyId: story.id, userId: req.user.id, emoji },
      update: { emoji },
    });
    if (story.authorId !== req.user.id) {
      await notifyWithActor({
        userId: story.authorId,
        actorId: req.user.id,
        type: 'community.story_reaction',
        title: 'reacted to your story',
        link: '/community',
      });
    }
    res.json({ ok: true, emoji });
  } catch (err) {
    next(err);
  }
});

router.delete('/stories/:id/react', async (req, res, next) => {
  try {
    await prisma.communityStoryReaction.deleteMany({
      where: { storyId: req.params.id, userId: req.user.id },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/stories/:id/replies', async (req, res, next) => {
  try {
    const story = await prisma.communityStory.findUnique({ where: { id: req.params.id } });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    const settings = await getOrCreatePrivacySettings(story.authorId);
    const isAuthor = story.authorId === req.user.id;
    if (!isAuthor && !(await canViewStory(req.user.id, story.authorId, settings))) {
      return res.status(403).json({ error: 'Story not available' });
    }
    const replies = await prisma.communityStoryReply.findMany({
      where: { storyId: story.id },
      include: { user: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    res.json(
      replies.map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt,
        user: mapAuthorIdentity(r.user),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/stories/:id/replies', validate(storyReplySchema), async (req, res, next) => {
  try {
    const story = await prisma.communityStory.findUnique({ where: { id: req.params.id } });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    const settings = await getOrCreatePrivacySettings(story.authorId);
    if (!(await canViewStory(req.user.id, story.authorId, settings))) {
      return res.status(403).json({ error: 'Story not available' });
    }
    const replyText = req.body.content.trim();
    const reply = await prisma.communityStoryReply.create({
      data: { storyId: story.id, userId: req.user.id, content: replyText },
      include: { user: { select: AUTHOR_SELECT } },
    });
    if (story.authorId !== req.user.id) {
      try {
        await sendDirectMessage({
          senderId: req.user.id,
          recipientId: story.authorId,
          content: replyText,
          messageType: 'story_reply',
          mediaUrl: story.mediaUrl,
        });
      } catch {
        await notifyWithActor({
          userId: story.authorId,
          actorId: req.user.id,
          type: 'community.story_reply',
          title: 'replied to your story',
          link: '/community/inbox',
        });
      }
    }
    res.status(201).json({
      id: reply.id,
      content: reply.content,
      createdAt: reply.createdAt,
      user: mapAuthorIdentity(reply.user),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
