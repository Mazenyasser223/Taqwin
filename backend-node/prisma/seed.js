/* Taqwin seed script. Idempotent: re-running upserts a `_meta.seeded` row guard. */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const { seedOnboardingQuestionCatalog } = require('./onboardingCatalogSeed');

const META_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

async function checkSeedGuard(force) {
  await prisma.$executeRawUnsafe(META_TABLE_SQL);
  if (force) return false;
  const rows = await prisma.$queryRawUnsafe('SELECT value FROM _meta WHERE key = $1 LIMIT 1', 'seeded');
  return Array.isArray(rows) && rows.length > 0;
}

async function markSeeded() {
  await prisma.$executeRawUnsafe(
    `INSERT INTO _meta (key, value) VALUES ('seeded', NOW()::text)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
  );
}

const WORKOUTS = [
  { title: 'Heavy Push Day',           category: 'Strength', difficulty: 'Hard',   durationMin: 60, calories: 480, description: 'Bench, OHP, and accessories for chest/shoulders/triceps.' },
  { title: 'Pull Power',               category: 'Strength', difficulty: 'Hard',   durationMin: 55, calories: 460, description: 'Deadlifts, rows, pull-ups for the posterior chain.' },
  { title: 'Leg Day Bootcamp',         category: 'Strength', difficulty: 'Hard',   durationMin: 70, calories: 600, description: 'Squat focused with lunges and Romanian deadlifts.' },
  { title: 'Full Body Hypertrophy',    category: 'Strength', difficulty: 'Medium', durationMin: 50, calories: 420, description: 'Compound lifts in moderate rep ranges.' },
  { title: 'Kettlebell Complex',       category: 'Strength', difficulty: 'Medium', durationMin: 35, calories: 360, description: 'Swings, cleans, presses in a flowing complex.' },
  { title: 'Vinyasa Flow',             category: 'Yoga',     difficulty: 'Easy',   durationMin: 45, calories: 180, description: 'Sun salutations and gentle flow.' },
  { title: 'Yin & Mobility',           category: 'Yoga',     difficulty: 'Easy',   durationMin: 40, calories: 140, description: 'Long-hold postures for connective tissue.' },
  { title: 'Power Yoga',               category: 'Yoga',     difficulty: 'Medium', durationMin: 60, calories: 320, description: 'Strength-focused flow with arm balances.' },
  { title: 'Hatha Foundation',         category: 'Yoga',     difficulty: 'Easy',   durationMin: 50, calories: 200, description: 'Beginner-friendly slow practice.' },
  { title: 'Yoga for Athletes',        category: 'Yoga',     difficulty: 'Medium', durationMin: 45, calories: 220, description: 'Targeted hip and shoulder mobility.' },
  { title: 'HIIT Inferno',             category: 'Cardio',   difficulty: 'Hard',   durationMin: 25, calories: 350, description: '20s-on/10s-off rounds of full-body movements.' },
  { title: 'Steady State Run',         category: 'Cardio',   difficulty: 'Medium', durationMin: 45, calories: 480, description: 'Zone 2 conditioning run.' },
  { title: 'Spin Sprint Intervals',    category: 'Cardio',   difficulty: 'Hard',   durationMin: 30, calories: 400, description: 'High-cadence intervals on the bike.' },
  { title: 'Rower Pyramids',           category: 'Cardio',   difficulty: 'Medium', durationMin: 30, calories: 320, description: 'Distance pyramids on the rower.' },
  { title: 'Jump Rope Skill Work',     category: 'Cardio',   difficulty: 'Medium', durationMin: 20, calories: 240, description: 'Doubles, crossovers, and footwork.' },
  { title: 'Foam Roll & Reset',        category: 'Recovery', difficulty: 'Easy',   durationMin: 25, calories: 90,  description: 'SMR and gentle stretching.' },
  { title: 'Active Recovery Walk',     category: 'Recovery', difficulty: 'Easy',   durationMin: 40, calories: 160, description: 'Brisk walk with breath work.' },
  { title: 'Mobility Flow',            category: 'Recovery', difficulty: 'Easy',   durationMin: 30, calories: 110, description: 'CARS and dynamic mobility drills.' },
  { title: 'Breath & Meditation',      category: 'Recovery', difficulty: 'Easy',   durationMin: 20, calories: 60,  description: 'Box breathing + mindfulness.' },
  { title: 'Stretch & Restore',        category: 'Recovery', difficulty: 'Easy',   durationMin: 30, calories: 100, description: 'Static stretching for full body.' },
];

const FOODS = [
  { name: 'Grilled Chicken Breast', category: 'Protein', calories: 165, protein: 31,  carbs: 0,    fat: 3.6 },
  { name: 'Salmon Fillet',          category: 'Protein', calories: 208, protein: 22,  carbs: 0,    fat: 13 },
  { name: 'Lean Ground Beef',       category: 'Protein', calories: 250, protein: 26,  carbs: 0,    fat: 15 },
  { name: 'Tofu',                   category: 'Protein', calories: 144, protein: 17,  carbs: 3,    fat: 9 },
  { name: 'Greek Yogurt',           category: 'Protein', calories: 100, protein: 17,  carbs: 6,    fat: 0.7 },
  { name: 'Whole Eggs',             category: 'Protein', calories: 155, protein: 13,  carbs: 1.1,  fat: 11 },
  { name: 'Whey Protein Scoop',     category: 'Protein', calories: 120, protein: 24,  carbs: 3,    fat: 1.5 },
  { name: 'Cottage Cheese',         category: 'Protein', calories: 98,  protein: 11,  carbs: 3.4,  fat: 4.3 },
  { name: 'Tuna (canned)',          category: 'Protein', calories: 132, protein: 28,  carbs: 0,    fat: 1 },
  { name: 'Chickpeas',              category: 'Protein', calories: 164, protein: 9,   carbs: 27,   fat: 2.6 },
  { name: 'Brown Rice',             category: 'Carbs',   calories: 215, protein: 5,   carbs: 45,   fat: 1.8 },
  { name: 'Quinoa',                 category: 'Carbs',   calories: 222, protein: 8,   carbs: 39,   fat: 3.6 },
  { name: 'Sweet Potato',           category: 'Carbs',   calories: 103, protein: 2.3, carbs: 24,   fat: 0.2 },
  { name: 'Oats',                   category: 'Carbs',   calories: 150, protein: 5,   carbs: 27,   fat: 2.5 },
  { name: 'Whole Wheat Bread',      category: 'Carbs',   calories: 247, protein: 13,  carbs: 41,   fat: 3.4 },
  { name: 'Pasta',                  category: 'Carbs',   calories: 158, protein: 5.8, carbs: 31,   fat: 0.9 },
  { name: 'Banana',                 category: 'Fruits',  calories: 89,  protein: 1.1, carbs: 23,   fat: 0.3 },
  { name: 'Apple',                  category: 'Fruits',  calories: 52,  protein: 0.3, carbs: 14,   fat: 0.2 },
  { name: 'Blueberries',            category: 'Fruits',  calories: 57,  protein: 0.7, carbs: 14,   fat: 0.3 },
  { name: 'Strawberries',           category: 'Fruits',  calories: 32,  protein: 0.7, carbs: 7.7,  fat: 0.3 },
  { name: 'Avocado',                category: 'Fats',    calories: 160, protein: 2,   carbs: 9,    fat: 15 },
  { name: 'Almonds',                category: 'Fats',    calories: 579, protein: 21,  carbs: 22,   fat: 50 },
  { name: 'Olive Oil (1 tbsp)',     category: 'Fats',    calories: 119, protein: 0,   carbs: 0,    fat: 13.5 },
  { name: 'Peanut Butter',          category: 'Fats',    calories: 588, protein: 25,  carbs: 20,   fat: 50 },
  { name: 'Spinach',                category: 'Veggies', calories: 23,  protein: 2.9, carbs: 3.6,  fat: 0.4 },
  { name: 'Broccoli',               category: 'Veggies', calories: 34,  protein: 2.8, carbs: 7,    fat: 0.4 },
  { name: 'Bell Pepper',            category: 'Veggies', calories: 31,  protein: 1,   carbs: 6,    fat: 0.3 },
  { name: 'Kale',                   category: 'Veggies', calories: 49,  protein: 4.3, carbs: 9,    fat: 0.9 },
  { name: 'Carrots',                category: 'Veggies', calories: 41,  protein: 0.9, carbs: 10,   fat: 0.2 },
  { name: 'Black Coffee',           category: 'Drinks',  calories: 2,   protein: 0.3, carbs: 0,    fat: 0 },
];

const { seedShopCatalog } = require('./shopCatalogSeed');
const { seedGymReviews } = require('../scripts/seed-gym-reviews');

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

const EQUIPMENT_CATALOG = [
  {
    name: 'Treadmill',
    nameAr: 'جهاز المشي',
    imageUrl: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=400&h=300&fit=crop',
    maintenanceIntervalDays: 60,
    lastMaintenanceAt: daysAgo(45),
    nextMaintenanceAt: daysFromNow(15),
    lastCleanedAt: daysAgo(2),
  },
  {
    name: 'Bench Press',
    nameAr: 'جهاز البنش',
    imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=300&fit=crop',
    maintenanceIntervalDays: 90,
    lastMaintenanceAt: daysAgo(80),
    nextMaintenanceAt: daysFromNow(10),
    lastCleanedAt: daysAgo(5),
    needsMaintenance: true,
  },
  {
    name: 'Leg Press',
    nameAr: 'جهاز الرجل',
    imageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&h=300&fit=crop',
    maintenanceIntervalDays: 90,
    lastMaintenanceAt: daysAgo(30),
    nextMaintenanceAt: daysFromNow(60),
    lastCleanedAt: daysAgo(7),
    needsCleaning: true,
  },
  {
    name: 'Cable Machine',
    nameAr: 'جهاز الكابلات',
    imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=300&fit=crop',
    maintenanceIntervalDays: 120,
    lastMaintenanceAt: daysAgo(20),
    nextMaintenanceAt: daysFromNow(100),
    lastCleanedAt: daysAgo(1),
  },
  {
    name: 'Rowing Machine',
    nameAr: 'جهاز التجديف',
    imageUrl: 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=400&h=300&fit=crop',
    maintenanceIntervalDays: 60,
    lastMaintenanceAt: daysAgo(55),
    nextMaintenanceAt: daysFromNow(5),
    lastCleanedAt: daysAgo(3),
  },
  {
    name: 'Smith Machine',
    nameAr: 'جهاز Smith',
    imageUrl: 'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=400&h=300&fit=crop',
    maintenanceIntervalDays: 90,
    lastMaintenanceAt: daysAgo(10),
    nextMaintenanceAt: daysFromNow(80),
    lastCleanedAt: daysAgo(4),
  },
];

async function seedGymEquipment(gymIds) {
  let created = 0;
  for (const gymId of gymIds) {
    for (const eq of EQUIPMENT_CATALOG) {
      const existing = await prisma.gymEquipment.findFirst({
        where: { gymId, name: eq.name },
      });
      if (!existing) {
        await prisma.gymEquipment.create({
          data: {
            gymId,
            name: eq.name,
            nameAr: eq.nameAr,
            imageUrl: eq.imageUrl,
            maintenanceIntervalDays: eq.maintenanceIntervalDays,
            lastMaintenanceAt: eq.lastMaintenanceAt,
            nextMaintenanceAt: eq.nextMaintenanceAt,
            lastCleanedAt: eq.lastCleanedAt,
            needsMaintenance: eq.needsMaintenance ?? false,
            needsCleaning: eq.needsCleaning ?? false,
          },
        });
        created += 1;
      }
    }
  }
  console.log(`[seed] gym equipment done (${created} new rows)`);
}

async function seedGymReviewsSafe() {
  try {
    await seedGymReviews();
  } catch (err) {
    if (err?.code === 'P2021' || /gym_reviews/.test(String(err?.message))) {
      console.warn('[seed] gym reviews skipped (run migration first)');
      return;
    }
    throw err;
  }
}

async function seed({ force = false } = {}) {
  await seedOnboardingQuestionCatalog(prisma);

  const already = await checkSeedGuard(force);
  if (already) {
    const gyms = await prisma.gym.findMany({ select: { id: true } });
    await seedGymEquipment(gyms.map((g) => g.id));
    await seedGymReviewsSafe();
    console.log('[seed] already seeded; questionnaire catalog refreshed. Pass --force to re-run full seed.');
    return;
  }
  console.log('[seed] starting...');

  // Workouts
  for (const w of WORKOUTS) {
    const existing = await prisma.workout.findFirst({ where: { title: w.title } });
    if (!existing) await prisma.workout.create({ data: w });
  }
  console.log('[seed] workouts done');

  // Foods
  for (const f of FOODS) {
    const existing = await prisma.foodItem.findFirst({ where: { name: f.name } });
    if (!existing) await prisma.foodItem.create({ data: f });
  }
  console.log('[seed] foods done');

  // Shop catalog (categories + EGP products)
  const shopStats = await seedShopCatalog(prisma);
  console.log(`[seed] shop catalog done (${shopStats.categories} categories, ${shopStats.products} products)`);

  await seedGymReviewsSafe();

  await markSeeded();
  console.log('[seed] done.');
}

const force = process.argv.includes('--force');
seed({ force })
  .catch((err) => {
    console.error('[seed] error', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
