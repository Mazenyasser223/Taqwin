/**
 * Community — posts, comments, likes, reposts, follows, groups, inbox.
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { notifyWithActor, notifyRingsOnNewContent, displayNameFromUser } = require('../../lib/communityNotify');
const { resolveUserIdsFromText, mergeMentionIds, normalizeMentionToken } = require('../../lib/communityMentions');
const { upsertProfile } = require('../../lib/profileUpsert');
const { profileNameSearchFilter } = require('../../lib/profile');
const { mapAuthorIdentity } = require('../../lib/communityAuthors');
const { moderateContent, moderateText, moderateTextFast, moderateImage, ModerationError } = require('../../lib/moderation');
const { bumpProfileCacheGeneration, bumpInboxCacheGeneration, bumpGroupsCacheGeneration } = require('../../services/community/cacheGeneration');
const { AUTHOR_SELECT, FEED_AUTHOR_SELECT, POST_INCLUDE, mediaItemSchema } = require('../../services/community/constants');
const {
  communityPostLink,
  enrichPosts,
  buildPostInteractionPatch,
  resolveMentionUserIds,
  savePostMentions,
  notifyPostMentions,
} = require('../../services/community/postsService');
const { assertMediaItemsStored } = require('../../lib/mediaStorageVerify');
const { resolveMediaItemsFromBody, syncPostMedia } = require('../../services/community/postMedia');
const {
  buildCommentReactionMeta,
  mapComment,
  mapComments,
  mapSingleComment,
  applyCommentReaction,
} = require('../../services/community/commentsService');
const { getOrCreateDirectConversation, isBlockedBetween } = require('../../lib/communityInbox');
const {
  isUserPrivate,
  canViewUserPosts,
  profileFollowCounts,
  getBlockedUserIds,
  getFollowersList,
  getFollowingList,
  getFollowRelation,
} = require('../../services/community/followService');
const { getFeedPosts, invalidateFeedCacheForUser, bumpFeedCacheGeneration } = require('../../services/community/feedService');
const { createPollForPost, voteOnPoll } = require('../../services/community/pollService');
const {
  pinProfilePost,
  unpinProfilePost,
  pinGroupPost,
  unpinGroupPost,
  getGroupFeaturedPosts,
} = require('../../services/community/pinService');
const { searchCommunityUsers, discoverCommunityUsers } = require('../../services/community/browseService');
const { getCommunityUserProfile, getProfileMentionPosts } = require('../../services/community/profileService');
const {
  listConversations,
  loadConversationForMember,
  getConversationMessages,
  setConversationStarred,
  setMessageStarred,
  listStarredMessages,
} = require('../../services/community/inboxService');
const {
  listGroups,
  getGroup: getGroupForViewer,
  formatGroupRow,
  loadGroupRow,
} = require('../../services/community/groupsService');
const { batchPresenceForViewer } = require('../../services/community/storiesService');

const router = express.Router();
router.use(authMiddleware);

const noStore = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

/** Read the preferred language from the request (sent by the frontend). */
function reqLang(req) {
  const h = (req.headers['accept-language'] || '').toLowerCase();
  return h.startsWith('en') ? 'en' : 'ar';
}

