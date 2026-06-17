/**
 * Shared athlete metrics — single source for dashboard + AI CAG.
 * Timezone-aware day boundaries; each metric tagged logged | derived | fallback.
 */
const { prisma } = require('../db');
const { getOrCreateUserSettings } = require('./userSettings');
const { estimateTargets } = require('./nutritionTargets');
const { parseWeightLog, mergeWeightLogSources } = require('./weightLog');
const { parseExerciseLogNotes } = require('./exerciseLogNotes');
const { calendarDateOnly, addCalendarDays, DAY_MS } = require('./plans/planCalendar');
const { weekStartSundayUtc } = require('./plans/planWeek');
const { scaledMacrosFromLog, FOOD_LOG_SNAPSHOT_SELECT } = require('./foodLogSnapshot');

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function tagged(value, source) {
  return { value, source };
}

function dateKeyInTimezone(date, timezone = 'UTC') {
  return calendarDateOnly(date, timezone).toISOString().slice(0, 10);
}

function dowLabelForDateKey(dateKey) {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  return DOW_LABELS[d.getUTCDay()];
}

function loggedAtRangeFromDateKeys(startKey, endKeyInclusive) {
  const start = new Date(`${startKey}T00:00:00.000Z`);
  const end = addCalendarDays(new Date(`${endKeyInclusive}T00:00:00.000Z`), 1);
  return { start, end };
}

async function resolveAthleteTimezone(userId) {
  if (!resolveAthleteTimezone._cache) resolveAthleteTimezone._cache = new Map();
  const hit = resolveAthleteTimezone._cache.get(userId);
  if (hit && Date.now() - hit.at < 300_000) return hit.tz;
  const settings = await getOrCreateUserSettings(userId);
  const tz = settings?.timezone || 'UTC';
  resolveAthleteTimezone._cache.set(userId, { tz, at: Date.now() });
  return tz;
}

function summarizeFoodLogs(foodLogs) {
  return foodLogs.reduce(
    (acc, l) => {
      const scaled = scaledMacrosFromLog(l);
      acc.calories += scaled.calories;
      acc.protein += scaled.protein;
      acc.carbs += scaled.carbs;
      acc.fat += scaled.fat;
      acc.logCount += 1;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, logCount: 0 }
  );
}

function exerciseLogsToSyntheticSessions(exerciseLogs, defaultTitle = 'Training session') {
  const byDay = new Map();
  for (const log of exerciseLogs) {
    const key = new Date(log.loggedAt).toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(log);
  }
  const sessions = [];
  for (const [key, logs] of byDay) {
    let durationSec = 0;
    for (const log of logs) {
      const parsed = parseExerciseLogNotes(log.notes);
      durationSec = Math.max(durationSec, parsed.durationSec || 0);
    }
    const durationMin =
      durationSec > 0 ? Math.max(1, Math.ceil(durationSec / 60)) : Math.max(15, logs.length * 4);
    const latest = logs.reduce((a, b) => (a.loggedAt > b.loggedAt ? a : b));
    sessions.push({
      id: `exercise-session-${key}`,
      loggedAt: latest.loggedAt,
      durationMin,
      synthetic: true,
      workout: {
        title: defaultTitle,
        calories: durationMin * 10,
        durationMin,
      },
    });
  }
  return sessions;
}

function mergeWorkoutLogs(workoutLogs, exerciseLogs) {
  if (!exerciseLogs?.length) return workoutLogs;
  const synthetic = exerciseLogsToSyntheticSessions(exerciseLogs);
  const daysWithWorkout = new Set(
    workoutLogs.map((l) => new Date(l.loggedAt).toISOString().slice(0, 10))
  );
  const extra = synthetic.filter(
    (s) => !daysWithWorkout.has(new Date(s.loggedAt).toISOString().slice(0, 10))
  );
  return [...workoutLogs, ...extra];
}

