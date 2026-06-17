/**
 * Gamification profile + settings helpers.
 */
const { prisma } = require('../../db');
const { getOrCreateUserSettings, DEFAULTS } = require('../userSettings');
const { calendarDateOnly, addCalendarDays } = require('../plans/planCalendar');
const { resolveAthleteTimezone } = require('../athleteMetrics');
const { backfillRecentScores } = require('./dailyScoreBatch');
const { computeAndPersistDailyScore } = require('../fitnessScoreCompute');
const { ensureLeagueMembership, getCurrentLeagueStatus } = require('./leagueService');
const { getChallengeSummaryForUser, getDashboardChallengeHighlight } = require('./challengeService');
const { getAchievementMeta, listAchievementCatalog } = require('./achievementCatalog');

const VALID_VISIBILITY = new Set(['off', 'friends', 'gym', 'global']);
const VALID_TIERS = new Set(['bronze', 'silver', 'gold', 'diamond']);

async function getOrCreateUserGamification(userId) {
  let row = await prisma.userGamification.findUnique({ where: { userId } });
  if (!row) {
    row = await prisma.userGamification.create({
      data: { userId },
    });
  }
  return row;
}

function gamificationSettingsFromRow(settings) {
  return {
    leagueOptIn: Boolean(settings.leagueOptIn),
    leaderboardVisibility: settings.leaderboardVisibility || 'off',
    showOnLeaderboard: Boolean(settings.showOnLeaderboard),
    challengeNotifications: settings.challengeNotifications !== false,
  };
}

async function getWeeklyScoreSummary(userId, timezone) {
  const today = calendarDateOnly(new Date(), timezone);
  const keys = [];
  for (let i = 0; i < 7; i += 1) {
    keys.push(addCalendarDays(today, -i).toISOString().slice(0, 10));
  }

  const rows = await prisma.athleteDailyScore.findMany({
    where: { userId, dateKey: { in: keys } },
    select: { dateKey: true, score: true },
  });
  const byKey = new Map(rows.map((r) => [r.dateKey, r.score]));
  const daily = keys.map((dateKey) => ({
    dateKey,
    score: byKey.get(dateKey) ?? null,
  }));
  const scored = daily.filter((d) => d.score != null && d.score > 0);
  const weeklyAvg =
    scored.length > 0
      ? Math.round(scored.reduce((s, d) => s + d.score, 0) / scored.length)
      : null;

  return {
    weekStart: keys[keys.length - 1],
    weekEnd: keys[0],
    daysCounted: scored.length,
    weeklyAvg,
    daily,
  };
}

async function getGamificationMe(userId) {
  const [settings, gamification, timezone] = await Promise.all([
    getOrCreateUserSettings(userId),
    getOrCreateUserGamification(userId),
    resolveAthleteTimezone(userId),
  ]);

  const todayKey = calendarDateOnly(new Date(), timezone).toISOString().slice(0, 10);
  const [todayScoreRow, weekly, league, challenges] = await Promise.all([
    prisma.athleteDailyScore.findUnique({
      where: { userId_dateKey: { userId, dateKey: todayKey } },
    }),
    getWeeklyScoreSummary(userId, timezone),
    getCurrentLeagueStatus(userId, { light: true }),
    getChallengeSummaryForUser(userId),
  ]);

  let todayScore = todayScoreRow;
  if (!todayScore) {
    const computed = await computeAndPersistDailyScore(userId, todayKey, {
      source: 'on_demand',
      timezone,
    });
    todayScore = computed.row;
  }

  return {
    settings: gamificationSettingsFromRow(settings),
    profile: {
      currentTier: gamification.currentTier,
      lifetimeXp: gamification.lifetimeXp,
      currentXp: gamification.currentXp,
    },
    today: {
      dateKey: todayKey,
      score: todayScore.score,
      sleepPts: todayScore.sleepPts,
      mealsPts: todayScore.mealsPts,
      waterPts: todayScore.waterPts,
      workoutPts: todayScore.workoutPts,
      computedAt: todayScore.computedAt,
    },
    weekly,
    league,
    challenges,
  };
}

const DASHBOARD_CACHE_TTL_MS = Number(process.env.GAMIFICATION_DASHBOARD_CACHE_TTL_MS || 60000);
const dashboardCache = new Map();

function invalidateGamificationDashboardCache(userId) {
  if (userId) dashboardCache.delete(userId);
}

/** Home dashboard — league status + top active challenge in one round trip. */
async function getGamificationDashboard(userId) {
  const hit = dashboardCache.get(userId);
  if (hit && Date.now() - hit.at < DASHBOARD_CACHE_TTL_MS) {
    return hit.data;
  }

  const timezone = await resolveAthleteTimezone(userId);
  const [league, activeChallenge] = await Promise.all([
    getCurrentLeagueStatus(userId, { light: true }),
    getDashboardChallengeHighlight(userId, timezone),
  ]);

  const data = { league, activeChallenge };
  if (league?.optedIn !== false) {
    dashboardCache.set(userId, { at: Date.now(), data });
  }
  return data;
}

async function updateGamificationSettings(userId, patch) {
  const data = {};
  if (patch.leagueOptIn != null) data.leagueOptIn = Boolean(patch.leagueOptIn);
  if (patch.showOnLeaderboard != null) data.showOnLeaderboard = Boolean(patch.showOnLeaderboard);
  if (patch.challengeNotifications != null) {
    data.challengeNotifications = Boolean(patch.challengeNotifications);
  }
  if (patch.leaderboardVisibility != null) {
    const v = String(patch.leaderboardVisibility);
    if (!VALID_VISIBILITY.has(v)) {
      const err = new Error('Invalid leaderboardVisibility');
      err.status = 400;
      throw err;
    }
    data.leaderboardVisibility = v;
  }

  if (Object.keys(data).length === 0) {
    const settings = await getOrCreateUserSettings(userId);
    return gamificationSettingsFromRow(settings);
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...DEFAULTS, ...data },
    update: data,
  });

  if (patch.leagueOptIn === true) {
    await getOrCreateUserGamification(userId);
    await backfillRecentScores(userId, 7, 'on_demand');
    await ensureLeagueMembership(userId);
  }

  invalidateGamificationDashboardCache(userId);
  return gamificationSettingsFromRow(settings);
}

async function getGamificationAchievements(userId) {
  const [gamification, rows] = await Promise.all([
    getOrCreateUserGamification(userId),
    prisma.userAchievement.findMany({
      where: { userId },
      orderBy: { earnedAt: 'desc' },
    }),
  ]);

  const earnedSlugs = new Set(rows.map((r) => r.slug));
  const catalog = listAchievementCatalog().map((item) => ({
    ...item,
    earned: earnedSlugs.has(item.slug),
  }));

  return {
    profile: {
      currentTier: gamification.currentTier,
      lifetimeXp: gamification.lifetimeXp,
      currentXp: gamification.currentXp,
    },
    earned: rows.map((row) => ({
      ...getAchievementMeta(row.slug),
      slug: row.slug,
      earnedAt: row.earnedAt,
    })),
    catalog,
  };
}

module.exports = {
  VALID_VISIBILITY,
  VALID_TIERS,
  getOrCreateUserGamification,
  getGamificationMe,
  getGamificationDashboard,
  invalidateGamificationDashboardCache,
  updateGamificationSettings,
  getWeeklyScoreSummary,
  getGamificationAchievements,
};
