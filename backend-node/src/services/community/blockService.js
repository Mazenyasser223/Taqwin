const { prisma } = require('../../db');
const { FEED_AUTHOR_SELECT } = require('./constants');

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

async function listUsersBlockedBy(blockerId) {
  return prisma.communityBlock.findMany({
    where: { blockerId },
    orderBy: { createdAt: 'desc' },
    include: {
      blocked: { select: FEED_AUTHOR_SELECT },
    },
  });
}

module.exports = {
  isBlockedBetween,
  getBlockedUserIds,
  listUsersBlockedBy,
};
