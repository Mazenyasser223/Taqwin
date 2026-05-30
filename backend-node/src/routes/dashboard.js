/**
 * Dashboard aggregations.
 *
 *   GET /api/dashboard/athlete      → weekly stats for the athlete dashboard
 *   GET /api/dashboard/athlete/home → full interactive home dashboard payload
 *   GET /api/dashboard/trainer   → counts + upcoming bookings for the trainer dashboard
 *   GET /api/dashboard/gym       → headcount, MRR proxy, check-ins, plan distribution
 */
const express = require('express');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const {
  buildAthletePersonalization,
  buildWeekPlan,
  buildCoachTip,
  buildAiRecommendations,
  buildAiAlerts,
  buildDailyMealPlan,
  enrichDailyMealPlanWithDbMacros,
  enrichTodayWorkoutExercises,
  defaultWorkoutExercises,
  estimateTargets,
  waterTargetMl,
  localizeValue,
} = require('../lib/athletePersonalization');
const { aggregateTodayMicronutrients } = require('../lib/todayMicronutrients');
const { parseWeightLog } = require('../lib/weightLog');

const { getOrCreateUserSettings } = require('../lib/userSettings');
const { resolveFoodDisplayName } = require('../lib/foodDisplayName');
const { resolveWorkoutDisplayTitle } = require('../lib/workoutTitleLocale');
const { parseExerciseLogNotes, computeWorkoutSetCompletionPct, computeWeekWorkoutCompletionPct } = require('../lib/exerciseLogNotes');

const router = express.Router();
router.use(authMiddleware);

/** Typical sleep hours from onboarding sleep band (mirrors frontend wellnessWidgets). */
function sleepHoursFromOnboarding(onboardingData) {
  const sleep = onboardingData?.sleep;
  const key = String(sleep || '').toLowerCase();
  if (key.includes('lt5') || key.includes('fewer')) return 4.5;
  if (key === '5-6' || key.includes('5-6') || key.includes('5–6')) return 5.5;
  if (key === '7-8' || key.includes('7-8') || key.includes('7–8')) return 7.5;
  if (key.includes('gt8') || key.includes('over 8')) return 8.5;
  const m = key.match(/(\d+)/g);
  if (m?.length) return Math.min(10, Math.max(4, Number(m[0])));
  return 7;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function utcDayStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function buildWeeklyBuckets(workoutLogs, foodLogs, weekStart) {
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.getTime() + i * DAY_MS);
    return {
      date: d.toISOString().slice(0, 10),
      day: DOW_LABELS[d.getUTCDay()],
      caloriesBurned: 0,
      caloriesEaten: 0,
      workouts: 0,
      minutes: 0,
    };
  });
  function bucketIndex(date) {
    return Math.min(6, Math.max(0, Math.floor((new Date(date).getTime() - weekStart.getTime()) / DAY_MS)));
  }
  for (const l of workoutLogs) {
    const i = bucketIndex(l.loggedAt);
    const factor = l.durationMin && l.workout?.durationMin ? l.durationMin / l.workout.durationMin : 1;
    buckets[i].caloriesBurned += Math.round((l.workout?.calories ?? 0) * factor);
    buckets[i].minutes += l.durationMin ?? l.workout?.durationMin ?? 0;
    buckets[i].workouts += 1;
  }
  for (const l of foodLogs) {
    const i = bucketIndex(l.loggedAt);
    const factor = l.grams / 100;
    buckets[i].caloriesEaten += Math.round((l.foodItem?.calories ?? 0) * factor);
  }
  return buckets;
}

