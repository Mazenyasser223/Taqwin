/**
 * Compute solo challenge progress from existing athlete logs + daily scores.
 */
const { prisma } = require('../../db');
const { calendarDateOnly } = require('../plans/planCalendar');
const { loggedAtRangeFromDateKeys } = require('../athleteMetrics');
const {
  enumerateDateKeys,
  maxConsecutiveTrue,
  SCORE_DAY_THRESHOLD,
  HYDRATION_WATER_PTS_MIN,
  HYDRATION_ML_MIN,
  FOOD_LOGS_PER_DAY_MIN,
} = require('./challengeConfig');

function dateKeyFromLoggedAt(loggedAt, timezone) {
  return calendarDateOnly(loggedAt, timezone).toISOString().slice(0, 10);
}

async function loadWorkoutDaySet(userId, startDateKey, endDateKey, timezone) {
  const { start, end } = loggedAtRangeFromDateKeys(startDateKey, endDateKey);
  const [workoutLogs, exerciseLogs] = await Promise.all([
    prisma.workoutLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      select: { loggedAt: true },
    }),
    prisma.exerciseLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      select: { loggedAt: true },
    }),
  ]);

  const days = new Set();
  for (const row of [...workoutLogs, ...exerciseLogs]) {
    days.add(dateKeyFromLoggedAt(row.loggedAt, timezone));
  }
  return days;
}

async function loadFoodLogCountsByDay(userId, startDateKey, endDateKey, timezone) {
  const { start, end } = loggedAtRangeFromDateKeys(startDateKey, endDateKey);
  const rows = await prisma.foodLog.findMany({
    where: { userId, loggedAt: { gte: start, lt: end } },
    select: { loggedAt: true },
  });
  const counts = new Map();
  for (const row of rows) {
    const key = dateKeyFromLoggedAt(row.loggedAt, timezone);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

async function loadDailyScoresByDay(userId, dateKeys) {
  const rows = await prisma.athleteDailyScore.findMany({
    where: { userId, dateKey: { in: dateKeys } },
    select: { dateKey: true, score: true, waterPts: true },
  });
  return new Map(rows.map((r) => [r.dateKey, r]));
}

async function loadHydrationMlByDay(userId, startDateKey, endDateKey, timezone) {
  const { start, end } = loggedAtRangeFromDateKeys(startDateKey, endDateKey);
  const rows = await prisma.hydrationLog.findMany({
    where: { userId, loggedAt: { gte: start, lt: end } },
    select: { loggedAt: true, ml: true },
  });
  const byDay = new Map();
  for (const row of rows) {
    const key = dateKeyFromLoggedAt(row.loggedAt, timezone);
    byDay.set(key, (byDay.get(key) || 0) + (row.ml || 0));
  }
  return byDay;
}

async function countHydrationGoalDays(userId, dateKeys, timezone, scores) {
  const fallbackKeys = [];
  let count = 0;
  for (const key of dateKeys) {
    const scoreRow = scores.get(key);
    if (scoreRow?.waterPts >= HYDRATION_WATER_PTS_MIN) {
      count += 1;
    } else if (scoreRow?.waterPts > 0 && scoreRow.waterPts < HYDRATION_WATER_PTS_MIN) {
      // not met
    } else {
      fallbackKeys.push(key);
    }
  }
  if (!fallbackKeys.length) return count;

  const hydrationByDay = await loadHydrationMlByDay(
    userId,
    fallbackKeys[0],
    fallbackKeys[fallbackKeys.length - 1],
    timezone
  );

  let waterTargetMl = 2500;
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
    select: { onboardingData: true },
  });
  const targetFromProfile = profile?.onboardingData?.waterTargetMl;
  if (Number.isFinite(targetFromProfile) && targetFromProfile > 0) {
    waterTargetMl = targetFromProfile;
  }

  for (const key of fallbackKeys) {
    const ml = hydrationByDay.get(key) || 0;
    if (ml >= HYDRATION_ML_MIN) count += 1;
    else if (waterTargetMl > 0 && ml / waterTargetMl >= 0.8) count += 1;
  }
  return count;
}

function isHydrationGoalFromScore(scoreRow) {
  if (!scoreRow) return null;
  if (scoreRow.waterPts >= HYDRATION_WATER_PTS_MIN) return true;
  if (scoreRow.waterPts > 0 && scoreRow.waterPts < HYDRATION_WATER_PTS_MIN) return false;
  return null;
}

