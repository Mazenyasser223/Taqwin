/**
 * Head-to-head challenge duels — invite, accept, close by progress %.
 */
const { randomUUID } = require('crypto');
const { prisma } = require('../../db');
const { isMutualFollow } = require('../communityPrivacy');
const { isBlockedBetween } = require('../../services/community/blockService');
const { resolveAthleteTimezone } = require('../athleteMetrics');
const { awardAchievement, awardXp } = require('./rewards');
const { emitGamificationNotification } = require('./gamificationNotify');
const { getOrCreateUserSettings } = require('../userSettings');
const {
  CHALLENGE_TEMPLATES_BY_SLUG,
  progressPct,
  XP_DUEL_WIN,
  XP_DUEL_TIE,
  DUEL_ACHIEVEMENT_SLUG,
} = require('./challengeConfig');
const { challengeTitleForUser } = require('./challengeTitles');
const {
  loadUserPublic,
  loadUsersPublic,
  createSocialParticipant,
  computeDateRange,
} = require('./socialChallengeHelpers');
const { refreshParticipantProgress: refreshProgress } = require('./challengeParticipantRefresh');

async function getTemplate(slug) {
  return prisma.challengeTemplate.findFirst({ where: { slug, active: true } });
}

async function assertCanChallenge(challengerId, opponentId, templateSlug) {
  if (challengerId === opponentId) {
    const err = new Error('Cannot challenge yourself');
    err.status = 400;
    throw err;
  }

  const opponent = await prisma.user.findUnique({ where: { id: opponentId }, select: { id: true } });
  if (!opponent) {
    const err = new Error('Opponent not found');
    err.status = 404;
    throw err;
  }

  if (await isBlockedBetween(challengerId, opponentId)) {
    const err = new Error('Cannot challenge this user');
    err.status = 403;
    throw err;
  }

  if (!(await isMutualFollow(challengerId, opponentId))) {
    const err = new Error('You can only challenge mutual friends');
    err.status = 403;
    throw err;
  }

  const template = await getTemplate(templateSlug);
  if (!template) {
    const err = new Error('Challenge not found');
    err.status = 404;
    throw err;
  }

  const conflict = await prisma.challengeDuel.findFirst({
    where: {
      templateSlug,
      status: { in: ['pending', 'active'] },
      OR: [
        { challengerId: challengerId, opponentId },
        { challengerId: opponentId, opponentId: challengerId },
      ],
    },
  });
  if (conflict) {
    const err = new Error('An active duel already exists with this friend for this challenge');
    err.status = 409;
    throw err;
  }

  return template;
}

function duelSummaryFromContext(duel, viewerId, usersById, partsById) {
  const isChallenger = duel.challengerId === viewerId;
  const otherId = isChallenger ? duel.opponentId : duel.challengerId;
  const template = CHALLENGE_TEMPLATES_BY_SLUG[duel.templateSlug];

  let myPct = null;
  let theirPct = null;
  if (duel.status === 'active') {
    const myPartId = isChallenger ? duel.challengerParticipantId : duel.opponentParticipantId;
    const theirPartId = isChallenger ? duel.opponentParticipantId : duel.challengerParticipantId;
    const myPart = myPartId ? partsById.get(myPartId) : null;
    const theirPart = theirPartId ? partsById.get(theirPartId) : null;
    if (myPart) myPct = progressPct(myPart.progress, myPart.target);
    if (theirPart) theirPct = progressPct(theirPart.progress, theirPart.target);
  }

  return {
    id: duel.id,
    templateSlug: duel.templateSlug,
    status: duel.status,
    role: isChallenger ? 'challenger' : 'opponent',
    opponent: usersById.get(otherId) ?? null,
    startDateKey: duel.startDateKey,
    endDateKey: duel.endDateKey,
    target: duel.target,
    winnerId: duel.winnerId,
    myProgressPct: myPct,
    theirProgressPct: theirPct,
    durationDays: template?.durationDays ?? null,
    icon: template?.icon ?? 'sports_martial_arts',
    createdAt: duel.createdAt,
  };
}

