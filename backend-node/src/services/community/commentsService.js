const { prisma } = require('../../db');
const { mapAuthorIdentity } = require('../../lib/communityAuthors');
const { REACTION_EMOJIS } = require('./constants');
const { emptyReactionCounts } = require('./constants');

async function buildCommentReactionMeta(commentIds, viewerId) {
  const map = new Map();
  if (!commentIds.length) return map;
  for (const id of commentIds) {
    map.set(id, { counts: emptyReactionCounts(), myReaction: null, total: 0 });
  }

  const [groups, mine] = await Promise.all([
    prisma.communityCommentLike.groupBy({
      by: ['commentId', 'emoji'],
      where: { commentId: { in: commentIds } },
      _count: { _all: true },
    }),
    viewerId
      ? prisma.communityCommentLike.findMany({
          where: { commentId: { in: commentIds }, userId: viewerId },
          select: { commentId: true, emoji: true },
        })
      : [],
  ]);

  for (const row of groups) {
    const emoji = REACTION_EMOJIS.includes(row.emoji) ? row.emoji : 'like';
    const entry = map.get(row.commentId);
    if (!entry) continue;
    const n = row._count._all;
    entry.counts[emoji] = (entry.counts[emoji] || 0) + n;
    entry.total += n;
  }
  for (const row of mine) {
    const emoji = REACTION_EMOJIS.includes(row.emoji) ? row.emoji : 'like';
    const entry = map.get(row.commentId);
    if (entry) entry.myReaction = emoji;
  }
  return map;
}

function mapComment(comment, reactionMeta, { replyTo = null, repliesCount = 0 } = {}) {
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
    repliesCount,
    replyTo,
  };
}

function buildReplyMeta(comments) {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const directChildCount = new Map();
  for (const c of comments) {
    if (!c.parentId) continue;
    directChildCount.set(c.parentId, (directChildCount.get(c.parentId) || 0) + 1);
  }
  return { byId, directChildCount };
}

function mapComments(comments, reactionMeta) {
  const { byId, directChildCount } = buildReplyMeta(comments);
  return comments.map((c) => {
    const parent = c.parentId ? byId.get(c.parentId) : null;
    const replyTo = parent
      ? {
          id: parent.id,
          author: mapAuthorIdentity(parent.author),
        }
      : null;
    return mapComment(c, reactionMeta, {
      replyTo,
      repliesCount: directChildCount.get(c.id) || 0,
    });
  });
}

function mapSingleComment(comment, reactionMeta, parentComment = null) {
  const replyTo = parentComment
    ? {
        id: parentComment.id,
        author: mapAuthorIdentity(parentComment.author),
      }
    : null;
  return mapComment(comment, reactionMeta, { replyTo, repliesCount: 0 });
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

module.exports = {
  buildCommentReactionMeta,
  mapComment,
  mapComments,
  mapSingleComment,
  applyCommentReaction,
};
