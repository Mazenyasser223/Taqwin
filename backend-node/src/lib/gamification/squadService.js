/**
 * Squad challenges — recruit 2–5 friends, average progress wins bonus XP.
 */
const { randomUUID } = require('crypto');
const { prisma } = require('../../db');
const { isMutualFollow } = require('../communityPrivacy');
const { isBlockedBetween } = require('../../services/community/followService');
const { resolveAthleteTimezone } = require('../athleteMetrics');
const { awardXp } = require('./rewards');
const { emitGamificationNotification } = require('./gamificationNotify');
const { getOrCreateUserSettings } = require('../userSettings');
const {
  CHALLENGE_TEMPLATES_BY_SLUG,
  progressPct,
  XP_SQUAD_BONUS,
  SQUAD_MIN_MEMBERS,
  SQUAD_MAX_MEMBERS,
} = require('./challengeConfig');
const { refreshParticipantProgress: refreshProgress } = require('./challengeParticipantRefresh');
const { challengeTitleForUser } = require('./challengeTitles');
const {
  loadUserPublic,
  loadUsersPublic,
  createSocialParticipant,
  computeDateRange,
} = require('./socialChallengeHelpers');

async function getTemplate(slug) {
  return prisma.challengeTemplate.findFirst({ where: { slug, active: true } });
}

async function buildSquadSummaries(squads, viewerId) {
  if (!squads.length) return [];

  const squadIds = squads.map((s) => s.id);
  const [allMembers, allParts] = await Promise.all([
    prisma.challengeSquadMember.findMany({
      where: { squadId: { in: squadIds } },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.challengeParticipant.findMany({
      where: { squadId: { in: squadIds }, mode: 'squad', status: 'active' },
    }),
  ]);

  const membersBySquad = new Map();
  for (const member of allMembers) {
    if (!membersBySquad.has(member.squadId)) membersBySquad.set(member.squadId, []);
    membersBySquad.get(member.squadId).push(member);
  }

  const partsBySquad = new Map();
  for (const part of allParts) {
    if (!partsBySquad.has(part.squadId)) partsBySquad.set(part.squadId, []);
    partsBySquad.get(part.squadId).push(part);
  }

  const usersById = await loadUsersPublic(allMembers.map((m) => m.userId));

  return squads.map((squad) => {
    const members = membersBySquad.get(squad.id) || [];
    const parts = partsBySquad.get(squad.id) || [];
    const template = CHALLENGE_TEMPLATES_BY_SLUG[squad.templateSlug];

    let avgProgressPct = null;
    if (squad.status === 'active' && parts.length) {
      const sum = parts.reduce((acc, p) => acc + progressPct(p.progress, p.target), 0);
      avgProgressPct = Math.round(sum / parts.length);
    }

    return {
      id: squad.id,
      name: squad.name,
      templateSlug: squad.templateSlug,
      status: squad.status,
      ownerId: squad.ownerId,
      isOwner: squad.ownerId === viewerId,
      maxMembers: squad.maxMembers,
      memberCount: members.length,
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        user: usersById.get(m.userId) ?? null,
      })),
      startDateKey: squad.startDateKey,
      endDateKey: squad.endDateKey,
      target: squad.target,
      avgProgressPct,
      durationDays: template?.durationDays ?? null,
      icon: template?.icon ?? 'groups',
      createdAt: squad.createdAt,
    };
  });
}

async function squadToSummary(squad, viewerId) {
  const [summary] = await buildSquadSummaries([squad], viewerId);
  return summary;
}

async function createSquad(ownerId, templateSlug, name = null) {
  const template = await getTemplate(templateSlug);
  if (!template) {
    const err = new Error('Challenge not found');
    err.status = 404;
    throw err;
  }

  const existing = await prisma.challengeSquad.findFirst({
    where: {
      ownerId,
      templateSlug,
      status: { in: ['recruiting', 'active'] },
    },
  });
  if (existing) {
    const err = new Error('You already have an open squad for this challenge');
    err.status = 409;
    throw err;
  }

  const squad = await prisma.challengeSquad.create({
    data: {
      id: randomUUID(),
      templateSlug,
      ownerId,
      name: name?.trim()?.slice(0, 64) || null,
      status: 'recruiting',
      maxMembers: SQUAD_MAX_MEMBERS,
      target: template.target,
    },
  });

  await prisma.challengeSquadMember.create({
    data: {
      id: randomUUID(),
      squadId: squad.id,
      userId: ownerId,
      role: 'owner',
    },
  });

  return squadToSummary(squad, ownerId);
}