/** Convert a ModerationError into a structured 422 response. Returns true if handled. */
function handleModerationError(err, res, lang) {
  if (!(err instanceof ModerationError)) return false;
  res.status(422).json({
    error: err.messageFor(lang || 'ar'),
    code: 'content_moderated',
    category: err.category,
  });
  return true;
}

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const feedQuery = z.object({
  query: z.object({
    feed: z.enum(['for_you', 'following', 'coaches', 'athletes', 'gyms', 'trending']).optional(),
    groupId: z.string().uuid().optional(),
    authorId: z.string().uuid().optional(),
    refresh: z.enum(['0', '1', 'true', 'false']).optional(),
    excludeIds: z.string().max(4000).optional(),
    debug: z.enum(['0', '1', 'true', 'false']).optional(),
  }),
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
      locationName: z.string().max(200).optional(),
      poll: z
        .object({
          options: z.array(z.string().min(1).max(80)).min(2).max(4),
        })
        .optional(),
    })
    .superRefine((data, ctx) => {
      const hasText = (data.content || '').trim().length > 0;
      const hasLegacy = Boolean(data.imageUrl || data.videoUrl);
      const hasMulti = (data.mediaItems?.length ?? 0) > 0;
      const hasPoll = (data.poll?.options?.length ?? 0) >= 2;
      if (!hasText && !hasLegacy && !hasMulti && !hasPoll) {
        ctx.addIssue({
          code: 'custom',
          message: 'Post must include text, media, or a poll',
          path: ['content'],
        });
      }
      if (hasPoll && !hasText) {
        ctx.addIssue({
          code: 'custom',
          message: 'Poll posts need a question in the text field',
          path: ['content'],
        });
      }
    }),
};
const pollVoteSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ optionId: z.string().uuid() }),
});
const reactSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ emoji: z.enum(['like', 'love', 'haha', 'wow', 'sad', 'angry']) }),
});
const profilePatchSchema = z.object({
  body: z.object({
    bio: z.string().max(2000).optional(),
    displayName: z.string().min(1).max(80).optional(),
    communityAvatarUrl: z.string().min(1).max(2048).nullable().optional(),
    coverUrl: z.string().min(1).max(2048).nullable().optional(),
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
const messageIdParam = z.object({ params: z.object({ messageId: z.string().uuid() }) });
const updateCommentSchema = z.object({
  params: z.object({ commentId: z.string().uuid() }),
  body: z.object({ content: z.string().min(1).max(1000) }),
});
const commentReactSchema = z.object({
  params: z.object({ commentId: z.string().uuid() }),
  body: z.object({ emoji: z.enum(['like', 'love', 'haha', 'wow', 'sad', 'angry']) }),
});
const createGroupSchema = {
  body: z.object({
    name: z.string().min(2).max(80),
    description: z.string().max(500).optional(),
    imageUrl: z.string().min(1).max(2048).optional(),
  }),
};
const updateGroupSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(2).max(80).optional(),
    description: z.string().max(500).nullable().optional(),
    imageUrl: z.string().min(1).max(2048).nullable().optional(),
    postPermission: z.enum(['all_members', 'admins_only']).optional(),
    invitePermission: z.enum(['admins_only', 'all_members']).optional(),
    joinPolicy: z.enum(['open', 'approval']).optional(),
    postsVisibility: z.enum(['public', 'members_only']).optional(),
    membersVisibility: z.enum(['all_members', 'admins_only']).optional(),
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

// ─── Posts ───────────────────────────────────────────────────────────────────

router.get('/posts', validate(feedQuery), async (req, res, next) => {
  try {
    const feed = req.query.feed || 'for_you';
    const groupId = req.query.groupId;
    const authorId = req.query.authorId;

    if (groupId) {
      const group = await prisma.communityGroup.findUnique({ where: { id: groupId } });
      if (!group) return res.status(404).json({ error: 'Group not found' });
      const member = await prisma.communityGroupMember.findUnique({
        where: { groupId_userId: { groupId, userId: req.user.id } },
      });
      if (!canViewGroupPosts(group, member)) {
        return res.status(403).json({ error: 'Join this group to view its feed' });
      }
    }

    const skipCache = req.query.refresh === '1' || req.query.refresh === 'true';
    const excludeIds = req.query.excludeIds;
    const debug = req.query.debug === '1' || req.query.debug === 'true';
    const result = await getFeedPosts(req.user.id, {
      feed,
      groupId,
      authorId,
      skipCache,
      excludeIds,
      debug,
    });

    const isForYouPaginated =
      feed === 'for_you' && !groupId && !authorId && (excludeIds || debug);
    if (isForYouPaginated && result?.posts) {
      return res.json({
        posts: result.posts,
        hasMore: Boolean(result.hasMore),
        nextExcludeIds: result.nextExcludeIds ?? '',
        ...(result.debug ? { debug: result.debug } : {}),
      });
    }

    const posts = result?.posts ?? result;
    res.json(posts);
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
      mentionGymIds: rawMentionGymIds,
      locationName: rawLocationName,
    } = req.body;
    const content = (rawContent || '').trim();
    const mediaItems = resolveMediaItemsFromBody(req.body);

    const mentionGymIds = rawMentionGymIds ?? [];
    const locationName = rawLocationName?.trim() || null;

    // ── Content moderation ──────────────────────────────────────────────────
    const _postLang = reqLang(req);
    const _imageUrls = mediaItems.filter((m) => m.mediaType === 'image').map((m) => m.url);
    const _videoUrls = mediaItems.filter((m) => m.mediaType === 'video').map((m) => m.url);
    console.log('[moderation] post check — text:', content.slice(0, 40), '| images:', _imageUrls.length, '| videos:', _videoUrls.length);
    try {
      await moderateContent({
        text: content,
        imageUrls: _imageUrls,
        videoUrls: _videoUrls,
        lang: _postLang,
      });
    } catch (err) {
      if (handleModerationError(err, res, _postLang)) return;
      throw err;
    }
    // ────────────────────────────────────────────────────────────────────────

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

    try {
      await assertMediaItemsStored(mediaItems, req.user.id);
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Uploaded media is not available in storage',
        code: 'media_not_stored',
      });
    }

    const blockedIds = [...(await getBlockedUserIds(req.user.id))];
    const fromContent = await resolveUserIdsFromText(content, req.user.id, blockedIds);
    const allMentionUserIds = mergeMentionIds(mentionUserIds ?? [], fromContent);
    const validMentionUserIds = await resolveMentionUserIds(req.user.id, allMentionUserIds);

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
          locationName,
        },
      });
      await syncPostMedia(tx, created.id, mediaItems);
      await savePostMentions(tx, created.id, validMentionUserIds, mentionGymIds ?? []);
      if (req.body.poll?.options?.length >= 2) {
        await createPollForPost(tx, created.id, req.body.poll.options);
      }
      return tx.communityPost.findUnique({
        where: { id: created.id },
        include: POST_INCLUDE,
      });
    }, { timeout: mediaItems.length ? 20_000 : 15_000 });

    if (!post?.media?.length && mediaItems.length) {
      throw new Error('Post media was not saved to the database');
    }

    await notifyPostMentions(post.id, req.user.id, validMentionUserIds);
    if (!groupId) {
      await notifyRingsOnNewContent(req.user.id, '/community', 'post');
    }
    const refreshed = await prisma.communityPost.findUnique({
      where: { id: post.id },
      include: POST_INCLUDE,
    });
    const [enriched] = await enrichPosts([refreshed], req.user.id);
    void invalidateFeedCacheForUser(req.user.id);
    void bumpProfileCacheGeneration();
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
      void notifyWithActor({
        userId: post.authorId,
        actorId: userId,
        type: 'community.reaction',
        title: `reacted with ${emoji} to your post`,
        link: communityPostLink(post.id),
      });
    }
  }
}

