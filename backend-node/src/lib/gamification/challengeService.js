/**
 * Solo challenge cards — join, progress refresh, complete/fail.
 */
const { randomUUID } = require('crypto');
const { prisma } = require('../../db');
const { calendarDateOnly, addCalendarDays } = require('../plans/planCalendar');
const { resolveAthleteTimezone } = require('../athleteMetrics');
const {
  enumerateDateKeys,
} = require('./challengeConfig');
const { buildDailyBreakdown } = require('./challengeProgressService');
const { getTemplate, refreshParticipantProgress, isProgressStale } = require('./challengeParticipantRefresh');
const { forfeitDuel, runDueDuelCloses } = require('./duelService');
const { runDueSquadCloses } = require('./squadService');

function participantToSummary(row, template, timezone = 'UTC') {
  const todayKey = calendarDateOnly(new Date(), timezone).toISOString().slice(0, 10);
  let daysLeft = 0;
  if (row.status === 'active' && todayKey <= row.endDateKey) {
    daysLeft = enumerateDateKeys(todayKey, row.endDateKey).length;
  }
  const pct =
    row.target > 0 ? Math.min(100, Math.round((row.progress / row.target) * 100)) : 0;

  return {
    id: row.id,
    slug: row.templateSlug,
    status: row.status,
    progress: row.progress,
    target: row.target,
    startDateKey: row.startDateKey,
    endDateKey: row.endDateKey,
    daysLeft: row.status === 'active' ? daysLeft : 0,
    progressPct: pct,
    completedAt: row.completedAt,
    xpReward: template?.xpReward ?? 0,
    icon: template?.icon ?? 'flag',
    metric: template?.metric ?? null,
    durationDays: template?.durationDays ?? null,
  };
}

function templateToPublic(row) {
  return {
    slug: row.slug,
    durationDays: row.durationDays,
    metric: row.metric,
    target: row.target,
    xpReward: row.xpReward,
    badgeSlug: row.badgeSlug,
    icon: row.icon,
    sortOrder: row.sortOrder,
  };
}

async function refreshActiveForUser(userId, timezone, { force = false } = {}) {
  const active = await prisma.challengeParticipant.findMany({
    where: { userId, status: 'active' },
  });
  const stale = force ? active : active.filter((row) => isProgressStale(row));
  if (!stale.length) return;
  await Promise.all(stale.map((row) => refreshParticipantProgress(row, timezone, { force })));
}

