/**
 * Dashboard aggregations.
 *
 *   GET /api/dashboard/athlete   → weekly stats for the athlete dashboard
 *   GET /api/dashboard/trainer   → counts + upcoming bookings for the trainer dashboard
 *   GET /api/dashboard/gym       → headcount, MRR proxy, check-ins, plan distribution
 */
const express = require('express');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const DAY_MS = 24 * 60 * 60 * 1000;
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