router.post('/posts/:id/react', validate(reactSchema), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    await applyReaction(post, req.user.id, req.body.emoji);
    void bumpFeedCacheGeneration();
    void bumpProfileCacheGeneration();
    const patch = await buildPostInteractionPatch(post.id, req.user.id);
    res.json(patch);
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/poll/vote', validate(pollVoteSchema), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const result = await voteOnPoll(post.id, req.user.id, req.body.optionId);
    if (result.notFound) return res.status(404).json({ error: 'Poll not found' });
    if (result.ended) return res.status(400).json({ error: 'Poll has ended' });
    if (result.invalidOption) return res.status(400).json({ error: 'Invalid poll option' });
    void bumpFeedCacheGeneration();
    res.json({ poll: result.poll });
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/pin/profile', validate(idParam), async (req, res, next) => {
  try {
    const result = await pinProfilePost(req.params.id, req.user.id);
    if (result.notFound) return res.status(404).json({ error: 'Post not found' });
    if (result.forbidden) return res.status(403).json({ error: 'Forbidden' });
    if (result.limit) {
      return res.status(400).json({ error: `You can pin up to ${result.max} posts on your profile` });
    }
    void bumpFeedCacheGeneration();
    void bumpProfileCacheGeneration();
    res.json({ pinned: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/posts/:id/pin/profile', validate(idParam), async (req, res, next) => {
  try {
    const result = await unpinProfilePost(req.params.id, req.user.id);
    if (result.notFound) return res.status(404).json({ error: 'Post not found' });
    if (result.forbidden) return res.status(403).json({ error: 'Forbidden' });
    void bumpFeedCacheGeneration();
    void bumpProfileCacheGeneration();
    res.json({ pinned: false });
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/pin/group', validate(idParam), async (req, res, next) => {
  try {
    const result = await pinGroupPost(req.params.id, req.user.id);
    if (result.notFound) return res.status(404).json({ error: 'Post not found' });
    if (result.forbidden) return res.status(403).json({ error: 'Only group admins can feature posts' });
    if (result.limit) {
      return res.status(400).json({ error: `Groups can feature up to ${result.max} posts` });
    }
    void bumpFeedCacheGeneration();
    void bumpGroupsCacheGeneration();
    res.json({ featured: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/posts/:id/pin/group', validate(idParam), async (req, res, next) => {
  try {
    const result = await unpinGroupPost(req.params.id, req.user.id);
    if (result.notFound) return res.status(404).json({ error: 'Post not found' });
    if (result.forbidden) return res.status(403).json({ error: 'Only group admins can unfeature posts' });
    void bumpFeedCacheGeneration();
    void bumpGroupsCacheGeneration();
    res.json({ featured: false });
  } catch (err) {
    next(err);
  }
});

router.get('/groups/:id/featured-posts', validate(idParam), async (req, res, next) => {
  try {
    const result = await getGroupFeaturedPosts(req.user.id, req.params.id);
    if (result.notFound) return res.status(404).json({ error: 'Group not found' });
    if (result.forbidden) return res.status(403).json({ error: 'Join the group to view featured posts' });
    res.json(result.data ?? []);
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/like', validate(idParam), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    await applyReaction(post, req.user.id, 'like');
    void bumpFeedCacheGeneration();
    void bumpProfileCacheGeneration();
    const patch = await buildPostInteractionPatch(post.id, req.user.id);
    res.json(patch);
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
        void notifyWithActor({
          userId: post.authorId,
          actorId: req.user.id,
          type: 'community.repost',
          title: 'reposted your post',
          link: communityPostLink(post.id),
        });
      }
    }

    void bumpFeedCacheGeneration();
    void bumpProfileCacheGeneration();
    const patch = await buildPostInteractionPatch(post.id, req.user.id);
    res.json(patch);
  } catch (err) {
    next(err);
  }
});

/** Post author only — who reposted this post. */
router.get('/posts/:id/reposts', validate(idParam), async (req, res, next) => {
  try {
    const post = await prisma.communityPost.findUnique({
      where: { id: req.params.id },
      select: { authorId: true },
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the post author can view reposters' });
    }

    const reposts = await prisma.communityPostRepost.findMany({
      where: { postId: req.params.id },
      include: { user: { select: FEED_AUTHOR_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(
      reposts.map((r) => ({
        id: r.id,
        userId: r.userId,
        createdAt: r.createdAt,
        user: mapAuthorIdentity(r.user),
      })),
    );
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
    res.json(await mapComments(comments, reactionMeta, req.user.id));
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

    // ── Content moderation ──────────────────────────────────────────────────
    const _commentLang = reqLang(req);
    try {
      await moderateTextFast(req.body.content, _commentLang);
    } catch (err) {
      if (handleModerationError(err, res, _commentLang)) return;
      throw err;
    }
    // ────────────────────────────────────────────────────────────────────────

    let parentId = null;
    let parentComment = null;
    if (req.body.parentId) {
      parentComment = await prisma.communityComment.findUnique({ where: { id: req.body.parentId } });
      if (!parentComment || parentComment.postId !== post.id) {
        return res.status(400).json({ error: 'Invalid reply target' });
      }
      parentId = parentComment.id;
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
    if (parentComment && parentComment.authorId !== req.user.id) {
      notifyTargets.add(parentComment.authorId);
    }
    for (const userId of notifyTargets) {
      void notifyWithActor({
        userId,
        actorId: req.user.id,
        type: parentId ? 'community.comment_reply' : 'community.comment',
        title: parentId ? 'replied to a comment' : 'commented on your post',
        message: req.body.content.slice(0, 120),
        link: communityPostLink(post.id, comment.id),
      });
    }

    void bumpFeedCacheGeneration();
    void bumpProfileCacheGeneration();
    const reactionMeta = await buildCommentReactionMeta([comment.id], req.user.id);
    res.status(201).json(await mapSingleComment(comment, reactionMeta, parentComment, req.user.id));
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
    void bumpFeedCacheGeneration();
    void bumpProfileCacheGeneration();
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
      void notifyWithActor({
        userId: comment.authorId,
        actorId: req.user.id,
        type: 'community.comment_reaction',
        title: `reacted with ${req.body.emoji} to your comment`,
        link: communityPostLink(comment.postId, comment.id),
      });
    }

    const reactionMeta = await buildCommentReactionMeta([comment.id], req.user.id);
    res.json(mapComment(comment, reactionMeta));
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
      void bumpProfileCacheGeneration();
      const [targetCounts, viewerCounts] = await Promise.all([
        profileFollowCounts(followingId),
        profileFollowCounts(req.user.id),
      ]);
      return res.json({
        following: false,
        followStatus: 'none',
        requestSent: false,
        targetCounts,
        viewerCounts,
      });
    }

    const targetPrivate = await isUserPrivate(followingId);
    if (targetPrivate) {
      await prisma.communityFollow.create({
        data: { followerId: req.user.id, followingId, status: 'pending' },
      });
      void bumpProfileCacheGeneration();
      await notifyWithActor({
        userId: followingId,
        actorId: req.user.id,
        type: 'community.follow_request',
        title: 'requested to follow you',
        link: `/community/browse/${req.user.id}`,
      });
      const [targetCounts, viewerCounts] = await Promise.all([
        profileFollowCounts(followingId),
        profileFollowCounts(req.user.id),
      ]);
      return res.json({
        following: false,
        followStatus: 'pending',
        requestSent: true,
        targetCounts,
        viewerCounts,
      });
    }

    await prisma.communityFollow.create({
      data: { followerId: req.user.id, followingId, status: 'accepted' },
    });
    void bumpProfileCacheGeneration();
    await notifyWithActor({
      userId: followingId,
      actorId: req.user.id,
      type: 'community.follow',
      title: 'started following you',
      link: `/community/browse/${req.user.id}`,
    });
    const [targetCounts, viewerCounts] = await Promise.all([
      profileFollowCounts(followingId),
      profileFollowCounts(req.user.id),
    ]);
    res.json({
      following: true,
      followStatus: 'accepted',
      requestSent: false,
      targetCounts,
      viewerCounts,
    });
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
      link: `/community/browse/${req.user.id}`,
    });
    const profileCounts = await profileFollowCounts(req.user.id);
    res.json({ following: true, followStatus: 'accepted', profileCounts });
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
    const profileCounts = await profileFollowCounts(req.user.id);
    res.json({ following: false, followStatus: 'none', profileCounts });
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
              ...profileNameSearchFilter(q).OR,
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

router.get('/users/browse/discover', async (req, res, next) => {
  try {
    const results = await discoverCommunityUsers(req.user.id);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.get('/users/search', validate(searchQuery), async (req, res, next) => {
  try {
    const q = req.query.q.trim();
    if (!q.length) return res.json([]);
    const results = await searchCommunityUsers(req.user.id, q);
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

function memberIsActive(membership) {
  return membership && (membership.status || 'accepted') === 'accepted';
}

async function notifyGroupAdmins(group, actorId, payload) {
  const rows = await prisma.communityGroupMember.findMany({
    where: {
      groupId: group.id,
      status: 'accepted',
      OR: [{ role: 'admin' }, { userId: group.ownerId }],
    },
    select: { userId: true },
  });
  const recipientIds = new Set([group.ownerId, ...rows.map((r) => r.userId)]);
  await Promise.all(
    [...recipientIds].map((userId) =>
      notifyWithActor({ userId, actorId, ...payload }),
    ),
  );
}

function canPostToGroup(group, membership) {
  if (!memberIsActive(membership)) return false;
  if ((group.postPermission || 'all_members') === 'admins_only') {
    return isGroupAdmin(group, membership);
  }
  return true;
}

function canInviteToGroup(group, membership) {
  if (!memberIsActive(membership)) return false;
  if ((group.invitePermission || 'admins_only') === 'all_members') return true;
  return isGroupAdmin(group, membership);
}

function canViewGroupPosts(group, membership) {
  if ((group.postsVisibility || 'members_only') === 'public') return true;
  return memberIsActive(membership);
}

function canViewGroupMembersList(group, membership, viewerId) {
  if (isGroupOwner(group, viewerId)) return true;
  if (!memberIsActive(membership)) return false;
  if ((group.membersVisibility || 'all_members') === 'all_members') return true;
  return isGroupAdmin(group, membership);
}

/** Build member list and remove rows pointing at deleted users. */
async function buildGroupMembersList(group) {
  const rows = await prisma.communityGroupMember.findMany({
    where: { groupId: group.id, status: 'accepted' },
    orderBy: { joinedAt: 'asc' },
  });
  const userIds = [...new Set(rows.map((m) => m.userId))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: AUTHOR_SELECT })
    : [];
  const usersById = new Map(users.map((u) => [u.id, u]));

  const orphanRowIds = rows.filter((m) => !usersById.has(m.userId)).map((m) => m.id);
  if (orphanRowIds.length) {
    await prisma.communityGroupMember.deleteMany({ where: { id: { in: orphanRowIds } } });
  }

  const payload = [];
  const seenOwner = rows.some((m) => isGroupOwner(group, m.userId) && usersById.has(m.userId));
  if (!seenOwner) {
    const owner = await prisma.user.findUnique({
      where: { id: group.ownerId },
      select: AUTHOR_SELECT,
    });
    if (owner) {
      payload.push({
        id: `owner-${group.id}`,
        userId: group.ownerId,
        role: 'owner',
        joinedAt: group.createdAt,
        user: mapAuthorIdentity(owner),
      });
    }
  }
  for (const m of rows) {
    const user = usersById.get(m.userId);
    if (!user) continue;
    payload.push({
      id: m.id,
      userId: m.userId,
      role: isGroupOwner(group, m.userId) ? 'owner' : m.role,
      joinedAt: m.joinedAt,
      user: mapAuthorIdentity(user),
    });
  }
  return payload;
}

async function getGroupMembership(groupId, userId) {
  return prisma.communityGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: true },
  });
}

router.get('/groups', noStore, async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json(await listGroups(req.user.id, { q }));
  } catch (err) {
    next(err);
  }
});

router.get('/groups/:id', noStore, validate(idParam), async (req, res, next) => {
  try {
    const group = await getGroupForViewer(req.user.id, req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
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
        data: { groupId: g.id, userId: req.user.id, role: 'admin', status: 'accepted' },
      });
      return g.id;
    });
    const group = await loadGroupRow(createdId, req.user.id);
    void bumpGroupsCacheGeneration();
    res.status(201).json(await formatGroupRow(group, req.user.id));
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
    const { name, description, imageUrl, postPermission, invitePermission, joinPolicy, postsVisibility, membersVisibility } =
      req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (postPermission !== undefined) data.postPermission = postPermission;
    if (invitePermission !== undefined) data.invitePermission = invitePermission;
    if (joinPolicy !== undefined) data.joinPolicy = joinPolicy;
    if (postsVisibility !== undefined) data.postsVisibility = postsVisibility;
    if (membersVisibility !== undefined) data.membersVisibility = membersVisibility;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    await prisma.communityGroup.update({ where: { id: group.id }, data });
    void bumpGroupsCacheGeneration();
    const refreshed = await loadGroupRow(group.id, req.user.id);
    res.json(await formatGroupRow(refreshed, req.user.id));
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
    void bumpGroupsCacheGeneration();
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
    if (!canViewGroupMembersList(group, membership, req.user.id)) {
      return res.status(403).json({
        error:
          membership && (group.membersVisibility || 'all_members') === 'admins_only'
            ? 'Only admins can view the member list'
            : 'Join the group to view members',
      });
    }
    res.json(await buildGroupMembersList(group));
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
    const existing = await prisma.communityGroupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: targetId } },
    });
    if (existing?.status === 'accepted') {
      return res.status(400).json({ error: 'User is already in this group' });
    }
    if (existing?.status === 'pending') {
      return res.status(400).json({ error: 'Invite already sent' });
    }
    await prisma.communityGroupMember.create({
      data: {
        groupId: group.id,
        userId: targetId,
        role: 'member',
        status: 'pending',
        invitedBy: req.user.id,
      },
    });
    await notifyWithActor({
      userId: targetId,
      actorId: req.user.id,
      type: 'community.group_invite',
      title: 'invited you to a group',
      message: `invited you to join "${group.name}"`,
      link: `/community/groups?g=${group.id}`,
    });
    void bumpGroupsCacheGeneration();
    res.status(201).json({ invited: true, pending: true, groupId: group.id });
  } catch (err) {
    next(err);
  }
});

router.post('/groups/:id/invite/accept', validate(idParam), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const row = await prisma.communityGroupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: req.user.id } },
    });
    if (!row || row.status !== 'pending' || !row.invitedBy) {
      return res.status(404).json({ error: 'Group invite not found' });
    }
    await prisma.communityGroupMember.update({
      where: { id: row.id },
      data: { status: 'accepted' },
    });
    void bumpGroupsCacheGeneration();
    const refreshed = await loadGroupRow(group.id, req.user.id);
    res.json(await formatGroupRow(refreshed, req.user.id));
  } catch (err) {
    next(err);
  }
});

