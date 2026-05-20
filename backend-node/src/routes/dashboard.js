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
const { estimateTargets } = require('../lib/nutritionTargets');

const router = express.Router();
router.use(authMiddleware);

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

function buildCoachTip({ profile, today, targets, streak, totals }) {
  const goal = profile?.fitnessGoal;
  if (!today.nutrition.logCount && !today.workouts.length) {
    return goal
      ? `Start today strong — log a meal or workout to stay on track for "${goal}".`
      : 'Log your first meal or workout today to unlock personalized insights.';
  }
  if (today.nutrition.protein < targets.proteinTarget * 0.5) {
    return `Protein is at ${Math.round(today.nutrition.protein)}g — aim for ${targets.proteinTarget}g to support your goal.`;
  }
  if (streak >= 3) {
    return `You're on a ${streak}-day workout streak. Keep the momentum going!`;
  }
  if (totals.workouts === 0) {
    return 'No workouts logged this week yet — tap Start Workout when you are ready.';
  }
  const balance = totals.caloriesBurned - totals.caloriesEaten;
  if (balance > 300) {
    return `You are in a ${balance} kcal burn surplus this week — fuel up with quality meals.`;
  }
  return `Great week so far: ${totals.workouts} workouts and ${totals.minutes} active minutes logged.`;
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
    ] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: req.user.id } }),
      prisma.workoutLog.findMany({
        where: { userId: req.user.id, loggedAt: { gte: weekStart } },
        include: { workout: { select: { title: true, calories: true, durationMin: true, category: true } } },
      }),
      prisma.foodLog.findMany({
        where: { userId: req.user.id, loggedAt: { gte: weekStart } },
        include: { foodItem: { select: { name: true, calories: true, protein: true, carbs: true, fat: true } } },
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
        include: { foodItem: { select: { name: true, calories: true, protein: true, carbs: true, fat: true } } },
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
    ]);

    const weekly = buildWeeklyBuckets(weekWorkoutLogs, weekFoodLogs, weekStart);
    const prevWeekly = buildWeeklyBuckets(prevWeekWorkoutLogs, prevWeekFoodLogs, prevWeekStart);

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

    const todayBurned = todayWorkoutLogs.reduce((s, l) => {
      const factor = l.durationMin && l.workout?.durationMin ? l.durationMin / l.workout.durationMin : 1;
      return s + Math.round((l.workout?.calories ?? 0) * factor);
    }, 0);

    const targets = estimateTargets(profile);

    const workoutScore = todayWorkoutLogs.length > 0 ? 40 : 0;
    const foodScore = todayNutrition.logCount > 0 ? 30 : 0;
    const proteinScore =
      targets.proteinTarget > 0
        ? Math.min(30, Math.round((todayNutrition.protein / targets.proteinTarget) * 30))
        : 0;
    const readinessScore = Math.min(100, workoutScore + foodScore + proteinScore);

    const workoutDatesSet = new Set(
      heatmapWorkoutLogs.map((l) => new Date(l.loggedAt).toISOString().slice(0, 10))
    );
    const streak = computeStreak(workoutDatesSet);
    const heatmap = buildHeatmap(heatmapWorkoutLogs, 28);

    const timeline = [
      ...todayFoodLogs.map((l) => ({
        id: l.id,
        type: 'food',
        at: l.loggedAt,
        title: l.foodItem?.name ?? 'Meal',
        subtitle: `${Math.round((l.foodItem?.calories ?? 0) * (l.grams / 100))} kcal`,
        icon: 'restaurant',
      })),
      ...todayWorkoutLogs.map((l) => ({
        id: l.id,
        type: 'workout',
        at: l.loggedAt,
        title: l.workout?.title ?? 'Workout',
        subtitle: `${l.durationMin ?? l.workout?.durationMin ?? 0} min`,
        icon: 'fitness_center',
      })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const coachTip = buildCoachTip({
      profile,
      today: { nutrition: todayNutrition, workouts: todayWorkoutLogs },
      targets,
      streak,
      totals,
    });

    res.json({
      weekly,
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
        workouts: todayWorkoutLogs.map((l) => ({
          id: l.id,
          title: l.workout?.title,
          durationMin: l.durationMin ?? l.workout?.durationMin,
          loggedAt: l.loggedAt,
        })),
        readinessScore,
        readiness: {
          workout: workoutScore > 0,
          nutrition: foodScore > 0,
          proteinProgress: Math.min(100, Math.round((todayNutrition.protein / targets.proteinTarget) * 100)),
        },
      },
      targets,
      streak,
      heatmap,
      timeline,
      coachTip,
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
