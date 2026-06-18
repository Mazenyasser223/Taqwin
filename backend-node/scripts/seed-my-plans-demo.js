#!/usr/bin/env node
/**
 * Seed My Plans page — active workout + diet plans, daily slices, sample logs.
 *
 *   npm run db:seed:plans
 *   npm run db:seed:plans:force
 *   node scripts/seed-my-plans-demo.js --user=demo@taqwin.app
 */
require('dotenv').config({ override: true });

const bcrypt = require('bcryptjs');
const { prisma } = require('../src/db');
const { buildFallbackPlan } = require('../src/lib/plans/fallback');
const { estimateDailyTargets } = require('../src/lib/plans/targets');
const { validatePlanForPersist } = require('../src/lib/plans/planValidation');
const { persistPlanToPostgres } = require('../src/lib/plans/persistPostgres');
const {
  ensureDailyAthletePlansForWeek,
  fetchDailyAthletePlanForDate,
} = require('../src/lib/plans/dailyAthletePlanService');
const { addCalendarDays } = require('../src/lib/plans/planCalendar');

const PASSWORD = 'Taqwin#2025';
const META_KEY = 'my_plans_demo_seeded_v3';

const META_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const WORKOUT_DAY_LABELS = {
  push: 'Push Day',
  pull: 'Pull Day',
  legs: 'Legs Day',
  full: 'Full Body',
  rest: 'Rest Day',
};

const DIET_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseArgs() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const userArg = args.find((a) => a.startsWith('--user='));
  const userEmail =
    userArg?.split('=')[1]?.trim() ||
    process.env.PLANS_SEED_USER_EMAIL ||
    process.env.RESET_ATHLETE_EMAIL ||
    'demo@taqwin.app';
  return { force, userEmail: userEmail.toLowerCase() };
}

async function checkSeedGuard(force) {
  await prisma.$executeRawUnsafe(META_TABLE_SQL);
  if (force) return false;
  const rows = await prisma.$queryRawUnsafe('SELECT value FROM _meta WHERE key = $1 LIMIT 1', META_KEY);
  return Array.isArray(rows) && rows.length > 0;
}