router.post('/groups/:id/invite/decline', validate(idParam), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const deleted = await prisma.communityGroupMember.deleteMany({
      where: { groupId: group.id, userId: req.user.id, status: 'pending', invitedBy: { not: null } },
    });
    if (!deleted.count) return res.status(404).json({ error: 'Group invite not found' });
    void bumpGroupsCacheGeneration();
    res.json({ declined: true });
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
    void bumpGroupsCacheGeneration();
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
    void bumpGroupsCacheGeneration();
    res.json({ removed: true });
  } catch (err) {
    next(err);
  }
});

router.get('/groups/:id/join-requests', validate(idParam), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const membership = await getGroupMembership(group.id, req.user.id);
    if (!isGroupAdmin(group, membership)) {
      return res.status(403).json({ error: 'Only admins can view join requests' });
    }
    const rows = await prisma.communityGroupMember.findMany({
      where: { groupId: group.id, status: 'pending', invitedBy: null },
      orderBy: { joinedAt: 'asc' },
      include: { user: { select: AUTHOR_SELECT } },
    });
    res.json(
      rows.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: mapAuthorIdentity(m.user),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/groups/:id/join-requests/:userId/accept', validate(groupMemberIdParam), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const membership = await getGroupMembership(group.id, req.user.id);
    if (!isGroupAdmin(group, membership)) {
      return res.status(403).json({ error: 'Only admins can approve join requests' });
    }
    const targetId = req.params.userId;
    const row = await prisma.communityGroupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: targetId } },
    });
    if (!row || row.status !== 'pending' || row.invitedBy) {
      return res.status(404).json({ error: 'Join request not found' });
    }
    await prisma.communityGroupMember.update({
      where: { id: row.id },
      data: { status: 'accepted' },
    });
    const requester = await prisma.user.findUnique({
      where: { id: targetId },
      select: AUTHOR_SELECT,
    });
    await notifyWithActor({
      userId: targetId,
      actorId: req.user.id,
      type: 'community.group_join_accepted',
      title: 'approved your request',
      message: `You joined "${group.name}"`,
      link: `/community/groups?g=${group.id}`,
    });
    res.json({
      approved: true,
      groupId: group.id,
      groupName: group.name,
      user: requester ? mapAuthorIdentity(requester) : null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/groups/:id/join-requests/:userId/decline', validate(groupMemberIdParam), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const membership = await getGroupMembership(group.id, req.user.id);
    if (!isGroupAdmin(group, membership)) {
      return res.status(403).json({ error: 'Only admins can decline join requests' });
    }
    const deleted = await prisma.communityGroupMember.deleteMany({
      where: {
        groupId: group.id,
        userId: req.params.userId,
        status: 'pending',
        invitedBy: null,
      },
    });
    if (!deleted.count) return res.status(404).json({ error: 'Join request not found' });
    void bumpGroupsCacheGeneration();
    res.json({ declined: true });
  } catch (err) {
    next(err);
  }
});