async function joinSquad(userId, squadId) {
  const squad = await prisma.challengeSquad.findUnique({ where: { id: squadId } });
  if (!squad || squad.status !== 'recruiting') {
    const err = new Error('Squad not open for joining');
    err.status = 404;
    throw err;
  }

  if (!(await isMutualFollow(userId, squad.ownerId))) {
    const err = new Error('You must be mutual friends with the squad owner');
    err.status = 403;
    throw err;
  }

  if (await isBlockedBetween(userId, squad.ownerId)) {
    const err = new Error('Cannot join this squad');
    err.status = 403;
    throw err;
  }

  const count = await prisma.challengeSquadMember.count({ where: { squadId } });
  if (count >= squad.maxMembers) {
    const err = new Error('Squad is full');
    err.status = 409;
    throw err;
  }

  const existing = await prisma.challengeSquadMember.findUnique({
    where: { squadId_userId: { squadId, userId } },
  });
  if (existing) {
    const err = new Error('Already in this squad');
    err.status = 409;
    throw err;
  }

  await prisma.challengeSquadMember.create({
    data: { id: randomUUID(), squadId, userId, role: 'member' },
  });

  const joiner = await loadUserPublic(userId);
  const settings = await getOrCreateUserSettings(squad.ownerId);
  await emitGamificationNotification({
    userId: squad.ownerId,
    type: 'gamification.squad.joined',
    params: {
      name: joiner?.displayName || joiner?.handle || 'A friend',
      title: challengeTitleForUser(squad.templateSlug, settings.language),
    },
    link: '/compete/social',
  });

  return squadToSummary(await prisma.challengeSquad.findUnique({ where: { id: squadId } }), userId);
}

async function startSquad(ownerId, squadId) {
  const squad = await prisma.challengeSquad.findUnique({ where: { id: squadId } });
  if (!squad || squad.ownerId !== ownerId) {
    const err = new Error('Squad not found');
    err.status = 404;
    throw err;
  }
  if (squad.status !== 'recruiting') {
    const err = new Error('Squad already started');
    err.status = 409;
    throw err;
  }

  const members = await prisma.challengeSquadMember.findMany({ where: { squadId } });
  if (members.length < SQUAD_MIN_MEMBERS) {
    const err = new Error(`Need at least ${SQUAD_MIN_MEMBERS} members to start`);
    err.status = 400;
    throw err;
  }

  const template =
    CHALLENGE_TEMPLATES_BY_SLUG[squad.templateSlug] || (await getTemplate(squad.templateSlug));
  const timezone = await resolveAthleteTimezone(ownerId);
  const { startDateKey, endDateKey } = computeDateRange(timezone, template.durationDays);

  for (const member of members) {
    await createSocialParticipant({
      userId: member.userId,
      templateSlug: squad.templateSlug,
      mode: 'squad',
      squadId: squad.id,
      target: template.target,
      durationDays: template.durationDays,
      startDateKey,
      endDateKey,
    });
  }

  const updated = await prisma.challengeSquad.update({
    where: { id: squadId },
    data: { status: 'active', startDateKey, endDateKey },
  });

  for (const member of members) {
    if (member.userId === ownerId) continue;
    const settings = await getOrCreateUserSettings(member.userId);
    await emitGamificationNotification({
      userId: member.userId,
      type: 'gamification.squad.started',
      params: {
        title: challengeTitleForUser(squad.templateSlug, settings.language),
        name: squad.name || challengeTitleForUser(squad.templateSlug, settings.language),
      },
      link: '/compete/social',
    });
  }

  const parts = await prisma.challengeParticipant.findMany({
    where: { squadId, mode: 'squad' },
  });
  for (const part of parts) {
    const tz = await resolveAthleteTimezone(part.userId);
    await refreshProgress(part, tz);
  }

  return squadToSummary(updated, ownerId);
}

async function leaveSquad(userId, squadId) {
  const squad = await prisma.challengeSquad.findUnique({ where: { id: squadId } });
  if (!squad) {
    const err = new Error('Squad not found');
    err.status = 404;
    throw err;
  }

  if (squad.status === 'recruiting') {
    if (squad.ownerId === userId) {
      await prisma.challengeSquad.update({
        where: { id: squadId },
        data: { status: 'cancelled' },
      });
      await prisma.challengeSquadMember.deleteMany({ where: { squadId } });
    } else {
      await prisma.challengeSquadMember.delete({
        where: { squadId_userId: { squadId, userId } },
      });
    }
    return { ok: true };
  }

  const err = new Error('Cannot leave an active squad');
  err.status = 409;
  throw err;
}