async function isHydrationGoalDay(userId, dateKey, timezone, scoreRow, hydrationByDay, waterTargetMl) {
  const fromScore = isHydrationGoalFromScore(scoreRow);
  if (fromScore != null) return fromScore;
  const ml = hydrationByDay?.get(dateKey) ?? 0;
  if (ml >= HYDRATION_ML_MIN) return true;
  return waterTargetMl > 0 && ml / waterTargetMl >= 0.8;
}

async function computeMetricProgress(userId, metric, startDateKey, endDateKey, timezone) {
  const allKeys = enumerateDateKeys(startDateKey, endDateKey);
  const todayKey = calendarDateOnly(new Date(), timezone).toISOString().slice(0, 10);
  const dateKeys = allKeys.filter((k) => k <= todayKey);

  switch (metric) {
    case 'workout_days': {
      const days = await loadWorkoutDaySet(userId, startDateKey, endDateKey, timezone);
      return dateKeys.filter((k) => days.has(k)).length;
    }
    case 'workout_streak': {
      const days = await loadWorkoutDaySet(userId, startDateKey, endDateKey, timezone);
      return maxConsecutiveTrue(dateKeys, (k) => days.has(k));
    }
    case 'food_log_days': {
      const counts = await loadFoodLogCountsByDay(userId, startDateKey, endDateKey, timezone);
      return dateKeys.filter((k) => (counts.get(k) || 0) >= FOOD_LOGS_PER_DAY_MIN).length;
    }
    case 'score_days': {
      const scores = await loadDailyScoresByDay(userId, dateKeys);
      return dateKeys.filter((k) => (scores.get(k)?.score ?? 0) >= SCORE_DAY_THRESHOLD).length;
    }
    case 'hydration_days': {
      const scores = await loadDailyScoresByDay(userId, dateKeys);
      return countHydrationGoalDays(userId, dateKeys, timezone, scores);
    }
    case 'gym_checkins': {
      const { start, end } = loggedAtRangeFromDateKeys(startDateKey, endDateKey);
      return prisma.gymCheckIn.count({
        where: { userId, checkedInAt: { gte: start, lt: end } },
      });
    }
    default:
      return 0;
  }
}

async function buildDailyBreakdown(userId, metric, startDateKey, endDateKey, timezone) {
  const allKeys = enumerateDateKeys(startDateKey, endDateKey);
  const todayKey = calendarDateOnly(new Date(), timezone).toISOString().slice(0, 10);

  const workoutDays =
    metric === 'workout_days' || metric === 'workout_streak'
      ? await loadWorkoutDaySet(userId, startDateKey, endDateKey, timezone)
      : null;
  const foodCounts =
    metric === 'food_log_days'
      ? await loadFoodLogCountsByDay(userId, startDateKey, endDateKey, timezone)
      : null;
  const scores =
    metric === 'score_days' || metric === 'hydration_days'
      ? await loadDailyScoresByDay(userId, allKeys.filter((k) => k <= todayKey))
      : null;
  const hydrationByDay =
    metric === 'hydration_days' && scores
      ? await loadHydrationMlByDay(
          userId,
          allKeys[0],
          allKeys.filter((k) => k <= todayKey).slice(-1)[0] || allKeys[0],
          timezone
        )
      : null;
  let waterTargetMl = 2500;
  if (metric === 'hydration_days') {
    const profile = await prisma.athleteProfile.findUnique({
      where: { userId },
      select: { onboardingData: true },
    });
    const targetFromProfile = profile?.onboardingData?.waterTargetMl;
    if (Number.isFinite(targetFromProfile) && targetFromProfile > 0) {
      waterTargetMl = targetFromProfile;
    }
  }

  const daily = [];
  for (const dateKey of allKeys) {
    if (dateKey > todayKey) {
      daily.push({ dateKey, met: false, pending: true });
      continue;
    }

    let met = false;
    switch (metric) {
      case 'workout_days':
      case 'workout_streak':
        met = workoutDays.has(dateKey);
        break;
      case 'food_log_days':
        met = (foodCounts.get(dateKey) || 0) >= FOOD_LOGS_PER_DAY_MIN;
        break;
      case 'score_days':
        met = (scores.get(dateKey)?.score ?? 0) >= SCORE_DAY_THRESHOLD;
        break;
      case 'hydration_days':
        met = await isHydrationGoalDay(
          userId,
          dateKey,
          timezone,
          scores.get(dateKey),
          hydrationByDay,
          waterTargetMl
        );
        break;
      case 'gym_checkins':
        met = false;
        break;
      default:
        met = false;
    }
    daily.push({ dateKey, met, pending: false });
  }

  return daily;
}

module.exports = {
  computeMetricProgress,
  buildDailyBreakdown,
  enumerateDateKeys,
  maxConsecutiveTrue,
};