router.post('/groups/:id/join', validate(idParam), async (req, res, next) => {
  try {
    const group = await prisma.communityGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.ownerId === req.user.id) {
      return res.status(400).json({ error: 'You already own this group' });
    }
    const existing = await prisma.communityGroupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: req.user.id } },
    });
    if (existing?.status === 'accepted') {
      return res.status(400).json({ error: 'Already a member' });
    }
    if (existing?.status === 'pending') {
      if (existing.invitedBy) {
        return res.status(400).json({ error: 'Accept your group invite from notifications first' });
      }
      return res.status(400).json({ error: 'Join request already sent' });
    }
    const policy = group.joinPolicy || 'open';
    if (policy === 'approval') {
      await prisma.communityGroupMember.create({
        data: {
          groupId: group.id,
          userId: req.user.id,
          role: 'member',
          status: 'pending',
          invitedBy: null,
        },
      });
      await notifyGroupAdmins(group, req.user.id, {
        type: 'community.group_join_request',
        title: 'requested to join your group',
        message: `requested to join "${group.name}"`,
        link: `/community/groups?g=${group.id}`,
      });
      void bumpGroupsCacheGeneration();
      const refreshed = await loadGroupRow(group.id, req.user.id);
      const formatted = await formatGroupRow(refreshed, req.user.id);
      return res.status(201).json({ joinRequested: true, joinPending: true, ...formatted });
    }
    await prisma.communityGroupMember.create({
      data: { groupId: group.id, userId: req.user.id, role: 'member', status: 'accepted' },
    });
    void bumpGroupsCacheGeneration();
    const refreshed = await loadGroupRow(group.id, req.user.id);
    res.json(await formatGroupRow(refreshed, req.user.id));
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
    void bumpGroupsCacheGeneration();
    const refreshed = await loadGroupRow(group.id, req.user.id);
    res.json(await formatGroupRow(refreshed, req.user.id));
  } catch (err) {
    next(err);
  }
});

// ─── Inbox ───────────────────────────────────────────────────────────────────

router.get('/inbox/conversations', noStore, async (req, res, next) => {
  try {
    const folder = req.query.folder === 'requests' ? 'requests' : 'primary';
    const list = await listConversations(req.user.id, folder);
    res.json(list);
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

    const { conversation, created } = await getOrCreateDirectConversation(req.user.id, participantId);
    void bumpInboxCacheGeneration();

    const formatted = await loadConversationForMember(conversation.id, req.user.id);
    if (!formatted) return res.status(500).json({ error: 'Failed to load conversation' });
    res.status(created ? 201 : 200).json(formatted);
  } catch (err) {
    next(err);
  }
});

