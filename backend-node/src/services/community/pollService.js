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

function mapPoll(poll, viewerId, knownMyOptionId) {
  if (!poll) return null;
  const myVote =
    knownMyOptionId !== undefined
      ? knownMyOptionId
        ? { optionId: knownMyOptionId }
        : null
      : viewerId
        ? (poll.votes || []).find((v) => v.userId === viewerId)
        : null;
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

async function voteOnPoll(postOrId, userId, optionId) {
  const postId = typeof postOrId === 'string' ? postOrId : postOrId?.id;
  if (!postId) return { notFound: true };

  const poll = await prisma.communityPoll.findUnique({
    where: { postId },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!poll) return { notFound: true };
  if (poll.endsAt && new Date(poll.endsAt) <= new Date()) return { ended: true };
  const option = poll.options.find((o) => o.id === optionId);
  if (!option) return { invalidOption: true };

  const existing = await prisma.communityPollVote.findUnique({
    where: { pollId_userId: { pollId: poll.id, userId } },
  });
  if (existing?.optionId === optionId) {
    return { poll: mapPoll(poll, userId, optionId) };
  }

  await prisma.$transaction(async (tx) => {
    if (existing) {
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

  const options = await prisma.communityPollOption.findMany({
    where: { pollId: poll.id },
    orderBy: { sortOrder: 'asc' },
  });
  return { poll: mapPoll({ ...poll, options }, userId, optionId) };
}

module.exports = {
  createPollForPost,
  mapPoll,
  buildPollMeta,
  voteOnPoll,
  normalizePollOptions,
};
