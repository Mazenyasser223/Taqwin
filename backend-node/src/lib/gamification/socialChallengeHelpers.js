/**
 * Shared helpers for duel + squad challenge participation.
 */
const { randomUUID } = require('crypto');
const { prisma } = require('../../db');
const { calendarDateOnly, addCalendarDays } = require('../plans/planCalendar');
const { mapAuthorIdentity } = require('../communityAuthors');
const { FEED_AUTHOR_SELECT } = require('../../services/community/constants');
const { getBlockedUserIds } = require('../../services/community/blockService');

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
  durationDays: _durationDays,
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

const MUTUAL_IDS_CACHE_MS = Number(process.env.GAMIFICATION_MUTUAL_CACHE_TTL_MS || 60000);
const mutualIdsCache = new Map();

/** Mutual friend user ids (includes viewer). Used by league friends scope + social tab. */
async function listMutualFriendIds(userId) {
  const hit = mutualIdsCache.get(userId);
  if (hit && Date.now() - hit.at < MUTUAL_IDS_CACHE_MS) return hit.ids;

  const following = await prisma.communityFollow.findMany({
    where: { followerId: userId, status: 'accepted' },
    select: { followingId: true },
  });
  const ids = following.map((f) => f.followingId);
  if (!ids.length) {
    const solo = [userId];
    mutualIdsCache.set(userId, { ids: solo, at: Date.now() });
    return solo;
  }

  const blocked = await getBlockedUserIds(userId);
  const candidateIds = ids.filter((id) => !blocked.has(id));
  if (!candidateIds.length) {
    const solo = [userId];
    mutualIdsCache.set(userId, { ids: solo, at: Date.now() });
    return solo;
  }

  const mutualBack = await prisma.communityFollow.findMany({
    where: {
      followerId: { in: candidateIds },
      followingId: userId,
      status: 'accepted',
    },
    select: { followerId: true },
  });
  const result = [userId, ...mutualBack.map((r) => r.followerId)];
  mutualIdsCache.set(userId, { ids: result, at: Date.now() });
  return result;
}

async function listMutualFriends(userId) {
  const mutualIds = await listMutualFriendIds(userId);
  const friendIds = mutualIds.filter((id) => id !== userId);
  if (!friendIds.length) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: friendIds } },
    select: FEED_AUTHOR_SELECT,
  });
  return users.map((u) => mapAuthorIdentity(u));
}

module.exports = {
  loadUserPublic,
  loadUsersPublic,
  createSocialParticipant,
  computeDateRange,
  listMutualFriendIds,
  listMutualFriends,
};
