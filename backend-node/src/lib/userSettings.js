/**
 * User settings — get or create defaults per user.
 */
const { prisma } = require('../db');

const DEFAULTS = {
  language: 'en',
  theme: 'dark',
  notifyPromotional: true,
  publicProfile: false,
  unitSystem: 'metric',
  timezone: 'UTC',
  leagueOptIn: false,
  leaderboardVisibility: 'off',
  showOnLeaderboard: false,
  challengeNotifications: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  telegramEnabled: false,
  telegramSecurityAlerts: true,
  telegramCoachAi: true,
  telegramFitnessAchievements: true,
  telegramOrders: true,
  telegramCommunityMessages: true,
  telegramGroupInvites: true,
  telegramFollowRequests: true,
  telegramSocialActivity: false,
  telegramMentions: false,
  telegramCommunityComments: false,
  telegramDailyDigest: false,
  telegramDailyDigestHour: '08:00',
  telegramWeeklySummary: true,
  telegramMealReminders: false,
  telegramWorkoutMissed: true,
  telegramAiInsights: true,
};

const PATCHABLE_FIELDS = new Set(Object.keys(DEFAULTS));

function toResponse(row) {
  if (!row) return null;
  return {
    language: row.language,
    theme: row.theme,
    notifyPromotional: row.notifyPromotional,
    publicProfile: row.publicProfile,
    unitSystem: row.unitSystem,
    timezone: row.timezone,
    leagueOptIn: row.leagueOptIn,
    leaderboardVisibility: row.leaderboardVisibility,
    showOnLeaderboard: row.showOnLeaderboard,
    challengeNotifications: row.challengeNotifications,
    quietHoursEnabled: row.quietHoursEnabled,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    telegramEnabled: row.telegramEnabled,
    telegramSecurityAlerts: row.telegramSecurityAlerts,
    telegramCoachAi: row.telegramCoachAi,
    telegramFitnessAchievements: row.telegramFitnessAchievements,
    telegramOrders: row.telegramOrders,
    telegramCommunityMessages: row.telegramCommunityMessages,
    telegramGroupInvites: row.telegramGroupInvites,
    telegramFollowRequests: row.telegramFollowRequests,
    telegramSocialActivity: row.telegramSocialActivity,
    telegramMentions: row.telegramMentions,
    telegramCommunityComments: row.telegramCommunityComments,
    telegramDailyDigest: row.telegramDailyDigest,
    telegramDailyDigestHour: row.telegramDailyDigestHour,
    telegramWeeklySummary: row.telegramWeeklySummary,
    telegramMealReminders: row.telegramMealReminders,
    telegramWorkoutMissed: row.telegramWorkoutMissed,
    telegramAiInsights: row.telegramAiInsights,
    updatedAt: row.updatedAt,
  };
}

function pickSettingsUpdate(body) {
  const data = {};
  if (!body || typeof body !== 'object') return data;
  for (const key of PATCHABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      data[key] = body[key];
    }
  }
  return data;
}

async function getOrCreateUserSettings(userId) {
  let settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) {
    settings = await prisma.userSettings.create({
      data: { userId, ...DEFAULTS },
    });
  }
  return settings;
}

async function buildSettingsResponse(userId, settingsRow) {
  const settings = settingsRow || (await getOrCreateUserSettings(userId));
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true, telegramLinkedAt: true },
  });
  return {
    ...toResponse(settings),
    telegramLinked: Boolean(user?.telegramChatId),
    telegramLinkedAt: user?.telegramLinkedAt || null,
  };
}

module.exports = {
  getOrCreateUserSettings,
  toResponse,
  buildSettingsResponse,
  pickSettingsUpdate,
  DEFAULTS,
  PATCHABLE_FIELDS,
};
