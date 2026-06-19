const { prisma } = require('../../db');

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

module.exports = {
  isBlockedBetween,
  getBlockedUserIds,
};