async function markSeeded() {
  await prisma.$executeRawUnsafe(
    `INSERT INTO _meta (key, value) VALUES ($1, NOW()::text)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
    META_KEY,
  );
}

function buildDemoOnboardingData() {
  const now = new Date().toISOString();
  return {
    coreCompletedAt: now,
    workoutPlanCompletedAt: now,
    dietPlanCompletedAt: now,
    wellnessCompletedAt: now,
    trainingDaysPerWeek: '4',
    mealsPerDay: '3',
    snacksPerDay: '1',
    preferredSplit: 'ppl',
    fitnessGoal: 'muscle',
    calorieTarget: 'maintain',
    waterIntake: '2_3_liters',
    injuries: [],
    allergies: [],
    budget: 'medium',
    sleep: '7_8_hours',
  };
}

function enrichDemoPlan(planData) {
  const next = {
    ...planData,
    coachNotes:
      'Your 4-week PPL block balances push, pull, and legs with steady protein across four meals. Adjust weights when reps feel easy — the AI coach can tweak next week.',
    regenerationReason: 'my-plans-demo-seed',
  };

  next.dietDays = (planData.dietDays || []).map((day) => ({
    ...day,
    label: DIET_DAY_LABELS[(day.dayIndex - 1) % 7] || '',
  }));

  next.workoutWeeks = (planData.workoutWeeks || []).map((week) => ({
    ...week,
    days: (week.days || []).map((day) => {
      const type = String(day.type || '').toLowerCase();
      const label = WORKOUT_DAY_LABELS[type] || (day.isRest ? WORKOUT_DAY_LABELS.rest : 'Training');
      return { ...day, label };
    }),
  }));

  return next;
}

async function ensureDemoAthlete(email) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const onboardingData = buildDemoOnboardingData();

  let user = await prisma.user.findUnique({
    where: { email },
    include: { athleteProfile: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        role: 'athlete',
        passwordHash,
        emailVerifiedAt: new Date(),
        athleteProfile: {
          create: {
            displayName: 'Demo Athlete',
            gender: 'male',
            weight: 78,
            height: 178,
            fitnessGoal: 'muscle',
            fitnessLevel: 'intermediate',
            onboardingData,
          },
        },
      },
      include: { athleteProfile: true },
    });
    return user;
  }

  if (!user.athleteProfile) {
    await prisma.athleteProfile.create({
      data: {
        userId: user.id,
        displayName: 'Demo Athlete',
        gender: 'male',
        weight: 78,
        height: 178,
        fitnessGoal: 'muscle',
        fitnessLevel: 'intermediate',
        onboardingData,
      },
    });
  } else {
    await prisma.athleteProfile.update({
      where: { userId: user.id },
      data: {
        displayName: user.athleteProfile.displayName || 'Demo Athlete',
        gender: user.athleteProfile.gender || 'male',
        weight: user.athleteProfile.weight ?? 78,
        height: user.athleteProfile.height ?? 178,
        fitnessGoal: user.athleteProfile.fitnessGoal || 'muscle',
        fitnessLevel: user.athleteProfile.fitnessLevel || 'intermediate',
        onboardingData: {
          ...(typeof user.athleteProfile.onboardingData === 'object' && user.athleteProfile.onboardingData
            ? user.athleteProfile.onboardingData
            : {}),
          ...onboardingData,
        },
      },
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'athlete', passwordHash, emailVerifiedAt: new Date() },
  });

  return prisma.user.findUnique({
    where: { id: user.id },
    include: { athleteProfile: true },
  });
}

async function clearPlanData(userId) {
  await prisma.foodLog.deleteMany({ where: { userId } });
  await prisma.exerciseLog.deleteMany({ where: { userId } });
  await prisma.workoutLog.deleteMany({ where: { userId } });
  await prisma.hydrationLog.deleteMany({ where: { userId } });
  await prisma.dailyAthletePlan.deleteMany({ where: { userId } });
  await prisma.workoutPlan.deleteMany({ where: { userId } });
  await prisma.dietPlan.deleteMany({ where: { userId } });
}

async function seedSampleLogs(userId, targets) {
  const today = new Date();
  const atHour = (dayOffset, hour) => {
    const d = addCalendarDays(today, dayOffset);
    d.setUTCHours(hour, 30, 0, 0);
    return d;
  };

  const foods = await prisma.foodItem.findMany({
    where: {
      name: {
        in: ['Greek Yogurt', 'Grilled Chicken Breast', 'Brown Rice', 'Oats', 'Banana'],
      },
    },
    take: 5,
  });

  if (foods.length >= 2) {
    const breakfast = foods.find((f) => /yogurt|oats/i.test(f.name)) || foods[0];
    const lunch = foods.find((f) => /chicken|rice/i.test(f.name)) || foods[1];

    await prisma.foodLog.createMany({
      data: [
        {
          userId,
          foodItemId: breakfast.id,
          mealSlotId: 'breakfast',
          loggedAt: atHour(0, 8),
          grams: 250,
          snapshotName: breakfast.name,
          snapshotCalories: Math.round((breakfast.calories * 250) / 100),
          snapshotProtein: Math.round((breakfast.protein * 250) / 100),
          snapshotCarbs: Math.round((breakfast.carbs * 250) / 100),
          snapshotFat: Math.round((breakfast.fat * 250) / 100),
        },
        {
          userId,
          foodItemId: lunch.id,
          mealSlotId: 'lunch',
          loggedAt: atHour(0, 13),
          grams: 320,
          snapshotName: lunch.name,
          snapshotCalories: Math.round((lunch.calories * 320) / 100),
          snapshotProtein: Math.round((lunch.protein * 320) / 100),
          snapshotCarbs: Math.round((lunch.carbs * 320) / 100),
          snapshotFat: Math.round((lunch.fat * 320) / 100),
        },
      ],
      skipDuplicates: true,
    });
  }

  const daily = await fetchDailyAthletePlanForDate(userId, today);
  const plannedExercises =
    daily?.workoutPlanDay?.exercises?.filter((row) => row.exerciseId)?.slice(0, 2) || [];

  if (plannedExercises.length) {
    await prisma.exerciseLog.createMany({
      data: plannedExercises.map((row, idx) => ({
        userId,
        exerciseId: row.exerciseId,
        loggedAt: atHour(0, 17 + idx),
        sets: row.sets ?? 3,
        reps: String(row.reps ?? 10),
        weightKg: 20 + idx * 5,
        notes: 'Demo seed — partial session',
      })),
      skipDuplicates: true,
    });
  }

  await prisma.hydrationLog.create({
    data: {
      userId,
      loggedAt: atHour(0, 10),
      ml: Math.round((targets.waterMl || 2500) * 0.35),
    },
  });

  const workout = await prisma.workout.findFirst({ where: { title: 'Full Body Hypertrophy' } });
  if (workout) {
    await prisma.workoutLog.create({
      data: {
        userId,
        workoutId: workout.id,
        loggedAt: atHour(-2, 18),
        durationMin: 48,
        notes: 'Demo seed workout',
      },
    });
  }
}

async function main() {
  const { force, userEmail } = parseArgs();

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  if (await checkSeedGuard(force)) {
    console.log(`My Plans demo already seeded (${META_KEY}). Use --force to re-run.`);
    return;
  }

  console.log(`Seeding My Plans demo for ${userEmail}…`);

  const athlete = await ensureDemoAthlete(userEmail);
  if (!athlete?.athleteProfile) {
    throw new Error(`Could not create athlete profile for ${userEmail}`);
  }

  if (force) {
    await clearPlanData(athlete.id);
    console.log('Cleared previous plans and logs.');
  }

  const onboardingData =
    athlete.athleteProfile.onboardingData && typeof athlete.athleteProfile.onboardingData === 'object'
      ? athlete.athleteProfile.onboardingData
      : buildDemoOnboardingData();

  const profile = { ...athlete.athleteProfile, onboardingData };
  const targets = estimateDailyTargets(profile);
  let planData = buildFallbackPlan({
    profile,
    onboardingData,
    targets,
    weeks: 4,
  });
  planData = enrichDemoPlan(planData);

  const validation = await validatePlanForPersist(planData, { profile, onboardingData });
  if (!validation.ok) {
    throw new Error(`Plan validation failed: ${validation.errors.slice(0, 5).join('; ')}`);
  }

  const saved = await persistPlanToPostgres({
    userId: athlete.id,
    planData,
    legacySource: 'fallback',
    locale: 'en',
    regenerationReason: 'my-plans-demo-seed',
    explainabilityText:
      'Demo plan: 4-day PPL split with rotating meals. Log today’s meals and workouts from My Plans.',
    prismaSource: 'manual',
  });

  const slice = await ensureDailyAthletePlansForWeek(athlete.id, { days: 14 });
  if (!slice.ok) {
    throw new Error('Failed to materialize DailyAthletePlan rows');
  }

  await seedSampleLogs(athlete.id, targets);

  await markSeeded();

  console.log('My Plans demo ready.');
  console.log(`  User:     ${userEmail} / ${PASSWORD}`);
  console.log(`  Workout:  ${saved.postgres.workoutPlanId}`);
  console.log(`  Diet:     ${saved.postgres.dietPlanId}`);
  console.log(`  Daily:    ${slice.created}/${slice.total} rows`);
  console.log('  Open:     /dashboard/plans');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
