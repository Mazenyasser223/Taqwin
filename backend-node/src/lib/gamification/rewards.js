/**
 * Shared XP + achievement helpers for gamification.
 */
const { randomUUID } = require('crypto');
const { prisma } = require('../../db');

async function awardAchievement(userId, slug) {
  const existing = await prisma.userAchievement.findUnique({
    where: { userId_slug: { userId, slug } },
  });
  if (existing) return existing;
  return prisma.userAchievement.create({
    data: { id: randomUUID(), userId, slug },
  });
}

async function awardXp(userId, amount) {
  if (amount <= 0) return;
  await prisma.userGamification.upsert({
    where: { userId },
    create: { userId, lifetimeXp: amount, currentXp: amount },
    update: {
      lifetimeXp: { increment: amount },
      currentXp: { increment: amount },
    },
  });
}

module.exports = {
  awardAchievement,
  awardXp,
};