function buildWeeklyBuckets(workoutLogs, foodLogs, weekStartKey, timezone) {
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = addCalendarDays(new Date(`${weekStartKey}T00:00:00.000Z`), i);
    const dateKey = d.toISOString().slice(0, 10);
    return {
      date: dateKey,
      day: dowLabelForDateKey(dateKey),
      caloriesBurned: 0,
      caloriesEaten: 0,
      workouts: 0,
      minutes: 0,
    };
  });
  const indexByDate = new Map(buckets.map((b, i) => [b.date, i]));

  for (const l of workoutLogs) {
    const key = dateKeyInTimezone(l.loggedAt, timezone);
    const i = indexByDate.get(key);
    if (i == null) continue;
    const factor = l.durationMin && l.workout?.durationMin ? l.durationMin / l.workout.durationMin : 1;
    buckets[i].caloriesBurned += Math.round((l.workout?.calories ?? 0) * factor);
    buckets[i].minutes += l.durationMin ?? l.workout?.durationMin ?? 0;
    buckets[i].workouts += 1;
  }
  for (const l of foodLogs) {
    const key = dateKeyInTimezone(l.loggedAt, timezone);
    const i = indexByDate.get(key);
    if (i == null) continue;
    buckets[i].caloriesEaten += scaledMacrosFromLog(l).calories;
  }
  return buckets;
}

