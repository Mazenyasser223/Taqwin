/**
 * User settings — get or create defaults per user.
 */
const { prisma } = require('../db');

const DEFAULTS = {
  language: 'en',
  theme: 'dark',
  notifyWorkoutReminders: true,
  notifyAiSuggestions: true,
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
  digestNotifications: true,
};

function toResponse(row) {
  if (!row) return null;
  return {
    language: row.language,
    theme: row.theme,
    notifyWorkoutReminders: row.notifyWorkoutReminders,
    notifyAiSuggestions: row.notifyAiSuggestions,
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
    digestNotifications: row.digestNotifications,
    updatedAt: row.updatedAt,
  };
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

module.exports = { getOrCreateUserSettings, toResponse, DEFAULTS };