const createGroupConvSchema = {
  body: z.object({
    name: z.string().min(1).max(100),
    participantIds: z.array(z.string().uuid()).min(1).max(49),
  }),
};

router.post('/inbox/conversations/group', validate(createGroupConvSchema), async (req, res, next) => {
  try {
    const { name, participantIds } = req.body;
    const unique = [...new Set(participantIds)].filter((id) => id !== req.user.id);
    if (!unique.length) return res.status(400).json({ error: 'Add at least one other member' });

    const existing = await prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    if (existing.length !== unique.length) {
      return res.status(400).json({ error: 'One or more users not found' });
    }

    const allParticipantIds = [req.user.id, ...unique];
    const conversation = await prisma.communityConversation.create({
      data: {
        status: 'active',
        isGroup: true,
        name,
        initiatedById: req.user.id,
        participants: {
          create: allParticipantIds.map((uid) => ({ userId: uid, role: uid === req.user.id ? 'admin' : 'member' })),
        },
      },
      include: {
        participants: { include: { user: { select: AUTHOR_SELECT } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    for (const uid of unique) {
      await notifyWithActor({
        userId: uid,
        actorId: req.user.id,
        type: 'community.message',
        title: `added you to group "${name}"`,
        link: `/community/inbox?c=${conversation.id}`,
      }).catch(() => {});
    }

    void bumpInboxCacheGeneration();
    const formatted = await loadConversationForMember(conversation.id, req.user.id);
    if (!formatted) return res.status(500).json({ error: 'Failed to load conversation' });
    res.status(201).json(formatted);
  } catch (err) {
    next(err);
  }
});

// ─── Group management helpers ────────────────────────────────────────────────

async function postSystemMessage(conversationId, text) {
  try {
    // Use the group initiator as the system sender (satisfies the FK constraint)
    const conv = await prisma.communityConversation.findUnique({
      where: { id: conversationId },
      select: { initiatedById: true, participants: { select: { userId: true }, take: 1 } },
    });
    const senderId = conv?.initiatedById ?? conv?.participants?.[0]?.userId;
    if (!senderId) return;
    await prisma.communityMessage.create({
      data: { conversationId, senderId, messageType: 'system', content: text },
    });
    await prisma.communityConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  } catch {
    // system messages are best-effort
  }
}

async function requireGroupAdmin(conversationId, userId) {
  const p = await prisma.communityConversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!p) return { error: 'Not a member', status: 403 };
  if (p.role !== 'admin') return { error: 'Admin only', status: 403 };
  return { ok: true };
}

async function requireGroupMember(conversationId, userId) {
  const p = await prisma.communityConversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!p) return { error: 'Not a member', status: 403 };
  return { ok: true, role: p.role };
}

const updateGroupConvSchema = {
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    bio: z.string().max(300).optional().nullable(),
    avatarUrl: z.string().url().optional().nullable(),
    canAddMembers: z.enum(['all', 'admins']).optional(),
    canSendMessages: z.enum(['all', 'admins']).optional(),
  }),
};

// PATCH /inbox/conversations/:id/group — update group info/settings (admin only)
router.patch('/inbox/conversations/:id/group', validate({ ...idParam, ...updateGroupConvSchema }), async (req, res, next) => {
  try {
    const conv = await prisma.communityConversation.findUnique({ where: { id: req.params.id } });
    if (!conv || !conv.isGroup) return res.status(404).json({ error: 'Group not found' });

    const check = await requireGroupAdmin(req.params.id, req.user.id);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const { name, bio, avatarUrl, canAddMembers, canSendMessages } = req.body;
    await prisma.communityConversation.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(canAddMembers !== undefined ? { canAddMembers } : {}),
        ...(canSendMessages !== undefined ? { canSendMessages } : {}),
      },
      include: {
        participants: { include: { user: { select: AUTHOR_SELECT } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    void bumpInboxCacheGeneration();
    const formatted = await loadConversationForMember(req.params.id, req.user.id);
    if (!formatted) return res.status(500).json({ error: 'Failed to load conversation' });
    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// POST /inbox/conversations/:id/group/members — add members
router.post('/inbox/conversations/:id/group/members', validate(idParam), async (req, res, next) => {
  try {
    const conv = await prisma.communityConversation.findUnique({ where: { id: req.params.id } });
    if (!conv || !conv.isGroup) return res.status(404).json({ error: 'Group not found' });

    const myP = await prisma.communityConversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: req.params.id, userId: req.user.id } },
    });
    if (!myP) return res.status(403).json({ error: 'Not a member' });
    if (conv.canAddMembers === 'admins' && myP.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add members' });
    }

    const userIds = req.body.userIds;
    if (!Array.isArray(userIds) || !userIds.length) {
      return res.status(400).json({ error: 'userIds required' });
    }

    const actor = await prisma.user.findUnique({ where: { id: req.user.id }, select: AUTHOR_SELECT });
    const actorName = displayNameFromUser(actor);

    for (const uid of userIds) {
      const already = await prisma.communityConversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: req.params.id, userId: uid } },
      });
      if (already) continue;
      await prisma.communityConversationParticipant.create({
        data: { conversationId: req.params.id, userId: uid, role: 'member' },
      }).catch(() => {});
      const added = await prisma.user.findUnique({ where: { id: uid }, select: AUTHOR_SELECT });
      const addedName = displayNameFromUser(added);
      await postSystemMessage(req.params.id, `${actorName} added ${addedName}`);
    }

    void bumpInboxCacheGeneration();
    const formatted = await loadConversationForMember(req.params.id, req.user.id);
    if (!formatted) return res.status(500).json({ error: 'Failed to load conversation' });
    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// DELETE /inbox/conversations/:id/group/members/:userId — remove member (admin) or leave (self)
router.delete('/inbox/conversations/:id/group/members/:userId', validate(idParam), async (req, res, next) => {
  try {
    const conv = await prisma.communityConversation.findUnique({ where: { id: req.params.id } });
    if (!conv || !conv.isGroup) return res.status(404).json({ error: 'Group not found' });

    const isSelf = req.params.userId === req.user.id;
    if (!isSelf) {
      const check = await requireGroupAdmin(req.params.id, req.user.id);
      if (check.error) return res.status(check.status).json({ error: check.error });
    } else {
      const check = await requireGroupMember(req.params.id, req.user.id);
      if (check.error) return res.status(check.status).json({ error: check.error });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: req.params.userId }, select: AUTHOR_SELECT });
    const targetName = displayNameFromUser(targetUser);

    await prisma.communityConversationParticipant.deleteMany({
      where: { conversationId: req.params.id, userId: req.params.userId },
    });

    if (isSelf) {
      await postSystemMessage(req.params.id, `${targetName} left the group`);
    } else {
      const actor = await prisma.user.findUnique({ where: { id: req.user.id }, select: AUTHOR_SELECT });
      await postSystemMessage(req.params.id, `${displayNameFromUser(actor)} removed ${targetName}`);
    }

    // If the removed user was the only admin, promote the oldest remaining member
    if (!isSelf) {
      const admins = await prisma.communityConversationParticipant.findMany({
        where: { conversationId: req.params.id, role: 'admin' },
      });
      if (!admins.length) {
        const oldest = await prisma.communityConversationParticipant.findFirst({
          where: { conversationId: req.params.id },
          orderBy: { id: 'asc' },
        });
        if (oldest) {
          await prisma.communityConversationParticipant.update({
            where: { id: oldest.id },
            data: { role: 'admin' },
          });
          const promoted = await prisma.user.findUnique({ where: { id: oldest.userId }, select: AUTHOR_SELECT });
          await postSystemMessage(req.params.id, `${displayNameFromUser(promoted)} is now an admin`);
        }
      }
    }

    void bumpInboxCacheGeneration();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /inbox/conversations/:id/group/members/:userId/role — set admin/member
router.patch('/inbox/conversations/:id/group/members/:userId/role', validate(idParam), async (req, res, next) => {
  try {
    const conv = await prisma.communityConversation.findUnique({ where: { id: req.params.id } });
    if (!conv || !conv.isGroup) return res.status(404).json({ error: 'Group not found' });

    const check = await requireGroupAdmin(req.params.id, req.user.id);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const newRole = req.body.role;
    if (newRole !== 'admin' && newRole !== 'member') {
      return res.status(400).json({ error: 'role must be admin or member' });
    }

    await prisma.communityConversationParticipant.updateMany({
      where: { conversationId: req.params.id, userId: req.params.userId },
      data: { role: newRole },
    });

    const target = await prisma.user.findUnique({ where: { id: req.params.userId }, select: AUTHOR_SELECT });
    const targetName = displayNameFromUser(target);
    if (newRole === 'admin') {
      await postSystemMessage(req.params.id, `${targetName} is now an admin`);
    } else {
      await postSystemMessage(req.params.id, `${targetName} is no longer an admin`);
    }

    void bumpInboxCacheGeneration();
    const formatted = await loadConversationForMember(req.params.id, req.user.id);
    if (!formatted) return res.status(500).json({ error: 'Failed to load conversation' });
    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

async function loadConversationForMemberRoute(conversationId, userId) {
  return loadConversationForMember(conversationId, userId);
}

router.get('/inbox/conversations/:id', validate(idParam), async (req, res, next) => {
  try {
    const formatted = await loadConversationForMemberRoute(req.params.id, req.user.id);
    if (!formatted) return res.status(404).json({ error: 'Conversation not found' });
    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

router.get('/inbox/conversations/:id/messages', noStore, validate(idParam), async (req, res, next) => {
  try {
    const sinceRaw = req.query.since;
    const sinceDate =
      typeof sinceRaw === 'string' && sinceRaw.trim()
        ? new Date(sinceRaw)
        : null;
    const sinceValid = sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate : null;

    const payload = await getConversationMessages(req.user.id, req.params.id, sinceValid);
    if (payload?.forbidden) return res.status(403).json({ error: 'Forbidden' });
    res.json(payload);
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

    const convRows = await prisma.$queryRawUnsafe(
      `SELECT status,
              initiated_by_id AS "initiatedById",
              COALESCE(is_group, false) AS "isGroup",
              COALESCE(can_send_messages, 'all') AS "canSendMessages"
       FROM community_conversations
       WHERE id = $1`,
      req.params.id,
    );
    const conv = convRows[0];
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!conv.isGroup && conv.status === 'pending' && conv.initiatedById !== req.user.id) {
      return res.status(403).json({
        error: 'Accept the message request before replying',
        requiresMessageRequestAccept: true,
      });
    }
    if (conv.isGroup && conv.canSendMessages === 'admins') {
      const roleRows = await prisma.$queryRawUnsafe(
        `SELECT role FROM community_conversation_participants
         WHERE conversation_id = $1 AND user_id = $2`,
        req.params.id,
        req.user.id,
      );
      const role = roleRows[0]?.role ?? 'member';
      if (role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can send messages in this group' });
      }
    }

    const messageType = req.body.messageType || 'text';
    const content =
      req.body.content ||
      (messageType === 'image' ? '📷 Photo' : messageType === 'audio' ? '🎤 Voice message' : messageType === 'emoji' ? req.body.content || '😀' : '');
    if (!content && !req.body.mediaUrl) {
      return res.status(400).json({ error: 'Message content or media is required' });
    }

    // ── Content moderation (fast path for DMs) ───────────────────────────────
    const _msgLang = reqLang(req);
    try {
      if (messageType === 'text' || messageType === 'emoji') {
        await moderateTextFast(req.body.content, _msgLang);
      } else if (messageType === 'image' && req.body.mediaUrl) {
        // Images already uploaded; async image scan — do not block send
        void moderateImage(req.body.mediaUrl, _msgLang).catch(() => {});
      }
    } catch (err) {
      if (handleModerationError(err, res, _msgLang)) return;
      throw err;
    }
    // ────────────────────────────────────────────────────────────────────────

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.communityMessage.create({
        data: {
          conversationId: req.params.id,
          senderId: req.user.id,
          messageType,
          content: content || '',
          mediaUrl: req.body.mediaUrl ?? null,
        },
        include: { sender: { select: FEED_AUTHOR_SELECT } },
      });
      await tx.communityConversation.update({
        where: { id: req.params.id },
        data: { updatedAt: new Date() },
      });
      return msg;
    });

    void bumpInboxCacheGeneration();

    const participants = await prisma.communityConversationParticipant.findMany({
      where: { conversationId: req.params.id, userId: { not: req.user.id } },
    });
    for (const p of participants) {
      void notifyWithActor({
        userId: p.userId,
        actorId: req.user.id,
        type: 'community.message',
        title: 'sent you a message',
        message: content.slice(0, 120),
        link: `/community/inbox?c=${req.params.id}`,
      }).catch(() => {});
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
      status: 'sent',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/conversations/:id/star', validate(idParam), async (req, res, next) => {
  try {
    const result = await setConversationStarred(req.params.id, req.user.id, true);
    if (result.notFound) return res.status(404).json({ error: 'Conversation not found' });
    void bumpInboxCacheGeneration();
    res.json(result.data);
  } catch (err) {
    next(err);
  }
});

router.delete('/inbox/conversations/:id/star', validate(idParam), async (req, res, next) => {
  try {
    const result = await setConversationStarred(req.params.id, req.user.id, false);
    if (result.notFound) return res.status(404).json({ error: 'Conversation not found' });
    void bumpInboxCacheGeneration();
    res.json(result.data);
  } catch (err) {
    next(err);
  }
});

router.get('/inbox/starred-messages', noStore, async (req, res, next) => {
  try {
    const rows = await listStarredMessages(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/messages/:messageId/star', validate(messageIdParam), async (req, res, next) => {
  try {
    const result = await setMessageStarred(req.params.messageId, req.user.id, true);
    if (result.notFound) return res.status(404).json({ error: 'Message not found' });
    if (result.forbidden) return res.status(403).json({ error: 'Forbidden' });
    void bumpInboxCacheGeneration();
    res.json(result.data);
  } catch (err) {
    next(err);
  }
});

router.delete('/inbox/messages/:messageId/star', validate(messageIdParam), async (req, res, next) => {
  try {
    const result = await setMessageStarred(req.params.messageId, req.user.id, false);
    if (result.notFound) return res.status(404).json({ error: 'Message not found' });
    if (result.forbidden) return res.status(403).json({ error: 'Forbidden' });
    void bumpInboxCacheGeneration();
    res.json(result.data);
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/conversations/:id/read', validate(idParam), async (req, res, next) => {
  try {
    const conv = await prisma.communityConversation.findUnique({
      where: { id: req.params.id },
      include: { participants: { select: { userId: true } } },
    });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const now = new Date();
    const conversationIds = new Set([conv.id]);

    if (!conv.isGroup) {
      const other = conv.participants.find((p) => p.userId !== req.user.id);
      if (other) {
        const siblingRows = await prisma.communityConversation.findMany({
          where: {
            isGroup: false,
            participants: { some: { userId: req.user.id } },
            AND: { participants: { some: { userId: other.userId } } },
          },
          select: { id: true },
        });
        for (const row of siblingRows) conversationIds.add(row.id);
      }
    }

    await prisma.communityConversationParticipant.updateMany({
      where: {
        userId: req.user.id,
        conversationId: { in: [...conversationIds] },
      },
      data: { lastReadAt: now },
    });
    void bumpInboxCacheGeneration();
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

    await prisma.communityConversation.update({
      where: { id: conv.id },
      data: { status: 'active' },
      include: {
        participants: { include: { user: { select: AUTHOR_SELECT } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (conv.initiatedById) {
      void notifyWithActor({
        userId: conv.initiatedById,
        actorId: req.user.id,
        type: 'community.message_request_accepted',
        title: 'accepted your message request',
        link: `/community/inbox?c=${conv.id}`,
      }).catch(() => {});
    }
    void bumpInboxCacheGeneration();
    const formatted = await loadConversationForMember(conv.id, req.user.id);
    if (!formatted) return res.status(500).json({ error: 'Failed to load conversation' });
    res.json(formatted);
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
    void bumpInboxCacheGeneration();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── Presence (online / last seen) ───────────────────────────────────────────

const presenceQuery = z.object({
  query: z.object({ userIds: z.string().min(1).max(4000) }),
});

router.post('/presence/heartbeat', async (req, res, next) => {
  try {
    const now = new Date();
    await prisma.user.update({
      where: { id: req.user.id },
      data: { lastSeenAt: now },
    });
    res.json({ ok: true, lastSeenAt: now.toISOString(), isOnline: true });
  } catch (err) {
    next(err);
  }
});

router.get('/presence', validate(presenceQuery), async (req, res, next) => {
  try {
    const ids = String(req.query.userIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const presence = await batchPresenceForViewer(req.user.id, ids);
    res.json({ presence });
  } catch (err) {
    next(err);
  }
});

// ─── Community profile ───────────────────────────────────────────────────────

router.get('/users/:userId/profile', async (req, res, next) => {
  try {
    const result = await getCommunityUserProfile(req.user.id, req.params.userId);
    if (result.notFound) return res.status(404).json({ error: 'User not found' });
    if (result.blocked) {
      return res.status(403).json({ error: 'Unable to view this profile', isBlocked: true });
    }
    res.json(result.data);
  } catch (err) {
    next(err);
  }
});

router.get('/users/:userId/profile/mentions', async (req, res, next) => {
  try {
    const posts = await getProfileMentionPosts(req.user.id, req.params.userId);
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

router.patch('/users/me/profile', validate(profilePatchSchema), async (req, res, next) => {
  try {
    const data = {};
    for (const key of ['bio', 'displayName', 'communityAvatarUrl', 'coverUrl']) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    // ── Content moderation ──────────────────────────────────────────────
    const _profileLang = reqLang(req);
    try {
      if (data.displayName) await moderateText(data.displayName, _profileLang);
      if (data.bio) await moderateTextFast(data.bio, _profileLang);
      if (data.communityAvatarUrl) await moderateImage(data.communityAvatarUrl, _profileLang);
      if (data.coverUrl) await moderateImage(data.coverUrl, _profileLang);
    } catch (err) {
      if (handleModerationError(err, res, _profileLang)) return;
      throw err;
    }
    // ────────────────────────────────────────────────────────────────────

    const profile = await upsertProfile(req.user.id, req.user.role, data);
    void bumpProfileCacheGeneration();
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.get('/users/:userId/followers', async (req, res, next) => {
  try {
    const rows = await getFollowersList(req.params.userId, req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/users/:userId/following', async (req, res, next) => {
  try {
    const rows = await getFollowingList(req.params.userId, req.user.id);
    res.json(rows);
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

router.use(require('../communityExtras'));

module.exports = router;
