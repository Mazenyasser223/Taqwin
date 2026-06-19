/**
 * Dashboard aggregations.
 *
 *   GET /api/dashboard/athlete      → weekly stats for the athlete dashboard
 *   GET /api/dashboard/athlete/home → full interactive home dashboard payload
 *   GET /api/dashboard/gym       → headcount, MRR proxy, check-ins, plan distribution
 */
const express = require('express');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { attachProfile, USER_PUBLIC_SELECT } = require('../lib/profile');
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
const {
  loadDashboardTodayPlanContext,
  loadDashboardWeekPlanContext,
  buildDashboardPlanMeta,
  buildProgressSummary,
  buildNextAction,
  sanitizePlanInsight,
} = require('../lib/plans/dashboardTodayPlan');
const {
  getCoachPlanFromOnboarding,
  resolveWorkoutForDate,
  resolveDietForDate,
  coachPlanMeta,
  shouldGenerateCoachPlan,
  generateAndPersistCoachPlan,
} = require('../lib/coachPlan');

const { scaledMacrosFromLog } = require('../lib/foodLogSnapshot');
const { getOrCreateUserSettings } = require('../lib/userSettings');
const { resolveWorkoutDisplayTitle } = require('../lib/workoutTitleLocale');
const { computeWorkoutSetCompletionPct, computeWeekWorkoutCompletionPct } = require('../lib/exerciseLogNotes');
const {
  getActivePlanForRequest,
  todayWorkoutDay,
  todayDietDay,
} = require('../services/activePlanService');
const { loadGymDashboardCore } = require('../lib/gymDashboard');
const { parseCheckInsRange, buildCheckInSeriesForGym } = require('../lib/gymCheckInSeries');
const { resolveGymDisplayName } = require('../lib/gymBrandName');
const { ensureGymForOwner } = require('../lib/provisionGym');
const { getWeeklyReviewStatus } = require('../lib/adaptation/weeklyReview');
const {
  loadHomeMetricsContext,
  buildReadinessToday,
  buildDerivedReadinessScore,
  buildWeeklyAdherenceChart,
  buildDataProvenance,
  dateKeyInTimezone,
  resolveAthleteTimezone,
  DAY_MS,
  DOW_LABELS,
} = require('../lib/athleteMetrics');
const { calendarDateOnly, addCalendarDays } = require('../lib/plans/planCalendar');
const {
  getCachedDashboardHome,
  setCachedDashboardHome,
} = require('../lib/dashboardCache');

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
    const scaled = scaledMacrosFromLog(l);
    buckets[i].caloriesEaten += scaled.calories;
    buckets[i].protein += scaled.protein;
    buckets[i].carbs += scaled.carbs;
    buckets[i].fat += scaled.fat;
    buckets[i].logCount += 1;
  }
  return buckets;
}

function buildHeatmap(workoutLogs, days = 28, timezone = 'UTC', anchorDate = new Date()) {
  const map = new Map();
  for (const l of workoutLogs) {
    const key = dateKeyInTimezone(l.loggedAt, timezone);
    const prev = map.get(key) || { workouts: 0, minutes: 0 };
    prev.workouts += 1;
    prev.minutes += l.durationMin ?? l.workout?.durationMin ?? 0;
    map.set(key, prev);
  }
  const todayKey = calendarDateOnly(anchorDate, timezone);
  const start = addCalendarDays(todayKey, -(days - 1));
  return Array.from({ length: days }, (_, i) => {
    const d = addCalendarDays(start, i);
    const key = d.toISOString().slice(0, 10);
    const cell = map.get(key) || { workouts: 0, minutes: 0 };
    return { date: key, day: DOW_LABELS[d.getUTCDay()], ...cell };
  });
}