async function duelToSummary(duel, viewerId) {
  const isChallenger = duel.challengerId === viewerId;
  const otherId = isChallenger ? duel.opponentId : duel.challengerId;
  const partIds = [duel.challengerParticipantId, duel.opponentParticipantId].filter(Boolean);
  const [usersById, parts] = await Promise.all([
    loadUsersPublic([otherId]),
    partIds.length
      ? prisma.challengeParticipant.findMany({ where: { id: { in: partIds } } })
      : [],
  ]);
  const partsById = new Map(parts.map((p) => [p.id, p]));
  return duelSummaryFromContext(duel, viewerId, usersById, partsById);
}

async function inviteDuel(challengerId, opponentId, templateSlug) {
  const template = await assertCanChallenge(challengerId, opponentId, templateSlug);

  const duel = await prisma.challengeDuel.create({
    data: {
      id: randomUUID(),
      templateSlug,
      challengerId,
      opponentId,
      status: 'pending',
      target: template.target,
    },
  });

  const challenger = await loadUserPublic(challengerId);
  const settings = await getOrCreateUserSettings(opponentId);
  await emitGamificationNotification({
    userId: opponentId,
    type: 'gamification.duel.invited',
    params: {
      name: challenger?.displayName || challenger?.handle || 'A friend',
      title: challengeTitleForUser(templateSlug, settings.language),
    },
    link: '/compete/social',
  });

  return duelToSummary(duel, challengerId);
}

async function acceptDuel(userId, duelId) {
  const duel = await prisma.challengeDuel.findUnique({ where: { id: duelId } });
  if (!duel || duel.opponentId !== userId) {
    const err = new Error('Duel invite not found');
    err.status = 404;
    throw err;
  }
  if (duel.status !== 'pending') {
    const err = new Error('Duel is no longer pending');
    err.status = 409;
    throw err;
  }

  const template =
    CHALLENGE_TEMPLATES_BY_SLUG[duel.templateSlug] || (await getTemplate(duel.templateSlug));
  if (!template) {
    const err = new Error('Challenge template not found');
    err.status = 404;
    throw err;
  }
  const timezone = await resolveAthleteTimezone(duel.challengerId);
  const { startDateKey, endDateKey } = computeDateRange(timezone, template.durationDays);

  const challengerPart = await createSocialParticipant({
    userId: duel.challengerId,
    templateSlug: duel.templateSlug,
    mode: 'duel',
    duelId: duel.id,
    target: template.target,
    durationDays: template.durationDays,
    startDateKey,
    endDateKey,
  });
  const opponentPart = await createSocialParticipant({
    userId: duel.opponentId,
    templateSlug: duel.templateSlug,
    mode: 'duel',
    duelId: duel.id,
    target: template.target,
    durationDays: template.durationDays,
    startDateKey,
    endDateKey,
  });

  const updated = await prisma.challengeDuel.update({
    where: { id: duel.id },
    data: {
      status: 'active',
      startDateKey,
      endDateKey,
      challengerParticipantId: challengerPart.id,
      opponentParticipantId: opponentPart.id,
    },
  });

  await Promise.all([
    refreshProgress(challengerPart, timezone),
    refreshProgress(opponentPart, timezone),
  ]);

  const challenger = await loadUserPublic(duel.opponentId);
  const settings = await getOrCreateUserSettings(duel.challengerId);
  await emitGamificationNotification({
    userId: duel.challengerId,
    type: 'gamification.duel.accepted',
    params: {
      name: challenger?.displayName || challenger?.handle || 'Your friend',
      title: challengeTitleForUser(duel.templateSlug, settings.language),
    },
    link: '/compete/social',
  });

  return duelToSummary(updated, userId);
}