/** Daily nutrition totals for chart history (e.g. last 28 days). */
function buildCalorieHistoryBuckets(foodLogs, rangeStart, dayCount) {
  const buckets = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(rangeStart.getTime() + i * DAY_MS);
    return {
      date: d.toISOString().slice(0, 10),
      caloriesEaten: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      logCount: 0,
    };
  });
  function bucketIndex(date) {
    return Math.min(
      dayCount - 1,
      Math.max(0, Math.floor((new Date(date).getTime() - rangeStart.getTime()) / DAY_MS))
    );
  }
  for (const l of foodLogs) {
    const i = bucketIndex(l.loggedAt);
    const factor = (l.grams ?? 100) / 100;
    buckets[i].caloriesEaten += Math.round((l.foodItem?.calories ?? 0) * factor);
    buckets[i].protein += (l.foodItem?.protein ?? 0) * factor;
    buckets[i].carbs += (l.foodItem?.carbs ?? 0) * factor;
    buckets[i].fat += (l.foodItem?.fat ?? 0) * factor;
    buckets[i].logCount += 1;
  }
  return buckets;
}

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function exerciseLogsToSyntheticSessions(exerciseLogs, defaultTitle = 'Training session') {
  const byDay = new Map();
  for (const log of exerciseLogs) {
    const key = dayKey(log.loggedAt);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(log);
  }
  const sessions = [];
  for (const [, logs] of byDay) {
    let durationSec = 0;
    for (const log of logs) {
      const parsed = parseExerciseLogNotes(log.notes);
      durationSec = Math.max(durationSec, parsed.durationSec || 0);
    }
    const durationMin =
      durationSec > 0 ? Math.max(1, Math.ceil(durationSec / 60)) : Math.max(15, logs.length * 4);
    const latest = logs.reduce((a, b) => (a.loggedAt > b.loggedAt ? a : b));
    sessions.push({
      id: `exercise-session-${dayKey(latest.loggedAt)}`,
      loggedAt: latest.loggedAt,
      durationMin,
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
  if (!exerciseLogs.length) return workoutLogs;
  const synthetic = exerciseLogsToSyntheticSessions(exerciseLogs);
  const daysWithWorkout = new Set(workoutLogs.map((l) => dayKey(l.loggedAt)));
  const extra = synthetic.filter((s) => !daysWithWorkout.has(dayKey(s.loggedAt)));
  return [...workoutLogs, ...extra];
}

function filterExerciseLogsByRange(logs, start, end) {
  return logs.filter((l) => {
    const t = new Date(l.loggedAt).getTime();
    return t >= start.getTime() && (!end || t < end.getTime());
  });
}

function computeStreak(workoutDatesSet) {
  let streak = 0;
  const cursor = utcDayStart();
  const todayKey = cursor.toISOString().slice(0, 10);
  if (!workoutDatesSet.has(todayKey)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  for (let i = 0; i < 365; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (workoutDatesSet.has(key)) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function buildHeatmap(workoutLogs, days = 28) {
  const map = new Map();
  for (const l of workoutLogs) {
    const key = new Date(l.loggedAt).toISOString().slice(0, 10);
    const prev = map.get(key) || { workouts: 0, minutes: 0 };
    prev.workouts += 1;
    prev.minutes += l.durationMin ?? l.workout?.durationMin ?? 0;
    map.set(key, prev);
  }
  const start = utcDayStart();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getTime() + i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    const cell = map.get(key) || { workouts: 0, minutes: 0 };
    return { date: key, day: DOW_LABELS[d.getUTCDay()], ...cell };
  });
}

router.get('/athlete/home', async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = utcDayStart(now);
    const todayEnd = new Date(todayStart.getTime() + DAY_MS);
    const weekStart = new Date(todayStart.getTime() - 6 * DAY_MS);
    const prevWeekStart = new Date(weekStart.getTime() - 7 * DAY_MS);
    const heatmapStart = new Date(todayStart.getTime() - 27 * DAY_MS);

    const [
      profile,
      weekWorkoutLogs,
      weekFoodLogs,
      prevWeekWorkoutLogs,
      prevWeekFoodLogs,
      heatmapWorkoutLogs,
      todayWorkoutLogs,
      todayFoodLogs,
      upcomingBookings,
      notifications,
      communityPosts,
      lastCheckIn,
      exerciseLogsSinceHeatmap,
      calorieHistoryFoodLogs,
    ] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: req.user.id } }),
      prisma.workoutLog.findMany({
        where: { userId: req.user.id, loggedAt: { gte: weekStart } },
        include: { workout: { select: { title: true, calories: true, durationMin: true, category: true } } },
      }),
      prisma.foodLog.findMany({
        where: { userId: req.user.id, loggedAt: { gte: weekStart } },
        include: {
          foodItem: {
            select: {
              name: true,
              calories: true,
              protein: true,
              carbs: true,
              fat: true,
              webtebId: true,
            },
          },
        },
      }),
      prisma.workoutLog.findMany({
        where: { userId: req.user.id, loggedAt: { gte: prevWeekStart, lt: weekStart } },
        include: { workout: { select: { calories: true, durationMin: true } } },
      }),
      prisma.foodLog.findMany({
        where: { userId: req.user.id, loggedAt: { gte: prevWeekStart, lt: weekStart } },
        include: { foodItem: { select: { calories: true, protein: true, carbs: true, fat: true } } },
      }),
      prisma.workoutLog.findMany({
        where: { userId: req.user.id, loggedAt: { gte: heatmapStart } },
        include: { workout: { select: { durationMin: true } } },
      }),
      prisma.workoutLog.findMany({
        where: { userId: req.user.id, loggedAt: { gte: todayStart, lt: todayEnd } },
        include: { workout: { select: { title: true, calories: true, durationMin: true, category: true } } },
        orderBy: { loggedAt: 'asc' },
      }),
      prisma.foodLog.findMany({
        where: { userId: req.user.id, loggedAt: { gte: todayStart, lt: todayEnd } },
        include: { foodItem: { select: { id: true, name: true, webtebId: true, calories: true, protein: true, carbs: true, fat: true } } },
        orderBy: { loggedAt: 'asc' },
      }),
      prisma.trainerBooking.findMany({
        where: {
          athleteId: req.user.id,
          scheduledAt: { gte: now },
          status: { in: ['pending', 'confirmed'] },
        },
        include: {
          trainer: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
      }),
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.communityPost.findMany({
        include: {
          author: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          _count: { select: { comments: true, likes: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      prisma.gymCheckIn.findFirst({
        where: { userId: req.user.id },
        orderBy: { checkedInAt: 'desc' },
        include: { gym: { select: { id: true, name: true, location: true } } },
      }),
      prisma.exerciseLog.findMany({
        where: { userId: req.user.id, loggedAt: { gte: heatmapStart } },
        orderBy: { loggedAt: 'asc' },
      }),
      prisma.foodLog.findMany({
        where: { userId: req.user.id, loggedAt: { gte: heatmapStart } },
        select: {
          loggedAt: true,
          grams: true,
          foodItem: { select: { calories: true, protein: true, carbs: true, fat: true } },
        },
      }),
    ]);

    const weekExerciseLogs = filterExerciseLogsByRange(exerciseLogsSinceHeatmap, weekStart);
    const prevWeekExerciseLogs = filterExerciseLogsByRange(
      exerciseLogsSinceHeatmap,
      prevWeekStart,
      weekStart
    );
    const todayExerciseLogs = filterExerciseLogsByRange(exerciseLogsSinceHeatmap, todayStart, todayEnd);

    const weekWorkoutsMerged = mergeWorkoutLogs(weekWorkoutLogs, weekExerciseLogs);
    const prevWeekWorkoutsMerged = mergeWorkoutLogs(prevWeekWorkoutLogs, prevWeekExerciseLogs);
    const heatmapWorkoutsMerged = mergeWorkoutLogs(heatmapWorkoutLogs, exerciseLogsSinceHeatmap);
    const todayWorkoutsMerged = mergeWorkoutLogs(todayWorkoutLogs, todayExerciseLogs);

    const weekly = buildWeeklyBuckets(weekWorkoutsMerged, weekFoodLogs, weekStart);
    const prevWeekly = buildWeeklyBuckets(prevWeekWorkoutsMerged, prevWeekFoodLogs, prevWeekStart);

    const totals = {
      caloriesBurned: weekly.reduce((s, b) => s + b.caloriesBurned, 0),
      caloriesEaten: weekly.reduce((s, b) => s + b.caloriesEaten, 0),
      minutes: weekly.reduce((s, b) => s + b.minutes, 0),
      workouts: weekly.reduce((s, b) => s + b.workouts, 0),
    };
    const prevTotals = {
      caloriesBurned: prevWeekly.reduce((s, b) => s + b.caloriesBurned, 0),
      caloriesEaten: prevWeekly.reduce((s, b) => s + b.caloriesEaten, 0),
      minutes: prevWeekly.reduce((s, b) => s + b.minutes, 0),
      workouts: prevWeekly.reduce((s, b) => s + b.workouts, 0),
    };

    function pctChange(current, previous) {
      if (!previous) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    }

    const todayNutrition = todayFoodLogs.reduce(
      (acc, l) => {
        const factor = l.grams / 100;
        acc.calories += Math.round((l.foodItem?.calories ?? 0) * factor);
        acc.protein += (l.foodItem?.protein ?? 0) * factor;
        acc.carbs += (l.foodItem?.carbs ?? 0) * factor;
        acc.fat += (l.foodItem?.fat ?? 0) * factor;
        acc.logCount += 1;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, logCount: 0 }
    );

    const todayBurned = todayWorkoutsMerged.reduce((s, l) => {
      const factor = l.durationMin && l.workout?.durationMin ? l.durationMin / l.workout.durationMin : 1;
      return s + Math.round((l.workout?.calories ?? 0) * factor);
    }, 0);

    const locale = (await getOrCreateUserSettings(req.user.id))?.language === 'en' ? 'en' : 'ar';
    const isAr = locale === 'ar';

    const personalization = buildAthletePersonalization(profile, locale);
    const targets = estimateTargets(profile);

    const hasWorkoutToday = todayWorkoutsMerged.length > 0 || todayExerciseLogs.length > 0;

    const workoutDatesSet = new Set(
      heatmapWorkoutsMerged.map((l) => new Date(l.loggedAt).toISOString().slice(0, 10))
    );
    const streak = computeStreak(workoutDatesSet);
    const heatmap = buildHeatmap(heatmapWorkoutsMerged, 28);
    const calorieHistory = buildCalorieHistoryBuckets(calorieHistoryFoodLogs, heatmapStart, 28);

    const foodNameCache = new Map();
    const workoutTitleCache = new Map();
    const localizedFoodTitle = async (food) => {
      const key = food?.id || food?.name || '';
      if (!key) return isAr ? 'وجبة' : 'Meal';
      if (foodNameCache.has(key)) return foodNameCache.get(key);
      const label = await resolveFoodDisplayName(food, locale, prisma);
      foodNameCache.set(key, label);
      return label;
    };
    const localizedWorkoutTitle = async (title) => {
      const key = title || '__empty__';
      if (workoutTitleCache.has(key)) return workoutTitleCache.get(key);
      const label = await resolveWorkoutDisplayTitle(title, locale);
      workoutTitleCache.set(key, label);
      return label;
    };

    const timeline = (
      await Promise.all([
        ...todayFoodLogs.map(async (l) => ({
          id: l.id,
          type: 'food',
          at: l.loggedAt,
          title: await localizedFoodTitle(l.foodItem),
          subtitle: `${Math.round((l.foodItem?.calories ?? 0) * (l.grams / 100))} ${isAr ? 'سعرة' : 'kcal'}`,
          icon: 'restaurant',
        })),
        ...todayWorkoutsMerged.map(async (l) => ({
          id: l.id,
          type: 'workout',
          at: l.loggedAt,
          title: await localizedWorkoutTitle(l.workout?.title),
          subtitle: `${l.durationMin ?? l.workout?.durationMin ?? 0} ${isAr ? 'د' : 'min'}`,
          icon: 'fitness_center',
        })),
      ])
    ).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const todayWorkoutsLocalized = await Promise.all(
      todayWorkoutsMerged.map(async (l) => ({
        id: l.id,
        title: await localizedWorkoutTitle(l.workout?.title),
        durationMin: l.durationMin ?? l.workout?.durationMin,
        loggedAt: l.loggedAt,
      })),
    );

    const coachTip = buildCoachTip({
      profile,
      today: { nutrition: todayNutrition, workouts: todayWorkoutsMerged },
      targets,
      streak,
      totals,
      personalization,
      locale,
    });

    const aiAlerts = buildAiAlerts({
      profile,
      today: { nutrition: todayNutrition, workouts: todayWorkoutsMerged },
      targets,
      totals,
      weekly,
      personalization,
    });

    const aiRecommendations = buildAiRecommendations({
      profile,
      today: { nutrition: todayNutrition, workouts: todayWorkoutsMerged },
      targets,
      totals,
      weekly,
      personalization,
    });

    const calorieAdherenceToday =
      targets.calorieTarget > 0
        ? Math.round((todayNutrition.calories / targets.calorieTarget) * 100)
        : 0;
    const proteinAdherenceToday =
      targets.proteinTarget > 0
        ? Math.round((todayNutrition.protein / targets.proteinTarget) * 100)
        : 0;
    const workoutDaysWeek = weekly.filter((d) => d.workouts > 0).length;
    const plannedTrainingDays = personalization.trainingDaysPerWeek || 4;
    let workoutCompletionWeek = 0;

    const baseWeight = profile?.weight ?? null;
    const weightTrend = weekly.map((d, i) => ({
      label: d.day,
      weight:
        baseWeight != null
          ? Math.round((baseWeight - (6 - i) * 0.2 + (d.caloriesEaten - d.caloriesBurned) * 0.002) * 10) / 10
          : null,
    }));

    const weightLog = parseWeightLog(profile?.onboardingData);
    let weightDeltaWeek = 0;
    if (weightLog.length >= 2) {
      const byWeek = new Map();
      for (const entry of weightLog) {
        const d = new Date(`${entry.date}T12:00:00`);
        const day = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((day + 6) % 7));
        const ws = monday.toISOString().slice(0, 10);
        const prev = byWeek.get(ws);
        if (!prev || entry.date >= prev.date) byWeek.set(ws, entry);
      }
      const weekWeights = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, e]) => e.weight);
      if (weekWeights.length >= 2) {
        weightDeltaWeek =
          Math.round((weekWeights[weekWeights.length - 1] - weekWeights[weekWeights.length - 2]) * 10) / 10;
      }
    } else if (
      weightTrend.length >= 2 &&
      weightTrend[0].weight != null &&
      weightTrend[6].weight != null
    ) {
      weightDeltaWeek = Math.round((weightTrend[6].weight - weightTrend[0].weight) * 10) / 10;
    }

    const weeklyAdherence = {
      categories: ['Workout', 'Calories', 'Protein', 'Activity', 'Consistency'],
      values: [
        workoutCompletionWeek,
        calorieAdherenceToday,
        proteinAdherenceToday,
        Math.min(100, Math.round((totals.minutes / 150) * 100)),
        Math.min(100, streak * 14),
      ],
    };

    const volumeProgress = weekly.map((d) => ({
      label: d.day,
      volume: d.minutes * Math.max(1, d.workouts),
    }));

    const predictionWeeks = weekly.map((d, i) => ({
      label: d.day,
      actual: baseWeight != null ? weightTrend[i].weight : null,
    }));
    if (baseWeight != null) {
      let last = weightTrend[6].weight ?? baseWeight;
      for (let i = 1; i <= 4; i++) {
        const deficit = totals.caloriesEaten - totals.caloriesBurned;
        last = Math.round((last - (deficit > 0 ? 0.08 : -0.05) * i) * 10) / 10;
        predictionWeeks.push({
          label: `+${i}w`,
          actual: null,
          forecast: last,
        });
      }
    }

    const todayKey = todayStart.toISOString().slice(0, 10);
    const weekPlan = buildWeekPlan(weekly, profile?.onboardingData, todayKey, locale);

    const waterFromLogs = todayFoodLogs
      .filter((l) => /water|ماء|hydrat/i.test(l.foodItem?.name ?? ''))
      .reduce((s, l) => s + Math.max(l.grams ?? 0, 200), 0);

    const dietToday = {
      calories: { current: todayNutrition.calories, target: targets.calorieTarget },
      protein: { current: todayNutrition.protein, target: targets.proteinTarget },
      carbs: { current: todayNutrition.carbs, target: targets.carbTarget },
      fat: { current: todayNutrition.fat, target: targets.fatTarget },
      water: {
        currentMl: waterFromLogs,
        targetMl: waterTargetMl(profile?.onboardingData),
      },
    };

    const plannedExercises = await enrichTodayWorkoutExercises(
      prisma,
      defaultWorkoutExercises(profile?.fitnessGoal, profile?.onboardingData, locale)
    );
    const workoutCompletionToday = computeWorkoutSetCompletionPct(
      todayExerciseLogs,
      plannedExercises
    );
    workoutCompletionWeek = computeWeekWorkoutCompletionPct(
      weekExerciseLogs,
      plannedExercises,
      plannedTrainingDays
    );
    weeklyAdherence.values[0] = workoutCompletionWeek;
    const loggedPlanTitle =
      todayWorkoutsMerged.length > 0
        ? await localizedWorkoutTitle(todayWorkoutsMerged[0]?.workout?.title)
        : null;
    const todayWorkoutPlan = {
      hasLoggedToday: hasWorkoutToday,
      title:
        loggedPlanTitle ??
        personalization.planTitle ??
        (profile?.fitnessGoal
          ? `${localizeValue(profile.fitnessGoal, locale) || profile.fitnessGoal} ${isAr ? 'جلسة' : 'session'}`
          : isAr
            ? 'جلسة تدريب'
            : 'Training session'),
      durationMin:
        todayWorkoutsMerged[0]?.durationMin ??
        todayWorkoutsMerged[0]?.workout?.durationMin ??
        personalization.workoutDurationMin ??
        45,
      exercisesCount: todayExerciseLogs.length || plannedExercises.length,
      exercises: plannedExercises,
    };

    const todayMealPlan = await enrichDailyMealPlanWithDbMacros(
      prisma,
      buildDailyMealPlan(profile, targets, locale)
    );

    const sleepHours = sleepHoursFromOnboarding(profile?.onboardingData);
    const sleepMet = sleepHours > 6;
    const mealSlotCount = (todayMealPlan?.slots ?? []).filter(
      (s) => s.kind === 'meal' || s.kind === 'snack'
    ).length;
    const mealsMet =
      mealSlotCount > 0
        ? todayNutrition.logCount >= mealSlotCount
        : todayNutrition.logCount > 0;
    const waterTarget = dietToday.water.targetMl;
    const waterMet = waterTarget > 0 && dietToday.water.currentMl >= waterTarget;
    const workoutMet = workoutCompletionToday >= 100;
    const readinessScore =
      (sleepMet ? 25 : 0) +
      (mealsMet ? 25 : 0) +
      (waterMet ? 25 : 0) +
      (workoutMet ? 25 : 0);

    const todayMicronutrients = await aggregateTodayMicronutrients(prisma, todayFoodLogs);

    res.json({
      weekly,
      calorieHistory,
      totals,
      comparison: {
        workouts: pctChange(totals.workouts, prevTotals.workouts),
        minutes: pctChange(totals.minutes, prevTotals.minutes),
        caloriesBurned: pctChange(totals.caloriesBurned, prevTotals.caloriesBurned),
        caloriesEaten: pctChange(totals.caloriesEaten, prevTotals.caloriesEaten),
      },
      today: {
        date: todayStart.toISOString().slice(0, 10),
        nutrition: todayNutrition,
        caloriesBurned: todayBurned,
        workouts: todayWorkoutsLocalized,
        readinessScore,
        readiness: {
          workout: workoutMet,
          nutrition: mealsMet,
          proteinProgress: Math.round((todayNutrition.protein / targets.proteinTarget) * 100),
        },
      },
      targets,
      streak,
      heatmap,
      timeline,
      coachTip,
      aiAlerts,
      aiRecommendations,
      personalization,
      profile: {
        displayName: profile?.displayName ?? null,
        weight: profile?.weight ?? null,
        height: profile?.height ?? null,
        fitnessGoal: profile?.fitnessGoal ?? null,
        fitnessLevel: profile?.fitnessLevel ?? null,
      },
      upcoming: {
        bookings: upcomingBookings.map((b) => ({
          id: b.id,
          scheduledAt: b.scheduledAt,
          status: b.status,
          trainer: b.trainer?.profile?.displayName ?? 'Trainer',
          avatarUrl: b.trainer?.profile?.avatarUrl ?? null,
        })),
        notifications: notifications.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          read: n.read,
          createdAt: n.createdAt,
          link: n.link,
        })),
        lastCheckIn: lastCheckIn
          ? {
              gymName: lastCheckIn.gym?.name,
              location: lastCheckIn.gym?.location,
              checkedInAt: lastCheckIn.checkedInAt,
            }
          : null,
      },
      community: communityPosts.map((p) => ({
        id: p.id,
        content: p.content.slice(0, 120) + (p.content.length > 120 ? '…' : ''),
        likesCount: p._count?.likes ?? p.likesCount ?? 0,
        commentsCount: p._count?.comments ?? 0,
        createdAt: p.createdAt,
        author: p.author?.profile?.displayName ?? 'Member',
        avatarUrl: p.author?.profile?.avatarUrl ?? null,
      })),
      analytics: {
        calorieAdherenceToday,
        proteinAdherenceToday,
        workoutCompletionWeek,
        workoutCompletionToday,
        weightDeltaWeek,
        bodyScore: readinessScore,
        weightLog,
        weightTrend,
        weeklyAdherence,
        volumeProgress,
        prediction: predictionWeeks,
        todayWorkoutPlan,
        weekPlan,
        dietToday,
        todayMealPlan,
        todayMicronutrients,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/athlete', async (req, res, next) => {
  try {
    const now = new Date();
    const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));

    const [workoutLogs, foodLogs, latestProfile] = await Promise.all([
      prisma.workoutLog.findMany({
        where: { userId: req.user.id, loggedAt: { gte: weekStart } },
        include: { workout: { select: { calories: true, durationMin: true, category: true } } },
      }),
      prisma.foodLog.findMany({
        where: { userId: req.user.id, loggedAt: { gte: weekStart } },
        include: { foodItem: { select: { calories: true, protein: true } } },
      }),
      prisma.profile.findUnique({ where: { userId: req.user.id } }),
    ]);

    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart.getTime() + i * DAY_MS);
      return {
        date: d.toISOString().slice(0, 10),
        day: DOW_LABELS[d.getUTCDay()],
        caloriesBurned: 0,
        caloriesEaten: 0,
        workouts: 0,
        minutes: 0,
      };
    });
    function bucketIndex(date) {
      return Math.min(6, Math.max(0, Math.floor((new Date(date).getTime() - weekStart.getTime()) / DAY_MS)));
    }
    for (const l of workoutLogs) {
      const i = bucketIndex(l.loggedAt);
      const factor = l.durationMin && l.workout?.durationMin ? l.durationMin / l.workout.durationMin : 1;
      buckets[i].caloriesBurned += Math.round((l.workout?.calories ?? 0) * factor);
      buckets[i].minutes += l.durationMin ?? l.workout?.durationMin ?? 0;
      buckets[i].workouts += 1;
    }
    for (const l of foodLogs) {
      const i = bucketIndex(l.loggedAt);
      const factor = l.grams / 100;
      buckets[i].caloriesEaten += Math.round((l.foodItem?.calories ?? 0) * factor);
    }

    const totalBurned = buckets.reduce((s, b) => s + b.caloriesBurned, 0);
    const totalEaten = buckets.reduce((s, b) => s + b.caloriesEaten, 0);
    const totalMinutes = buckets.reduce((s, b) => s + b.minutes, 0);
    const totalWorkouts = buckets.reduce((s, b) => s + b.workouts, 0);

    res.json({
      weekly: buckets,
      totals: {
        caloriesBurned: totalBurned,
        caloriesEaten: totalEaten,
        minutes: totalMinutes,
        workouts: totalWorkouts,
      },
      profile: {
        weight: latestProfile?.weight ?? null,
        height: latestProfile?.height ?? null,
        fitnessGoal: latestProfile?.fitnessGoal ?? null,
        fitnessLevel: latestProfile?.fitnessLevel ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/trainer', async (req, res, next) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Trainer role required' });
    }
    const now = new Date();
    const [allBookings, upcomingBookings] = await Promise.all([
      prisma.trainerBooking.findMany({ where: { trainerId: req.user.id } }),
      prisma.trainerBooking.findMany({
        where: { trainerId: req.user.id, scheduledAt: { gte: now }, status: { in: ['pending', 'confirmed'] } },
        include: {
          athlete: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
      }),
    ]);
    const distinctClients = new Set(allBookings.map((b) => b.athleteId));
    const completed = allBookings.filter((b) => b.status === 'completed').length;

    res.json({
      totals: {
        clients: distinctClients.size,
        completedSessions: completed,
        upcomingSessions: upcomingBookings.length,
      },
      upcoming: upcomingBookings,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/gym', async (req, res, next) => {
  try {
    if (req.user.role !== 'gym') {
      return res.status(403).json({ error: 'Gym role required' });
    }
    const myGym = await prisma.gym.findFirst({ where: { ownerId: req.user.id } });
    if (!myGym) {
      return res.json({ hasGym: false });
    }
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

    const [memberships, monthlyCheckIns, weekCheckIns] = await Promise.all([
      prisma.gymMembership.findMany({ where: { gymId: myGym.id } }),
      prisma.gymCheckIn.findMany({
        where: { gymId: myGym.id, checkedInAt: { gte: sixMonthsAgo } },
        select: { checkedInAt: true },
      }),
      prisma.gymCheckIn.count({ where: { gymId: myGym.id, checkedInAt: { gte: weekAgo } } }),
    ]);

    const activeMembers = memberships.filter((m) => m.isActive && (!m.expiresAt || m.expiresAt > now)).length;
    const newThisMonth = memberships.filter((m) => m.joinedAt >= monthStart).length;

    const monthsSeries = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
      return {
        month: d.toLocaleString('en-US', { month: 'short' }),
        date: d.toISOString().slice(0, 7),
        checkIns: 0,
      };
    });
    for (const c of monthlyCheckIns) {
      const key = c.checkedInAt.toISOString().slice(0, 7);
      const m = monthsSeries.find((s) => s.date === key);
      if (m) m.checkIns += 1;
    }

    res.json({
      hasGym: true,
      gym: { id: myGym.id, name: myGym.name, location: myGym.location },
      totals: {
        members: memberships.length,
        activeMembers,
        newThisMonth,
        weekCheckIns,
        capacity: myGym.maxCapacity,
        utilization: myGym.maxCapacity ? Math.round((activeMembers / myGym.maxCapacity) * 100) : 0,
      },
      monthlySeries: monthsSeries,
      planDistribution: [
        { name: 'Active', value: activeMembers },
        { name: 'Inactive', value: memberships.length - activeMembers },
      ],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