router.get('/athlete/home', async (req, res, next) => {
  try {
    const now = new Date();

    if (process.env.FEATURE_DASHBOARD_CACHE !== 'false') {
      const timezone = await resolveAthleteTimezone(req.user.id);
      const todayKey = dateKeyInTimezone(now, timezone);
      const cached = await getCachedDashboardHome(req.user.id, todayKey);
      if (cached && typeof cached === 'object' && cached.today?.date === todayKey) {
        return res.json(cached);
      }
    }

    const metrics = await loadHomeMetricsContext(req.user.id, now);
    const todayKey = metrics.todayKey;

    const {
      timezone,
      profile,
      weekly,
      prevWeekly,
      todayWorkoutsMerged,
      heatmapWorkoutsMerged,
      todayFoodLogs,
      todayExerciseLogs,
      weekExerciseLogs,
      weightTrend,
      weightDelta,
      weightLog,
      predictionWeeks,
      streak,
      weekAdherence,
      calorieHistoryFoodLogs,
      heatmapStartKey,
    } = metrics;

    const [
      notifications,
      communityPosts,
      lastCheckIn,
    ] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.communityPost.findMany({
        include: {
          author: { select: USER_PUBLIC_SELECT },
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
    ]);

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

    const todayBurned = todayWorkoutsMerged.reduce((s, l) => {
      const factor = l.durationMin && l.workout?.durationMin ? l.durationMin / l.workout.durationMin : 1;
      return s + Math.round((l.workout?.calories ?? 0) * factor);
    }, 0);

    const locale = (await getOrCreateUserSettings(req.user.id))?.language === 'en' ? 'en' : 'ar';
    const isAr = locale === 'ar';

    const personalization = buildAthletePersonalization(profile, locale);
    const baseTargets = estimateTargets(profile);

    const [activePlan, c6Today, c6Week] = await Promise.all([
      getActivePlanForRequest(req, req.user.id),
      loadDashboardTodayPlanContext(req.user.id, now, locale),
      loadDashboardWeekPlanContext(req.user.id, now),
    ]);
    const planTargets = activePlan?.dailyTargets || null;
    const targets = c6Today?.targets
      ? c6Today.targets
      : planTargets
        ? {
            calorieTarget: planTargets.calories,
            proteinTarget: planTargets.protein,
            carbTarget: planTargets.carbs,
            fatTarget: planTargets.fat,
            waterMl: planTargets.waterMl,
          }
        : baseTargets;

    const hasWorkoutToday = todayWorkoutsMerged.length > 0;

    const heatmap = buildHeatmap(heatmapWorkoutsMerged, 28, timezone, now);
    const heatmapStartDate = new Date(`${heatmapStartKey}T00:00:00.000Z`);
    const calorieHistory = buildCalorieHistoryBuckets(calorieHistoryFoodLogs, heatmapStartDate, 28);

    const workoutTitleCache = new Map();
    const localizedWorkoutTitle = async (title) => {
      const key = title || '__empty__';
      if (workoutTitleCache.has(key)) return workoutTitleCache.get(key);
      const label = await resolveWorkoutDisplayTitle(title, locale);
      workoutTitleCache.set(key, label);
      return label;
    };

    const foodLogTimelineTitle = (log) => {
      if (log.snapshotName) return log.snapshotName;
      const name = log.foodItem?.name?.trim();
      if (name) return name;
      return isAr ? 'وجبة' : 'Meal';
    };

    const timeline = (
      await Promise.all([
        ...todayFoodLogs.map((l) => ({
          id: l.id,
          type: 'food',
          at: l.loggedAt,
          title: foodLogTimelineTitle(l),
          subtitle: `${scaledMacrosFromLog(l).calories} ${isAr ? 'سعرة' : 'kcal'}`,
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

    let coachPlan = getCoachPlanFromOnboarding(profile?.onboardingData);
    if (shouldGenerateCoachPlan(profile?.onboardingData)) {
      try {
        coachPlan = await generateAndPersistCoachPlan(prisma, req.user.id, locale);
      } catch {
        /* non-fatal — fall back to rules below */
      }
    }

    const aiAlerts = buildAiAlerts({
      profile,
      today: { nutrition: todayNutrition, workouts: todayWorkoutsMerged },
      targets,
      totals,
      weekly,
      personalization,
    });
    if (coachPlan?.aiSummary?.trim()) {
      aiAlerts.nutrition.unshift({
        id: 'coach-plan-summary',
        category: 'nutrition',
        source: 'ai',
        priority: 'medium',
        key: null,
        params: undefined,
        message: coachPlan.aiSummary.trim(),
        link: null,
        createdAt: new Date().toISOString(),
      });
      aiAlerts.source = 'mixed';
    }

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
    let workoutCompletionWeek = weekAdherence.workoutPct;
    const weightDeltaWeek = weightDelta;

    const activityPct = Math.min(100, Math.round((totals.minutes / 150) * 100));
    const weeklyAdherence = buildWeeklyAdherenceChart(
      calorieAdherenceToday,
      proteinAdherenceToday,
      workoutCompletionWeek,
      weekAdherence.consistencyPct,
      activityPct
    );

    const volumeProgress = weekly.map((d) => ({
      label: d.day,
      volume: d.minutes * Math.max(1, d.workouts),
    }));

    const predictionChart = [
      ...weekly.map((d, i) => ({
        label: d.day,
        actual: weightTrend[i]?.weight ?? null,
        source: weightTrend[i]?.source ?? null,
      })),
      ...predictionWeeks,
    ];

    const weekPlan = buildWeekPlan(weekly, profile?.onboardingData, todayKey, locale);

    const waterFromLogs = todayFoodLogs
      .filter((l) => /water|ماء|hydrat/i.test(l.foodItem?.name ?? ''))
      .reduce((s, l) => s + Math.max(l.grams ?? 0, 200), 0);

    const planDietDay = todayDietDay(activePlan, now);
    const planWorkoutDay = todayWorkoutDay(activePlan, now);
    const todayMeals = c6Today?.meals?.length
      ? c6Today.meals
      : planDietDay
        ? planDietDay.meals.map((m) => ({
            slot: m.slot,
            name: m.name,
            grams: m.grams,
            calories: m.calories,
            protein: m.protein,
            carbs: m.carbs,
            fat: m.fat,
            foodItemId: m.foodItemId || null,
            webtebId: m.webtebId ?? null,
            notes: m.notes || '',
          }))
        : [];

    const dietToday = {
      calories: { current: todayNutrition.calories, target: targets.calorieTarget },
      protein: { current: todayNutrition.protein, target: targets.proteinTarget },
      carbs: { current: todayNutrition.carbs, target: targets.carbTarget },
      fat: { current: todayNutrition.fat, target: targets.fatTarget },
      water: {
        currentMl: waterFromLogs,
        targetMl: targets.waterMl ?? waterTargetMl(profile?.onboardingData),
      },
      meals: todayMeals,
      planSource: c6Today?.planSource ?? (activePlan ? activePlan.source : null),
      planVersion: activePlan ? activePlan.version : null,
      storage: c6Today ? 'postgres' : activePlan ? 'legacy' : null,
    };

    const planExercisesForCoach = coachPlan
      ? resolveWorkoutForDate(coachPlan, todayKey, todayKey)
      : null;
    const planExercisesFromActive =
      planWorkoutDay && !planWorkoutDay.isRest && Array.isArray(planWorkoutDay.exercises)
        ? planWorkoutDay.exercises.map((e) => ({
            name: e.name,
            sets: e.sets,
            reps: e.reps,
            restSec: e.restSec ?? 90,
            notes: e.notes || '',
            exerciseId: e.exerciseId || null,
          }))
        : null;
    const rawPlannedExercises = c6Today
      ? c6Today.isRest
        ? []
        : c6Today.exercises
      : planExercisesFromActive?.length
        ? planExercisesFromActive
        : planExercisesForCoach?.length
          ? planExercisesForCoach
          : defaultWorkoutExercises(profile?.fitnessGoal, profile?.onboardingData ?? {}, locale);
    const plannedExercises = await enrichTodayWorkoutExercises(prisma, rawPlannedExercises);
    const workoutCompletionToday = computeWorkoutSetCompletionPct(
      todayExerciseLogs,
      plannedExercises
    );
    const plannedTrainingDays = weekAdherence.raw?.plannedTrainingDays ?? 4;
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
    const isPlanRestToday = c6Today ? c6Today.isRest : Boolean(planWorkoutDay?.isRest);
    const todayWorkoutPlan = {
      hasLoggedToday: hasWorkoutToday,
      isRest: isPlanRestToday,
      planSource:
        c6Today?.planSource ?? (activePlan ? activePlan.source : coachPlan?.source ?? 'rules'),
      storage: c6Today ? 'postgres' : activePlan ? 'legacy' : null,
      title: isPlanRestToday
        ? isAr
          ? 'يوم راحة'
          : 'Rest day'
        : (loggedPlanTitle ??
            coachPlan?.workout?.title ??
            planWorkoutDay?.label ??
            personalization.planTitle ??
            (profile?.fitnessGoal
              ? `${localizeValue(profile.fitnessGoal, locale) || profile.fitnessGoal} ${isAr ? 'جلسة' : 'session'}`
              : isAr
                ? 'جلسة تدريب'
                : 'Training session')),
      durationMin:
        todayWorkoutsMerged[0]?.durationMin ??
        todayWorkoutsMerged[0]?.workout?.durationMin ??
        coachPlan?.workout?.durationMin ??
        personalization.workoutDurationMin ??
        45,
      exercisesCount: todayExerciseLogs.length || plannedExercises.length,
      exercises: plannedExercises,
    };

    const dietFromCoach = coachPlan ? resolveDietForDate(coachPlan, todayKey, todayKey) : null;
    const todayMealPlan = await enrichDailyMealPlanWithDbMacros(
      prisma,
      dietFromCoach?.slots?.length
        ? dietFromCoach
        : buildDailyMealPlan(profile, targets, locale)
    );
    if (todayMealPlan && coachPlan) {
      todayMealPlan.planSource = coachPlan.source;
    }

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

    const readinessFromLog = await buildReadinessToday(req.user.id, todayKey);
    let readinessScore;
    let readinessSource = 'derived';
    if (readinessFromLog) {
      readinessScore = readinessFromLog.score;
      readinessSource = readinessFromLog.source;
    } else {
      const derived = buildDerivedReadinessScore({ sleepMet, mealsMet, waterMet, workoutMet });
      readinessScore = derived.score;
      readinessSource = derived.source;
    }

    const dataProvenance = buildDataProvenance({
      weightTrendSource: metrics.weightTrendSource,
      weightDeltaSource: metrics.weightDeltaSource,
      readinessSource,
      nutritionSource: todayNutrition.logCount > 0 ? 'logged' : 'derived',
      workoutSource: hasWorkoutToday ? 'logged' : 'derived',
      consistencySource: weekAdherence.source,
      timezone,
    });

    const todayMicronutrients = await aggregateTodayMicronutrients(prisma, todayFoodLogs);

    const activePlanSummary = activePlan
      ? {
          id: String(activePlan._id),
          version: activePlan.version,
          source: activePlan.source,
          createdAt: activePlan.createdAt,
          dietDaysCount: activePlan.dietDays?.length ?? 0,
          workoutWeeksCount: activePlan.workoutWeeks?.length ?? 0,
          coachNotes: activePlan.coachNotes || '',
        }
      : null;

    const progressSummary = buildProgressSummary({
      calorieAdherenceToday,
      proteinAdherenceToday,
      workoutCompletionToday,
      workoutCompletionWeek,
      weightDeltaWeek,
      bodyScore: readinessScore,
    });
    const aiInsights =
      sanitizePlanInsight(c6Today?.explainabilityText) ||
      sanitizePlanInsight(typeof coachTip === 'string' ? coachTip : coachTip?.message) ||
      (c6Today
        ? locale === 'ar'
          ? 'خطة أسبوعية من إجاباتك — عدّل التمارين والوجبات كما تشاء.'
          : 'Weekly plan from your answers — edit workouts and meals anytime.'
        : null);
    const nextAction = buildNextAction({
      isRest: isPlanRestToday,
      hasLoggedWorkout: hasWorkoutToday,
      workoutCompletionToday,
      mealsMet,
      explainabilityText: sanitizePlanInsight(c6Today?.explainabilityText),
      locale,
    });

    const weeklyAdaptation = await getWeeklyReviewStatus(req.user.id, { locale }).catch(() => null);

    const payload = {
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
        date: todayKey,
        timezone,
        nutrition: todayNutrition,
        caloriesBurned: todayBurned,
        workouts: todayWorkoutsLocalized,
        readinessScore,
        readinessSource,
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
      community: communityPosts.map((p) => {
        const author = attachProfile(p.author);
        return {
          id: p.id,
          content: p.content.slice(0, 120) + (p.content.length > 120 ? '…' : ''),
          likesCount: p._count?.likes ?? p.likesCount ?? 0,
          commentsCount: p._count?.comments ?? 0,
          createdAt: p.createdAt,
          author: author?.profile?.displayName ?? author?.profile?.businessName ?? 'Member',
          avatarUrl: author?.profile?.avatarUrl ?? null,
        };
      }),
      activePlan: activePlanSummary,
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
        prediction: predictionChart,
        dataProvenance,
        todayWorkoutPlan,
        weekPlan,
        dietToday,
        todayMealPlan,
        todayMicronutrients,
        coachPlan: coachPlanMeta(coachPlan),
      },
      todayPlan: c6Today?.formatted ?? null,
      officialWeekPlan: c6Week ?? null,
      planMeta: buildDashboardPlanMeta(c6Week),
      todayWorkout: {
        hasLoggedToday: todayWorkoutPlan.hasLoggedToday,
        isRest: todayWorkoutPlan.isRest,
        title: todayWorkoutPlan.title,
        durationMin: todayWorkoutPlan.durationMin,
        exercisesCount: todayWorkoutPlan.exercisesCount,
        exercises: todayWorkoutPlan.exercises,
        planSource: todayWorkoutPlan.planSource,
        storage: todayWorkoutPlan.storage ?? null,
      },
      todayDiet: {
        calories: dietToday.calories,
        protein: dietToday.protein,
        carbs: dietToday.carbs,
        fat: dietToday.fat,
        water: dietToday.water,
        meals: dietToday.meals,
        planSource: dietToday.planSource,
        dailyTargets: c6Today?.formatted?.dailyTargets ?? null,
        storage: dietToday.storage ?? null,
      },
      progressSummary,
      aiInsights,
      nextAction,
      weeklyAdaptation,
    };

    if (process.env.FEATURE_DASHBOARD_CACHE !== 'false') {
      await setCachedDashboardHome(req.user.id, todayKey, payload).catch(() => null);
    }

    res.json(payload);
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
      prisma.athleteProfile.findUnique({ where: { userId: req.user.id } }),
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
      buckets[i].caloriesEaten += scaledMacrosFromLog(l).calories;
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

router.get('/gym/check-ins', async (req, res, next) => {
  try {
    if (req.user.role !== 'gym') {
      return res.status(403).json({ error: 'Gym role required' });
    }
    await ensureGymForOwner(req.user.id);
    const myGym = await prisma.gym.findFirst({ where: { ownerId: req.user.id } });
    if (!myGym) {
      return res.status(404).json({ error: 'Gym not found' });
    }
    const range = parseCheckInsRange(req.query.checkInsRange);
    const payload = await buildCheckInSeriesForGym(prisma, myGym.id, range);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

/** Lightweight gym id/name for reception, equipment, etc. — one DB query, no aggregations. */
router.get('/gym/context', async (req, res, next) => {
  try {
    if (req.user.role !== 'gym') {
      return res.status(403).json({ error: 'Gym role required' });
    }
    await ensureGymForOwner(req.user.id);
    const myGym = await prisma.gym.findFirst({
      where: { ownerId: req.user.id },
      include: { owner: { select: { gymProfile: { select: { businessName: true } } } } },
    });
    if (!myGym) {
      return res.json({ hasGym: false });
    }
    const displayName = resolveGymDisplayName(myGym.name, myGym.owner?.gymProfile?.businessName);
    res.json({
      hasGym: true,
      gym: { id: myGym.id, name: displayName, location: myGym.location },
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
    await ensureGymForOwner(req.user.id);
    const myGym = await prisma.gym.findFirst({
      where: { ownerId: req.user.id },
      include: { owner: { select: { gymProfile: { select: { businessName: true } } } } },
    });
    if (!myGym) {
      return res.json({ hasGym: false });
    }
    const range = parseCheckInsRange(req.query.checkInsRange);
    const core = await loadGymDashboardCore(prisma, myGym);
    if (core.gym) {
      core.gym.name = resolveGymDisplayName(myGym.name, myGym.owner?.gymProfile?.businessName);
    }
    const { monthlySeries, checkInsRange } = await buildCheckInSeriesForGym(
      prisma,
      myGym.id,
      range,
    );
    res.json({
      ...core,
      checkInsRange,
      monthlySeries,
    });
  } catch (err) {
    next(err);
  }
});

const GYM_CLEAR_SECTIONS = new Set(['check-ins', 'class-sessions', 'membership-plans']);

router.post('/gym/clear', async (req, res, next) => {
  try {
    if (req.user.role !== 'gym') {
      return res.status(403).json({ error: 'Gym role required' });
    }
    const section = String(req.body?.section || '').trim();
    if (!GYM_CLEAR_SECTIONS.has(section)) {
      return res.status(400).json({ error: 'Invalid section' });
    }

    await ensureGymForOwner(req.user.id);
    const myGym = await prisma.gym.findFirst({ where: { ownerId: req.user.id } });
    if (!myGym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    if (section === 'check-ins') {
      const result = await prisma.gymCheckIn.deleteMany({ where: { gymId: myGym.id } });
      return res.json({ ok: true, section, deleted: result.count });
    }

    if (section === 'class-sessions') {
      const deletedClasses = await prisma.gymClass.deleteMany({ where: { gymId: myGym.id } });
      return res.json({ ok: true, section, deleted: deletedClasses.count });
    }

    const unassigned = await prisma.gymMembership.updateMany({
      where: { gymId: myGym.id, planId: { not: null } },
      data: { planId: null },
    });
    const removedPlans = await prisma.gymSubscriptionPlan.deleteMany({
      where: {
        gymId: myGym.id,
        isActive: false,
        memberships: { none: {} },
      },
    });
    return res.json({
      ok: true,
      section,
      unassigned: unassigned.count,
      deletedPlans: removedPlans.count,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