async function declineDuel(userId, duelId) {
  const duel = await prisma.challengeDuel.findUnique({ where: { id: duelId } });
  if (!duel || duel.opponentId !== userId) {
    const err = new Error('Duel invite not found');
    err.status = 404;
    throw err;
  }
  if (duel.status !== 'pending') {
    const err = new Error('Duel is no longer pending');
    err.status = 409;
    throw err;
  }

  await prisma.challengeDuel.update({
    where: { id: duelId },
    data: { status: 'declined' },
  });

  return { ok: true };
}

async function cancelDuel(userId, duelId) {
  const duel = await prisma.challengeDuel.findUnique({ where: { id: duelId } });
  if (!duel || duel.challengerId !== userId) {
    const err = new Error('Duel not found');
    err.status = 404;
    throw err;
  }
  if (duel.status !== 'pending') {
    const err = new Error('Only pending duels can be cancelled');
    err.status = 409;
    throw err;
  }

  await prisma.challengeDuel.update({
    where: { id: duelId },
    data: { status: 'cancelled' },
  });

  return { ok: true };
}

async function listDuelsForUser(userId) {
  const rows = await prisma.challengeDuel.findMany({
    where: {
      OR: [{ challengerId: userId }, { opponentId: userId }],
      status: { in: ['pending', 'active', 'completed'] },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  const otherIds = [];
  const partIds = [];
  for (const row of rows) {
    otherIds.push(row.challengerId === userId ? row.opponentId : row.challengerId);
    if (row.status === 'active') {
      if (row.challengerParticipantId) partIds.push(row.challengerParticipantId);
      if (row.opponentParticipantId) partIds.push(row.opponentParticipantId);
    }
  }

  const [usersById, parts] = await Promise.all([
    loadUsersPublic(otherIds),
    partIds.length
      ? prisma.challengeParticipant.findMany({ where: { id: { in: partIds } } })
      : [],
  ]);
  const partsById = new Map(parts.map((p) => [p.id, p]));

  const pending = [];
  const active = [];
  const completed = [];

  for (const row of rows) {
    const summary = duelSummaryFromContext(row, userId, usersById, partsById);
    if (row.status === 'pending') pending.push(summary);
    else if (row.status === 'active') active.push(summary);
    else if (row.status === 'completed') completed.push(summary);
  }

  return { pending, active, completed };
}

async function closeDuel(duel) {
  if (duel.status !== 'active') return null;

  const parts = await prisma.challengeParticipant.findMany({
    where: { duelId: duel.id, mode: 'duel' },
  });
  if (parts.length < 2) return null;

  for (const part of parts) {
    const tz = await resolveAthleteTimezone(part.userId);
    await refreshProgress(part, tz);
  }

  const refreshed = await prisma.challengeParticipant.findMany({
    where: { duelId: duel.id, mode: 'duel' },
  });

  const challengerPart = refreshed.find((p) => p.id === duel.challengerParticipantId);
  const opponentPart = refreshed.find((p) => p.id === duel.opponentParticipantId);
  if (!challengerPart || !opponentPart) return null;

  const challengerPct = progressPct(challengerPart.progress, challengerPart.target);
  const opponentPct = progressPct(opponentPart.progress, opponentPart.target);

  let winnerId = null;
  let tie = false;
  if (challengerPct > opponentPct) winnerId = duel.challengerId;
  else if (opponentPct > challengerPct) winnerId = duel.opponentId;
  else tie = true;

  await prisma.challengeDuel.update({
    where: { id: duel.id },
    data: { status: 'completed', winnerId: tie ? null : winnerId },
  });

  if (tie) {
    for (const part of refreshed) {
      await prisma.challengeParticipant.update({
        where: { id: part.id },
        data: { status: 'completed', completedAt: new Date(), xpAwarded: XP_DUEL_TIE },
      });
      await awardXp(part.userId, XP_DUEL_TIE);
      const settings = await getOrCreateUserSettings(part.userId);
      await emitGamificationNotification({
        userId: part.userId,
        type: 'gamification.duel.tie',
        params: { title: challengeTitleForUser(duel.templateSlug, settings.language) },
        link: '/compete/social',
      });
    }
  } else {
    const loserId = winnerId === duel.challengerId ? duel.opponentId : duel.challengerId;
    const winnerPart = refreshed.find((p) => p.userId === winnerId);
    const loserPart = refreshed.find((p) => p.userId === loserId);

    await prisma.challengeParticipant.update({
      where: { id: winnerPart.id },
      data: { status: 'completed', completedAt: new Date(), xpAwarded: XP_DUEL_WIN },
    });
    await prisma.challengeParticipant.update({
      where: { id: loserPart.id },
      data: { status: 'failed' },
    });

    await awardXp(winnerId, XP_DUEL_WIN);
    await awardAchievement(winnerId, DUEL_ACHIEVEMENT_SLUG);

    const [winnerSettings, loserSettings] = await Promise.all([
      getOrCreateUserSettings(winnerId),
      getOrCreateUserSettings(loserId),
    ]);
    const winnerUser = await loadUserPublic(loserId);

    await emitGamificationNotification({
      userId: winnerId,
      type: 'gamification.duel.won',
      params: {
        title: challengeTitleForUser(duel.templateSlug, winnerSettings.language),
        xp: XP_DUEL_WIN,
      },
      link: '/compete/social',
    });
    await emitGamificationNotification({
      userId: loserId,
      type: 'gamification.duel.lost',
      params: {
        title: challengeTitleForUser(duel.templateSlug, loserSettings.language),
        name: winnerUser?.displayName || winnerUser?.handle || 'Your friend',
      },
      link: '/compete/social',
    });
  }

  return { duelId: duel.id, winnerId, tie };
}

async function forfeitDuel(duelId, forfeiterUserId) {
  const duel = await prisma.challengeDuel.findUnique({ where: { id: duelId } });
  if (!duel || duel.status !== 'active') return null;

  const winnerId =
    forfeiterUserId === duel.challengerId ? duel.opponentId : duel.challengerId;

  await prisma.challengeDuel.update({
    where: { id: duelId },
    data: { status: 'completed', winnerId },
  });

  const parts = await prisma.challengeParticipant.findMany({ where: { duelId } });
  for (const part of parts) {
    const isWinner = part.userId === winnerId;
    await prisma.challengeParticipant.update({
      where: { id: part.id },
      data: {
        status: isWinner ? 'completed' : 'abandoned',
        completedAt: isWinner ? new Date() : part.completedAt,
        xpAwarded: isWinner ? XP_DUEL_WIN : part.xpAwarded,
      },
    });
  }

  await awardXp(winnerId, XP_DUEL_WIN);
  await awardAchievement(winnerId, DUEL_ACHIEVEMENT_SLUG);

  const settings = await getOrCreateUserSettings(winnerId);
  await emitGamificationNotification({
    userId: winnerId,
    type: 'gamification.duel.won',
    params: {
      title: challengeTitleForUser(duel.templateSlug, settings.language),
      xp: XP_DUEL_WIN,
    },
    link: '/compete/social',
  });

  return { ok: true };
}

async function runDueDuelCloses({ todayKey = new Date().toISOString().slice(0, 10), limit = 100 } = {}) {
  const due = await prisma.challengeDuel.findMany({
    where: {
      status: 'active',
      endDateKey: { lt: todayKey },
    },
    take: limit,
  });

  let closed = 0;
  for (const duel of due) {
    await closeDuel(duel);
    closed += 1;
  }
  return { closed };
}

module.exports = {
  inviteDuel,
  acceptDuel,
  declineDuel,
  cancelDuel,
  listDuelsForUser,
  closeDuel,
  forfeitDuel,
  runDueDuelCloses,
};