function computeStreak(workoutLogs, exerciseLogs, timezone) {
  const dates = new Set();
  for (const l of workoutLogs) dates.add(dateKeyInTimezone(l.loggedAt, timezone));
  for (const l of exerciseLogs || []) dates.add(dateKeyInTimezone(l.loggedAt, timezone));

  let streak = 0;
  let cursor = calendarDateOnly(new Date(), timezone);
  const todayKey = cursor.toISOString().slice(0, 10);
  if (!dates.has(todayKey)) {
    cursor = addCalendarDays(cursor, -1);
  }
  for (let i = 0; i < 365; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (dates.has(key)) {
      streak += 1;
      cursor = addCalendarDays(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}

async function buildNutritionDay(userId, dateKey, timezone, opts = {}) {
  const { start, end } = loggedAtRangeFromDateKeys(dateKey, dateKey);
  const foodLogs = opts.foodLogs
    ? opts.foodLogs.filter((l) => {
        const t = new Date(l.loggedAt).getTime();
        return t >= start.getTime() && t < end.getTime();
      })
    : await prisma.foodLog.findMany({
        where: { userId, loggedAt: { gte: start, lt: end } },
        include: {
          foodItem: {
            select: {
              id: true,
              name: true,
              calories: true,
              protein: true,
              carbs: true,
              fat: true,
              fdcId: true,
              webtebId: true,
            },
          },
        },
        orderBy: { loggedAt: 'desc' },
      });

  const profile = opts.profile || (await prisma.athleteProfile.findUnique({ where: { userId } }));
  const targets = estimateTargets(profile);
  const totals = summarizeFoodLogs(foodLogs);

  return {
    date: dateKey,
    timezone,
    targets: {
      calorieTarget: targets.calorieTarget,
      proteinTarget: targets.proteinTarget,
      carbTarget: targets.carbTarget,
      fatTarget: targets.fatTarget,
      waterMl: targets.waterMl ?? 2500,
    },
    ...totals,
    source: foodLogs.length > 0 ? 'logged' : 'derived',
    foods: foodLogs.slice(0, 12),
  };
}

async function buildWorkoutDay(userId, dateKey, timezone, opts = {}) {
  const { start, end } = loggedAtRangeFromDateKeys(dateKey, dateKey);
  const [workoutLogs, exerciseLogs] = await Promise.all([
    opts.workoutLogs
      ? Promise.resolve(opts.workoutLogs)
      : prisma.workoutLog.findMany({
          where: { userId, loggedAt: { gte: start, lt: end } },
          include: {
            workout: { select: { title: true, calories: true, durationMin: true, category: true } },
          },
          orderBy: { loggedAt: 'asc' },
        }),
    opts.exerciseLogs
      ? Promise.resolve(opts.exerciseLogs)
      : prisma.exerciseLog.findMany({
          where: { userId, loggedAt: { gte: start, lt: end } },
          orderBy: { loggedAt: 'asc' },
        }),
  ]);

  const filteredWorkouts = workoutLogs.filter((l) => {
    const t = new Date(l.loggedAt).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
  const filteredExercise = exerciseLogs.filter((l) => {
    const t = new Date(l.loggedAt).getTime();
    return t >= start.getTime() && t < end.getTime();
  });

  const merged = mergeWorkoutLogs(filteredWorkouts, filteredExercise);
  const caloriesBurned = merged.reduce((s, l) => {
    const factor = l.durationMin && l.workout?.durationMin ? l.durationMin / l.workout.durationMin : 1;
    return s + Math.round((l.workout?.calories ?? 0) * factor);
  }, 0);

  const hasSynthetic = merged.some((l) => l.synthetic);
  const source = merged.length === 0 ? 'derived' : hasSynthetic && filteredWorkouts.length === 0 ? 'fallback' : 'logged';

  return {
    date: dateKey,
    sessions: merged,
    caloriesBurned,
    sessionCount: merged.length,
    source,
  };
}

async function buildWeightSeries(userId, days, timezone, opts = {}) {
  const todayKey = opts.todayKey || dateKeyInTimezone(new Date(), timezone);
  const startKey = addCalendarDays(new Date(`${todayKey}T00:00:00.000Z`), -(days - 1))
    .toISOString()
    .slice(0, 10);
  const rangeStart = new Date(`${startKey}T00:00:00.000Z`);
  const rangeEnd = addCalendarDays(new Date(`${todayKey}T00:00:00.000Z`), 1);

  const [profile, bodyMetricsInRange, bodyMetricsAll] = await Promise.all([
    opts.profile || prisma.athleteProfile.findUnique({ where: { userId } }),
    prisma.bodyMetric.findMany({
      where: { userId, recordedAt: { gte: rangeStart, lt: rangeEnd } },
      orderBy: { recordedAt: 'asc' },
    }),
    prisma.bodyMetric.findMany({
      where: { userId },
      orderBy: { recordedAt: 'asc' },
      select: { weightKg: true, recordedAt: true },
    }),
  ]);

  const weightLogEntries = parseWeightLog(profile?.onboardingData);
  const mergedWeightLog = mergeWeightLogSources(
    weightLogEntries,
    bodyMetricsAll,
    (recordedAt) => dateKeyInTimezone(recordedAt, timezone)
  );
  const byDate = new Map();

  for (const m of bodyMetricsInRange) {
    const key = dateKeyInTimezone(m.recordedAt, timezone);
    byDate.set(key, { weight: m.weightKg, source: 'logged' });
  }
  for (const e of weightLogEntries) {
    if (e.date >= startKey && e.date <= todayKey && !byDate.has(e.date)) {
      byDate.set(e.date, { weight: e.weight, source: 'logged' });
    }
  }

  const series = [];
  for (let i = 0; i < days; i++) {
    const d = addCalendarDays(new Date(`${startKey}T00:00:00.000Z`), i);
    const dateKey = d.toISOString().slice(0, 10);
    const row = byDate.get(dateKey);
    series.push({
      date: dateKey,
      label: dowLabelForDateKey(dateKey),
      weight: row?.weight ?? null,
      source: row?.source ?? null,
    });
  }

  let overallSource = 'derived';
  if (bodyMetricsInRange.length > 0 || mergedWeightLog.some((e) => e.date >= startKey)) {
    overallSource = 'logged';
  }

  return { series, overallSource, weightLog: mergedWeightLog };
}

function buildWeightTrendFromSeries(series, weeklyBuckets, baseWeight) {
  const weightByDate = new Map(series.filter((s) => s.weight != null).map((s) => [s.date, s.weight]));

  const trend = weeklyBuckets.map((b) => {
    const w = weightByDate.get(b.date);
    if (w != null) {
      return { label: b.day, date: b.date, weight: w, source: 'logged' };
    }
    if (baseWeight != null) {
      const idx = weeklyBuckets.findIndex((x) => x.date === b.date);
      const est = Math.round(
        (baseWeight - (6 - idx) * 0.2 + (b.caloriesEaten - b.caloriesBurned) * 0.002) * 10
      ) / 10;
      return { label: b.day, date: b.date, weight: est, source: 'fallback' };
    }
    return { label: b.day, date: b.date, weight: null, source: null };
  });

  const loggedCount = trend.filter((t) => t.source === 'logged').length;
  return { trend, source: loggedCount >= 2 ? 'logged' : loggedCount === 1 ? 'derived' : 'fallback' };
}

function buildWeightForecast(bodyMetricSeries, _baseWeight) {
  const points = bodyMetricSeries.filter((s) => s.weight != null && s.source === 'logged');
  if (points.length >= 3) {
    const last = points.slice(-3);
    const delta = (last[2].weight - last[0].weight) / 2;
    const forecasts = [];
    let w = last[last.length - 1].weight;
    for (let i = 1; i <= 4; i++) {
      w = Math.round((w + delta) * 10) / 10;
      forecasts.push({ label: `+${i}w`, actual: null, forecast: w, source: 'derived' });
    }
    return { forecasts, source: 'derived' };
  }
  return { forecasts: [], source: 'derived' };
}

function computeWeightDeltaWeek(weightLog, weightTrend) {
  if (weightLog.length >= 2) {
    const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1].weight;
    const prev = sorted[sorted.length - 2].weight;
    return tagged(Math.round((last - prev) * 10) / 10, 'logged');
  }
  const logged = weightTrend.filter((t) => t.source === 'logged' && t.weight != null);
  if (logged.length >= 2) {
    return tagged(
      Math.round((logged[logged.length - 1].weight - logged[0].weight) * 10) / 10,
      'logged'
    );
  }
  const withWeight = weightTrend.filter((t) => t.weight != null);
  if (withWeight.length >= 2) {
    return tagged(
      Math.round((withWeight[withWeight.length - 1].weight - withWeight[0].weight) * 10) / 10,
      'fallback'
    );
  }
  return tagged(0, 'derived');
}

async function buildReadinessToday(userId, dateKey, _opts = {}) {
  const dateOnly = new Date(`${dateKey}T00:00:00.000Z`);

  const [readinessLog, dailyPlan] = await Promise.all([
    prisma.readinessLog.findUnique({
      where: { userId_date: { userId, date: dateOnly } },
    }),
    prisma.dailyAthletePlan.findFirst({
      where: { userId, date: dateOnly },
      select: { readinessScore: true },
    }),
  ]);

  if (readinessLog) {
    const sleep = readinessLog.sleepQuality ?? 0;
    const soreness = readinessLog.soreness ?? 0;
    const rpe = readinessLog.rpe ?? 0;
    const score = Math.min(
      100,
      Math.round((sleep / 5) * 40 + ((5 - soreness) / 5) * 30 + ((10 - rpe) / 10) * 30)
    );
    return {
      score,
      source: 'logged',
      readinessLog,
      breakdown: { sleepQuality: sleep, soreness, rpe },
    };
  }

  if (dailyPlan?.readinessScore != null) {
    return {
      score: dailyPlan.readinessScore,
      source: 'logged',
      readinessLog: null,
      breakdown: null,
    };
  }

  return null;
}

function buildDerivedReadinessScore({ sleepMet, mealsMet, waterMet, workoutMet }) {
  const score =
    (sleepMet ? 25 : 0) + (mealsMet ? 25 : 0) + (waterMet ? 25 : 0) + (workoutMet ? 25 : 0);
  return { score, source: 'derived' };
}

async function buildWeeklyAdherenceMetrics(userId, timezone, opts = {}) {
  const { computeWeeklyAdherence } = require('./adaptation/adherence');
  const weekStart = opts.weekStart || weekStartSundayUtc(new Date());
  const adherence = await computeWeeklyAdherence(userId, weekStart, { timezone });
  const consistencyPct = Math.min(
    100,
    Math.round((adherence.workoutAdherence ?? 0) * 0.6 + (adherence.nutritionAdherence ?? 0) * 0.4)
  );

  return {
    workoutPct: Math.round(adherence.workoutAdherence ?? 0),
    nutritionPct: Math.round(adherence.nutritionAdherence ?? 0),
    consistencyPct,
    source: 'logged',
    raw: adherence,
  };
}

function buildWeeklyAdherenceChart(calorieAdherenceToday, proteinAdherenceToday, workoutPct, consistencyPct, activityPct) {
  return {
    categories: ['Workout', 'Calories', 'Protein', 'Activity', 'Consistency'],
    values: [workoutPct, calorieAdherenceToday, proteinAdherenceToday, activityPct, consistencyPct],
    sources: ['logged', 'logged', 'logged', 'logged', 'logged'],
  };
}

function buildDataProvenance(metrics) {
  return {
    weightTrend: metrics.weightTrendSource || 'derived',
    weightDelta: metrics.weightDeltaSource || 'derived',
    readiness: metrics.readinessSource || 'derived',
    nutritionToday: metrics.nutritionSource || 'derived',
    workoutToday: metrics.workoutSource || 'derived',
    weeklyConsistency: metrics.consistencySource || 'derived',
    timezone: metrics.timezone || 'UTC',
  };
}

async function loadHomeMetricsContext(userId, now = new Date()) {
  const timezone = await resolveAthleteTimezone(userId);
  const todayKey = dateKeyInTimezone(now, timezone);
  const weekStartKey = addCalendarDays(new Date(`${todayKey}T00:00:00.000Z`), -6)
    .toISOString()
    .slice(0, 10);
  const prevWeekStartKey = addCalendarDays(new Date(`${weekStartKey}T00:00:00.000Z`), -7)
    .toISOString()
    .slice(0, 10);
  const heatmapStartKey = addCalendarDays(new Date(`${todayKey}T00:00:00.000Z`), -27)
    .toISOString()
    .slice(0, 10);

  const heatmapRange = loggedAtRangeFromDateKeys(heatmapStartKey, todayKey);
  const weekRange = loggedAtRangeFromDateKeys(weekStartKey, todayKey);
  const prevWeekRange = loggedAtRangeFromDateKeys(prevWeekStartKey, weekStartKey);

  const logInRange = (log, range) => log.loggedAt >= range.start && log.loggedAt < range.end;

  const [profile, heatmapWorkoutLogs, allFoodLogs, exerciseLogsSinceHeatmap] = await Promise.all([
    prisma.athleteProfile.findUnique({ where: { userId } }),
    prisma.workoutLog.findMany({
      where: { userId, loggedAt: { gte: heatmapRange.start, lt: heatmapRange.end } },
      include: { workout: { select: { title: true, calories: true, durationMin: true, category: true } } },
    }),
    prisma.foodLog.findMany({
      where: { userId, loggedAt: { gte: heatmapRange.start, lt: heatmapRange.end } },
      select: {
        id: true,
        loggedAt: true,
        grams: true,
        ...FOOD_LOG_SNAPSHOT_SELECT,
        foodItem: {
          select: { name: true, calories: true, protein: true, carbs: true, fat: true, webtebId: true, id: true },
        },
      },
    }),
    prisma.exerciseLog.findMany({
      where: { userId, loggedAt: { gte: heatmapRange.start, lt: heatmapRange.end } },
      orderBy: { loggedAt: 'asc' },
    }),
  ]);

  const weekWorkoutLogs = heatmapWorkoutLogs.filter((l) => logInRange(l, weekRange));
  const prevWeekWorkoutLogs = heatmapWorkoutLogs.filter((l) => logInRange(l, prevWeekRange));
  const weekFoodLogs = allFoodLogs.filter((l) => logInRange(l, weekRange));
  const prevWeekFoodLogs = allFoodLogs.filter((l) => logInRange(l, prevWeekRange));
  const calorieHistoryFoodLogs = allFoodLogs;

  const weekExerciseLogs = exerciseLogsSinceHeatmap.filter(
    (l) => l.loggedAt >= weekRange.start && l.loggedAt < weekRange.end
  );
  const prevWeekExerciseLogs = exerciseLogsSinceHeatmap.filter(
    (l) => l.loggedAt >= prevWeekRange.start && l.loggedAt < prevWeekRange.end
  );
  const todayRange = loggedAtRangeFromDateKeys(todayKey, todayKey);
  const todayExerciseLogs = exerciseLogsSinceHeatmap.filter(
    (l) => l.loggedAt >= todayRange.start && l.loggedAt < todayRange.end
  );

  const weekWorkoutsMerged = mergeWorkoutLogs(weekWorkoutLogs, weekExerciseLogs);
  const prevWeekWorkoutsMerged = mergeWorkoutLogs(prevWeekWorkoutLogs, prevWeekExerciseLogs);
  const heatmapWorkoutsMerged = mergeWorkoutLogs(heatmapWorkoutLogs, exerciseLogsSinceHeatmap);
  const todayWorkoutsMerged = mergeWorkoutLogs(
    weekWorkoutLogs.filter(
      (l) => l.loggedAt >= todayRange.start && l.loggedAt < todayRange.end
    ),
    todayExerciseLogs
  );

  const weekly = buildWeeklyBuckets(weekWorkoutsMerged, weekFoodLogs, weekStartKey, timezone);
  const prevWeekly = buildWeeklyBuckets(prevWeekWorkoutsMerged, prevWeekFoodLogs, prevWeekStartKey, timezone);

  const [{ series: weightSeries, weightLog }, weekAdherence] = await Promise.all([
    buildWeightSeries(userId, 7, timezone, { todayKey, profile }),
    buildWeeklyAdherenceMetrics(userId, timezone),
  ]);
  const baseWeight = profile?.weight ?? null;
  const { trend: weightTrend, source: weightTrendSource } = buildWeightTrendFromSeries(
    weightSeries,
    weekly,
    baseWeight
  );
  const weightDelta = computeWeightDeltaWeek(weightLog, weightTrend);
  const { forecasts: predictionWeeks } = buildWeightForecast(weightSeries, baseWeight);

  const streak = computeStreak(heatmapWorkoutLogs, exerciseLogsSinceHeatmap, timezone);

  return {
    timezone,
    todayKey,
    weekStartKey,
    profile,
    weekly,
    prevWeekly,
    weekWorkoutsMerged,
    todayWorkoutsMerged,
    heatmapWorkoutsMerged,
    todayFoodLogs: weekFoodLogs.filter(
      (l) => l.loggedAt >= todayRange.start && l.loggedAt < todayRange.end
    ),
    todayExerciseLogs,
    weekExerciseLogs,
    weightTrend,
    weightTrendSource,
    weightDelta: weightDelta.value,
    weightDeltaSource: weightDelta.source,
    weightLog,
    predictionWeeks,
    streak,
    weekAdherence,
    todayRange,
    calorieHistoryFoodLogs,
    heatmapStartKey,
  };
}

module.exports = {
  tagged,
  dateKeyInTimezone,
  dowLabelForDateKey,
  loggedAtRangeFromDateKeys,
  resolveAthleteTimezone,
  summarizeFoodLogs,
  mergeWorkoutLogs,
  exerciseLogsToSyntheticSessions,
  buildWeeklyBuckets,
  computeStreak,
  buildNutritionDay,
  buildWorkoutDay,
  buildWeightSeries,
  buildWeightTrendFromSeries,
  buildWeightForecast,
  computeWeightDeltaWeek,
  buildReadinessToday,
  buildDerivedReadinessScore,
  buildWeeklyAdherenceMetrics,
  buildWeeklyAdherenceChart,
  buildDataProvenance,
  loadHomeMetricsContext,
  DOW_LABELS,
  DAY_MS,
};
