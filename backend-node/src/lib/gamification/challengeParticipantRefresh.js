/**
 * Challenge participant progress refresh (solo + social modes).
 */
const { prisma } = require('../../db');
const { calendarDateOnly } = require('../plans/planCalendar');
const { awardAchievement, awardXp } = require('./rewards');
const { emitGamificationNotification } = require('./gamificationNotify');
const { getOrCreateUserSettings } = require('../userSettings');
const { challengeTitleForUser } = require('./challengeTitles');
const { CHALLENGE_TEMPLATES_BY_SLUG, ACTIVE_STATUSES, PROGRESS_REFRESH_TTL_MS } = require('./challengeConfig');
const { computeMetricProgress } = require('./challengeProgressService');

function isProgressStale(participant, ttlMs = PROGRESS_REFRESH_TTL_MS) {
  if (!participant?.updatedAt) return true;
  return Date.now() - new Date(participant.updatedAt).getTime() > ttlMs;
}

async function getTemplate(slug) {
  return prisma.challengeTemplate.findFirst({
    where: { slug, active: true },
  });
}

async function refreshParticipantProgress(participant, timezone, { force = false } = {}) {
  if (!ACTIVE_STATUSES.has(participant.status)) return participant;
  if (!force && !isProgressStale(participant)) return participant;

  const template =
    CHALLENGE_TEMPLATES_BY_SLUG[participant.templateSlug] ||
    (await getTemplate(participant.templateSlug));
  if (!template) return participant;

  const progress = await computeMetricProgress(
    participant.userId,
    template.metric,
    participant.startDateKey,
    participant.endDateKey,
    timezone
  );

  const todayKey = calendarDateOnly(new Date(), timezone).toISOString().slice(0, 10);
  let status = participant.status;
  let completedAt = participant.completedAt;
  let xpAwarded = participant.xpAwarded;
  const isSocial = participant.mode === 'duel' || participant.mode === 'squad';

  if (!isSocial && progress >= participant.target) {
    status = 'completed';
    completedAt = completedAt || new Date();
    if (xpAwarded === 0) {
      await awardXp(participant.userId, template.xpReward);
      await awardAchievement(participant.userId, template.badgeSlug);
      xpAwarded = template.xpReward;

      const settings = await getOrCreateUserSettings(participant.userId);
      await emitGamificationNotification({
        userId: participant.userId,
        type: 'gamification.challenge.completed',
        params: {
          title: challengeTitleForUser(participant.templateSlug, settings.language),
          xp: template.xpReward,
        },
        link: `/compete/challenges?focus=${participant.id}`,
      });
    }
  } else if (!isSocial && todayKey > participant.endDateKey) {
    status = 'failed';
  }

  if (
    progress !== participant.progress ||
    status !== participant.status ||
    xpAwarded !== participant.xpAwarded
  ) {
    return prisma.challengeParticipant.update({
      where: { id: participant.id },
      data: { progress, status, completedAt, xpAwarded },
    });
  }

  return participant;
}

module.exports = {
  getTemplate,
  isProgressStale,
  refreshParticipantProgress,
};
