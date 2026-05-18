/**
 * Community routes — posts, comments, likes.
 *
 *   GET    /api/community/posts
 *   POST   /api/community/posts                  body: { content, imageUrl? }
 *   GET    /api/community/posts/:id
 *   DELETE /api/community/posts/:id              (author only)
 *   POST   /api/community/posts/:id/like         (toggle)
 *   GET    /api/community/posts/:id/comments
 *   POST   /api/community/posts/:id/comments     body: { content }
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { emitNotification } = require('../lib/notifications');

const router = express.Router();
router.use(authMiddleware);

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });
const createPostSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000),
    imageUrl: z.string().url().optional(),
  }),
});
const createCommentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ content: z.string().min(1).max(1000) }),
});

const POST_INCLUDE = {
  author: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
  _count: { select: { comments: true, likes: true } },
};

router.get('/posts', async (req, res, next) => {
  try {
    const posts = await prisma.communityPost.findMany({
      include: POST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const userLikes = await prisma.communityPostLike.findMany({
      where: { userId: req.user.id, postId: { in: posts.map((p) => p.id) } },
      select: { postId: true },
    });
    const likedSet = new Set(userLikes.map((l) => l.postId));
    res.json(posts.map((p) => ({ ...p, likedByMe: likedSet.has(p.id) })));
  } catch (err) {
    next(err);
  }
});

router.post('/posts', validate(createPostSchema), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.create({
      data: { authorId: req.user.id, content: req.body.content, imageUrl: req.body.imageUrl ?? null },
      include: POST_INCLUDE,
    });
    res.status(201).json({ ...post, likedByMe: false });
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
    const liked = await prisma.communityPostLike.findUnique({
      where: { postId_userId: { postId: post.id, userId: req.user.id } },
    });
    res.json({ ...post, likedByMe: !!liked });
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

router.post('/posts/:id/like', validate(idParam), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const existing = await prisma.communityPostLike.findUnique({
      where: { postId_userId: { postId: post.id, userId: req.user.id } },
    });

    let likedByMe;
    if (existing) {
      await prisma.$transaction([
        prisma.communityPostLike.delete({ where: { id: existing.id } }),
        prisma.communityPost.update({
          where: { id: post.id },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
      likedByMe = false;
    } else {
      await prisma.$transaction([
        prisma.communityPostLike.create({ data: { postId: post.id, userId: req.user.id } }),
        prisma.communityPost.update({
          where: { id: post.id },
          data: { likesCount: { increment: 1 } },
        }),
      ]);
      likedByMe = true;
      if (post.authorId !== req.user.id) {
        emitNotification({
          userId: post.authorId,
          type: 'community.like',
          title: 'Someone liked your post',
          message: 'Tap to see who.',
          link: '/community',
        });
      }
    }

    const updated = await prisma.communityPost.findUnique({
      where: { id: post.id },
      include: POST_INCLUDE,
    });
    res.json({ ...updated, likedByMe });
  } catch (err) {
    next(err);
  }
});

router.get('/posts/:id/comments', validate(idParam), async (req, res, next) => {
  try {
    const comments = await prisma.communityComment.findMany({
      where: { postId: req.params.id },
      include: {
        author: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(comments);
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/comments', validate(createCommentSchema), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const comment = await prisma.communityComment.create({
      data: { postId: post.id, authorId: req.user.id, content: req.body.content },
      include: {
        author: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
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
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
