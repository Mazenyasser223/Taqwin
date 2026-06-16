/**
 * Shared helpers for duel + squad challenge participation.
 */
const { randomUUID } = require('crypto');
const { prisma } = require('../../db');
const { calendarDateOnly, addCalendarDays } = require('../plans/planCalendar');
const { mapAuthorIdentity } = require('../communityAuthors');
const { FEED_AUTHOR_SELECT } = require('../../services/community/constants');
const { getBlockedUserIds } = require('../../services/community/followService');

async function loadUserPublic(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: FEED_AUTHOR_SELECT,
  });
  return user ? mapAuthorIdentity(user) : null;
}

async function createSocialParticipant({
  userId,
  templateSlug,
  mode,
  duelId = null,
  squadId = null,
  target,
  durationDays,
  startDateKey,
  endDateKey,
}) {
  return prisma.challengeParticipant.create({
    data: {
      id: randomUUID(),
      userId,
      templateSlug,
      mode,
      duelId,
      squadId,
      startDateKey,
      endDateKey,
      target,
      status: 'active',
    },
  });
}

function computeDateRange(timezone, durationDays) {
  const startDateKey = calendarDateOnly(new Date(), timezone).toISOString().slice(0, 10);
  const endDateKey = addCalendarDays(new Date(`${startDateKey}T12:00:00.000Z`), durationDays - 1)
    .toISOString()
    .slice(0, 10);
  return { startDateKey, endDateKey };
}

async function loadUsersPublic(userIds) {
  if (!userIds.length) return new Map();
  const unique = [...new Set(userIds)];
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: FEED_AUTHOR_SELECT,
  });
  return new Map(users.map((u) => [u.id, mapAuthorIdentity(u)]));
}

async function listMutualFriends(userId) {
  const following = await prisma.communityFollow.findMany({
    where: { followerId: userId, status: 'accepted' },
    select: { followingId: true },
  });
  const ids = following.map((f) => f.followingId);
  if (!ids.length) return [];

  const blocked = await getBlockedUserIds(userId);
  const candidateIds = ids.filter((id) => !blocked.has(id));

  const mutualBack = await prisma.communityFollow.findMany({
    where: {
      followerId: { in: candidateIds },
      followingId: userId,
      status: 'accepted',
    },
    select: { followerId: true },
  });
  const mutualIds = mutualBack.map((r) => r.followerId);
  if (!mutualIds.length) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: mutualIds } },
    select: FEED_AUTHOR_SELECT,
  });
  return users.map((u) => mapAuthorIdentity(u));
}

module.exports = {
  loadUserPublic,
  loadUsersPublic,
  createSocialParticipant,
  computeDateRange,
  listMutualFriends,
};