async function listSquadsForUser(userId) {
  const memberRows = await prisma.challengeSquadMember.findMany({
    where: { userId },
    select: { squadId: true },
  });
  const squadIds = memberRows.map((r) => r.squadId);
  if (!squadIds.length) return { recruiting: [], active: [], completed: [] };

  const rows = await prisma.challengeSquad.findMany({
    where: {
      id: { in: squadIds },
      status: { in: ['recruiting', 'active', 'completed'] },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  const summaries = await buildSquadSummaries(rows, userId);
  const recruiting = [];
  const active = [];
  const completed = [];

  for (const summary of summaries) {
    if (summary.status === 'recruiting') recruiting.push(summary);
    else if (summary.status === 'active') active.push(summary);
    else if (summary.status === 'completed') completed.push(summary);
  }

  return { recruiting, active, completed };
}

async function closeSquad(squad) {
  if (squad.status !== 'active') return null;

  const parts = await prisma.challengeParticipant.findMany({
    where: { squadId: squad.id, mode: 'squad' },
  });

  for (const part of parts) {
    const tz = await resolveAthleteTimezone(part.userId);
    await refreshProgress(part, tz);
  }

  const refreshed = await prisma.challengeParticipant.findMany({
    where: { squadId: squad.id, mode: 'squad' },
  });

  const avgPct =
    refreshed.length > 0
      ? Math.round(
          refreshed.reduce((acc, p) => acc + progressPct(p.progress, p.target), 0) / refreshed.length
        )
      : 0;

  const success = avgPct >= 100;

  await prisma.challengeSquad.update({
    where: { id: squad.id },
    data: { status: 'completed' },
  });

  for (const part of refreshed) {
    await prisma.challengeParticipant.update({
      where: { id: part.id },
      data: {
        status: success ? 'completed' : 'failed',
        completedAt: success ? new Date() : part.completedAt,
        xpAwarded: success ? XP_SQUAD_BONUS : part.xpAwarded,
      },
    });

    if (success) {
      await awardXp(part.userId, XP_SQUAD_BONUS);
      const settings = await getOrCreateUserSettings(part.userId);
      await emitGamificationNotification({
        userId: part.userId,
        type: 'gamification.squad.completed',
        params: {
          title: challengeTitleForUser(squad.templateSlug, settings.language),
          xp: XP_SQUAD_BONUS,
          avg: avgPct,
        },
        link: '/compete/social',
      });
    }
  }

  return { squadId: squad.id, avgPct, success };
}

async function runDueSquadCloses({ todayKey = new Date().toISOString().slice(0, 10), limit = 100 } = {}) {
  const due = await prisma.challengeSquad.findMany({
    where: {
      status: 'active',
      endDateKey: { lt: todayKey },
    },
    take: limit,
  });

  let closed = 0;
  for (const squad of due) {
    await closeSquad(squad);
    closed += 1;
  }
  return { closed };
}

async function listRecruitingSquadsForFriends(userId) {
  const following = await prisma.communityFollow.findMany({
    where: { followerId: userId, status: 'accepted' },
    select: { followingId: true },
  });
  const friendIds = following.map((f) => f.followingId);
  if (!friendIds.length) return [];

  const squads = await prisma.challengeSquad.findMany({
    where: {
      ownerId: { in: friendIds },
      status: 'recruiting',
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (!squads.length) return [];

  const myMemberships = await prisma.challengeSquadMember.findMany({
    where: { userId, squadId: { in: squads.map((s) => s.id) } },
    select: { squadId: true },
  });
  const joinedIds = new Set(myMemberships.map((m) => m.squadId));

  const mutualBack = await prisma.communityFollow.findMany({
    where: {
      followerId: { in: squads.map((s) => s.ownerId) },
      followingId: userId,
      status: 'accepted',
    },
    select: { followerId: true },
  });
  const mutualOwnerIds = new Set(mutualBack.map((r) => r.followerId));

  const eligible = squads.filter(
    (s) => !joinedIds.has(s.id) && mutualOwnerIds.has(s.ownerId)
  );
  return buildSquadSummaries(eligible, userId);
}

module.exports = {
  createSquad,
  joinSquad,
  startSquad,
  leaveSquad,
  listSquadsForUser,
  listRecruitingSquadsForFriends,
  closeSquad,
  runDueSquadCloses,
};
