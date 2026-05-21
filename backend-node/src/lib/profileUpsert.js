const { prisma } = require('../db');

/**
 * Update profile fields, creating the row if the user has no profile yet.
 */
async function upsertProfile(userId, data) {
  return prisma.profile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

module.exports = { upsertProfile };
