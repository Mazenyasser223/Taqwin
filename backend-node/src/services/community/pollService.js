const { prisma } = require('../../db');

const POLL_INCLUDE = {
  options: { orderBy: { sortOrder: 'asc' } },
  votes: { select: { userId: true, optionId: true } },
};

function normalizePollOptions(raw = []) {
  const labels = raw
    .map((o) => (typeof o === 'string' ? o : o?.label || '').trim())
    .filter(Boolean);
  return [...new Set(labels)].slice(0, 4);
}

async function createPollForPost(tx, postId, optionLabels) {
  const labels = normalizePollOptions(optionLabels);
  if (labels.length < 2) {
    throw new Error('Poll must have at least 2 options');
  }
  return tx.communityPoll.create({
    data: {
      postId,
      options: {
        create: labels.map((label, i) => ({ label, sortOrder: i })),
      },
    },
    include: { options: true },
  });
}

function mapPoll(poll, viewerId) {
  if (!poll) return null;
  const myVote = viewerId ? (poll.votes || []).find((v) => v.userId === viewerId) : null;
  const totalVotes = (poll.options || []).reduce((sum, o) => sum + (o.votesCount || 0), 0);
  const ended = poll.endsAt ? new Date(poll.endsAt) <= new Date() : false;
  return {
    id: poll.id,
    postId: poll.postId,
    endsAt: poll.endsAt,
    ended,
    totalVotes,
    myOptionId: myVote?.optionId ?? null,
    options: (poll.options || []).map((o) => ({
      id: o.id,
      label: o.label,
      votesCount: o.votesCount || 0,
      percent: totalVotes > 0 ? Math.round((100 * (o.votesCount || 0)) / totalVotes) : 0,
    })),
  };
}

async function buildPollMeta(postIds, viewerId) {
  const map = new Map();
  if (!postIds.length) return map;
  const polls = await prisma.communityPoll.findMany({
    where: { postId: { in: postIds } },
    include: POLL_INCLUDE,
  });
  for (const poll of polls) {
    map.set(poll.postId, mapPoll(poll, viewerId));
  }
  return map;
}

async function voteOnPoll(post, userId, optionId) {
  const poll = await prisma.communityPoll.findUnique({
    where: { postId: post.id },
    include: POLL_INCLUDE,
  });
  if (!poll) return { notFound: true };
  if (poll.endsAt && new Date(poll.endsAt) <= new Date()) return { ended: true };
  const option = poll.options.find((o) => o.id === optionId);
  if (!option) return { invalidOption: true };

  const existing = await prisma.communityPollVote.findUnique({
    where: { pollId_userId: { pollId: poll.id, userId } },
  });

  await prisma.$transaction(async (tx) => {
    if (existing) {
      if (existing.optionId === optionId) return;
      await tx.communityPollOption.update({
        where: { id: existing.optionId },
        data: { votesCount: { decrement: 1 } },
      });
      await tx.communityPollVote.update({
        where: { id: existing.id },
        data: { optionId },
      });
      await tx.communityPollOption.update({
        where: { id: optionId },
        data: { votesCount: { increment: 1 } },
      });
    } else {
      await tx.communityPollVote.create({
        data: { pollId: poll.id, optionId, userId },
      });
      await tx.communityPollOption.update({
        where: { id: optionId },
        data: { votesCount: { increment: 1 } },
      });
    }
  });

  const refreshed = await prisma.communityPoll.findUnique({
    where: { postId: post.id },
    include: POLL_INCLUDE,
  });
  return { poll: mapPoll(refreshed, userId) };
}

module.exports = {
  createPollForPost,
  mapPoll,
  buildPollMeta,
  voteOnPoll,
  normalizePollOptions,
};
