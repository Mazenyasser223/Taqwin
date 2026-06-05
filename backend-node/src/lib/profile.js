/**
 * Profile — get or create for users missing a row (legacy accounts, partial signup).
 */
const { prisma } = require('../db');

async function getOrCreateProfile(userId) {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.profile.create({ data: { userId } });
}

async function upsertProfile(userId, data) {
  return prisma.profile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

module.exports = { getOrCreateProfile, upsertProfile };
