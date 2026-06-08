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

module.exports = { buildCommentReactionMeta, mapComment, applyCommentReaction };
