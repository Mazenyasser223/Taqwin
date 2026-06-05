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
  shareWithTrainers: true,
  publicProfile: false,
  unitSystem: 'metric',
  timezone: 'UTC',
};

function toResponse(row) {
  if (!row) return null;
  return {
    language: row.language,
    theme: row.theme,
    notifyWorkoutReminders: row.notifyWorkoutReminders,
    notifyAiSuggestions: row.notifyAiSuggestions,
    notifyPromotional: row.notifyPromotional,
    shareWithTrainers: row.shareWithTrainers,
    publicProfile: row.publicProfile,
    unitSystem: row.unitSystem,
    timezone: row.timezone,
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