async function loadChallengeListData(userId, timezone) {
  const [templates, participations] = await Promise.all([
    prisma.challengeTemplate.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.challengeParticipant.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const templateBySlug = new Map(templates.map((t) => [t.slug, t]));
  const activeBySlug = new Map();
  const latestBySlug = new Map();
  for (const p of participations) {
    if (!latestBySlug.has(p.templateSlug)) latestBySlug.set(p.templateSlug, p);
    if (p.status === 'active') activeBySlug.set(p.templateSlug, p);
  }

  const catalog = templates.map((t) => {
    const active = activeBySlug.get(t.slug);
    const latest = latestBySlug.get(t.slug);
    return {
      ...templateToPublic(t),
      activeParticipation: active ? participantToSummary(active, t, timezone) : null,
      lastParticipation: latest && !active ? participantToSummary(latest, t, timezone) : null,
    };
  });

  const active = participations
    .filter((p) => p.status === 'active')
    .map((p) => participantToSummary(p, templateBySlug.get(p.templateSlug), timezone));

  const completedCount = participations.filter((p) => p.status === 'completed').length;

  return { catalog, active, completedCount };
}

async function listChallengesForUser(userId, { refresh = true } = {}) {
  const timezone = await resolveAthleteTimezone(userId);
  if (refresh) {
    await refreshActiveForUser(userId, timezone);
  }
  return loadChallengeListData(userId, timezone);
}

async function getChallengeSummaryForUser(userId) {
  const timezone = await resolveAthleteTimezone(userId);
  const { active, completedCount } = await loadChallengeListData(userId, timezone);
  return {
    active: active.slice(0, 3),
    completedCount,
  };
}

async function joinChallenge(userId, slug) {
  const template = await getTemplate(slug);
  if (!template) {
    const err = new Error('Challenge not found');
    err.status = 404;
    throw err;
  }

  const existing = await prisma.challengeParticipant.findFirst({
    where: { userId, templateSlug: slug, status: 'active' },
  });
  if (existing) {
    const err = new Error('Already joined this challenge');
    err.status = 409;
    throw err;
  }

  const timezone = await resolveAthleteTimezone(userId);
  const startDateKey = calendarDateOnly(new Date(), timezone).toISOString().slice(0, 10);
  const endDateKey = addCalendarDays(new Date(`${startDateKey}T12:00:00.000Z`), template.durationDays - 1)
    .toISOString()
    .slice(0, 10);

  const participant = await prisma.challengeParticipant.create({
    data: {
      id: randomUUID(),
      userId,
      templateSlug: slug,
      startDateKey,
      endDateKey,
      target: template.target,
      status: 'active',
    },
  });

  const refreshed = await refreshParticipantProgress(participant, timezone, { force: true });
  return {
    participation: participantToSummary(refreshed, template, timezone),
    template: templateToPublic(template),
  };
}

async function getParticipantDetail(userId, participantId) {
  const participant = await prisma.challengeParticipant.findFirst({
    where: { id: participantId, userId },
  });
  if (!participant) {
    const err = new Error('Challenge participation not found');
    err.status = 404;
    throw err;
  }

  const template = await getTemplate(participant.templateSlug);
  const timezone = await resolveAthleteTimezone(userId);
  const refreshed = await refreshParticipantProgress(participant, timezone, { force: true });
  const daily = template
    ? await buildDailyBreakdown(
        userId,
        template.metric,
        refreshed.startDateKey,
        refreshed.endDateKey,
        timezone
      )
    : [];

  return {
    participation: participantToSummary(refreshed, template, timezone),
    template: template ? templateToPublic(template) : null,
    daily,
  };
}

async function leaveChallenge(userId, participantId) {
  const participant = await prisma.challengeParticipant.findFirst({
    where: { id: participantId, userId, status: 'active' },
  });
  if (!participant) {
    const err = new Error('Active challenge not found');
    err.status = 404;
    throw err;
  }

  await prisma.challengeParticipant.update({
    where: { id: participant.id },
    data: { status: 'abandoned' },
  });

  if (participant.mode === 'duel' && participant.duelId) {
    await forfeitDuel(participant.duelId, userId);
  }

  return { ok: true };
}

async function runChallengeProgressBatch({ limit = 500 } = {}) {
  const rows = await prisma.challengeParticipant.findMany({
    where: { status: 'active' },
    take: limit,
    orderBy: { updatedAt: 'asc' },
  });

  let refreshed = 0;
  let completed = 0;
  let failed = 0;

  for (const row of rows) {
    const timezone = await resolveAthleteTimezone(row.userId);
    const before = row.status;
    await refreshParticipantProgress(row, timezone, { force: true });
    refreshed += 1;
    const after = (
      await prisma.challengeParticipant.findUnique({ where: { id: row.id } })
    )?.status;
    if (before === 'active' && after === 'completed') completed += 1;
    if (before === 'active' && after === 'failed') failed += 1;
  }

  const [duels, squads] = await Promise.all([runDueDuelCloses(), runDueSquadCloses()]);

  return { refreshed, completed, failed, duelsClosed: duels.closed, squadsClosed: squads.closed };
}

module.exports = {
  listChallengesForUser,
  getChallengeSummaryForUser,
  joinChallenge,
  getParticipantDetail,
  leaveChallenge,
  refreshParticipantProgress,
  refreshActiveForUser,
  runChallengeProgressBatch,
  participantToSummary,
};
