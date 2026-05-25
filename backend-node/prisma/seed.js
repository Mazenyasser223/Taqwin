/* Taqwin seed script. Idempotent: re-running upserts a `_meta.seeded` row guard. */
const { PrismaClient, Role, OrderStatus, BookingStatus } = require('@prisma/client');
const bcrypt = require('bcryptjs');

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

const PRODUCTS = [
  { name: 'Whey Protein Isolate',    brand: 'Taqwin Labs',   price: 49.99, stock: 120, description: 'Cold-filtered, 25g protein per scoop.' },
  { name: 'Creatine Monohydrate',    brand: 'Taqwin Labs',   price: 24.99, stock: 200, description: 'Micronized 5g daily dose.' },
  { name: 'Pre-Workout: Edge',       brand: 'Taqwin Labs',   price: 34.99, stock: 90,  description: 'Caffeine + beta-alanine + L-citrulline.' },
  { name: 'Resistance Bands Set',    brand: 'IronMile',      price: 29.99, stock: 80,  description: 'Five-band loop set with door anchor.' },
  { name: 'Adjustable Dumbbell 24kg',brand: 'IronMile',      price: 199.0, stock: 30,  description: 'Tool-free 5-24kg adjustment.' },
  { name: 'Lifting Belt',            brand: 'IronMile',      price: 59.99, stock: 60,  description: '10mm leather, prong buckle.' },
  { name: 'Yoga Mat Pro',            brand: 'FlowState',     price: 79.99, stock: 75,  description: '6mm grippy TPE mat.' },
  { name: 'Foam Roller HD',          brand: 'FlowState',     price: 39.99, stock: 100, description: 'High-density 18in roller.' },
  { name: 'Smart Water Bottle 1L',   brand: 'Hydra',         price: 24.99, stock: 150, description: 'Tracks intake, BPA-free.' },
  { name: 'Performance Tee',         brand: 'Taqwin Apparel',price: 32.0,  stock: 200, description: 'Moisture-wicking athletic fit.' },
];

const TRAINERS = [
  { email: 'leila.coach@taqwin.app',  displayName: 'Leila Hassan',     bio: 'Strength + powerlifting specialist',          specialties: 'Strength, Powerlifting',     yearsExperience: 8 },
  { email: 'omar.coach@taqwin.app',   displayName: 'Omar El-Sayed',    bio: 'CrossFit L2 with focus on conditioning',      specialties: 'CrossFit, HIIT',              yearsExperience: 6 },
  { email: 'mariam.yoga@taqwin.app',  displayName: 'Mariam Rashad',    bio: 'RYT-500 yoga & mobility coach',               specialties: 'Yoga, Mobility',              yearsExperience: 10 },
  { email: 'youssef.run@taqwin.app',  displayName: 'Youssef Adel',     bio: 'Endurance coach for runners and cyclists',    specialties: 'Running, Cycling, Endurance', yearsExperience: 5 },
  { email: 'salma.nutri@taqwin.app',  displayName: 'Salma Mahmoud',    bio: 'Nutritionist for body recomposition',         specialties: 'Nutrition, Recomp',           yearsExperience: 7 },
];

const GYMS = [
  { ownerEmail: 'iron.house@taqwin.app',  ownerName: 'Iron House',     name: 'Iron House Gym',         location: 'Cairo, Maadi',       phone: '+20 100 111 2222', maxCapacity: 250, amenities: 'Free weights, Sauna, Showers' },
  { ownerEmail: 'pulse.fit@taqwin.app',   ownerName: 'Pulse Fitness',  name: 'Pulse Fitness Studio',   location: 'Alexandria, Smouha', phone: '+20 100 333 4444', maxCapacity: 180, amenities: 'Yoga, Spin, Crossfit Box' },
  { ownerEmail: 'flow.studio@taqwin.app', ownerName: 'Flow Studio',    name: 'Flow Yoga & Pilates',    location: 'Giza, Sheikh Zayed', phone: '+20 100 555 6666', maxCapacity: 80,  amenities: 'Heated Yoga, Pilates' },
];

const ATHLETES = [
  { email: 'demo@taqwin.app',     displayName: 'Demo Athlete',    fitnessGoal: 'Recomposition',  fitnessLevel: 'Intermediate', height: 178, weight: 78 },
  { email: 'aya.lifts@taqwin.app',displayName: 'Aya Mostafa',     fitnessGoal: 'Build Strength', fitnessLevel: 'Beginner',     height: 165, weight: 60 },
  { email: 'karim.fit@taqwin.app',displayName: 'Karim Tarek',     fitnessGoal: 'Endurance',      fitnessLevel: 'Advanced',     height: 182, weight: 74 },
];

async function upsertUser({ email, role, displayName, profile = {}, password = 'Taqwin#2025' }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { role },
    create: {
      email,
      role,
      passwordHash,
      emailVerifiedAt: new Date(),
      profile: { create: { displayName, ...profile } },
    },
    include: { profile: true },
  });
  if (!user.profile) {
    await prisma.profile.create({ data: { userId: user.id, displayName, ...profile } });
  } else {
    await prisma.profile.update({ where: { userId: user.id }, data: { displayName, ...profile } });
  }
  return user;
}

async function seed({ force = false } = {}) {
  await seedOnboardingQuestionCatalog(prisma);

  const already = await checkSeedGuard(force);
  if (already) {
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

  // Products
  for (const p of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (!existing) await prisma.product.create({ data: p });
  }
  console.log('[seed] products done');

  // Trainers
  const trainerUsers = [];
  for (const t of TRAINERS) {
    const u = await upsertUser({
      email: t.email,
      role: Role.trainer,
      displayName: t.displayName,
      profile: {
        bio: t.bio,
        specialties: t.specialties,
        yearsExperience: t.yearsExperience,
        fitnessLevel: 'Advanced',
      },
    });
    trainerUsers.push(u);
  }
  console.log('[seed] trainers done');

  // Gyms (each owner is its own user)
  const gymRecords = [];
  for (const g of GYMS) {
    const owner = await upsertUser({
      email: g.ownerEmail,
      role: Role.gym,
      displayName: g.ownerName,
      profile: { businessName: g.name, businessAddress: g.location, businessPhone: g.phone },
    });
    let gym = await prisma.gym.findFirst({ where: { ownerId: owner.id } });
    if (!gym) {
      gym = await prisma.gym.create({
        data: {
          ownerId: owner.id,
          name: g.name,
          location: g.location,
          phone: g.phone,
          maxCapacity: g.maxCapacity,
          amenities: g.amenities,
        },
      });
    }
    gymRecords.push(gym);
  }
  console.log('[seed] gyms done');

  // Athletes
  const athleteUsers = [];
  for (const a of ATHLETES) {
    const u = await upsertUser({
      email: a.email,
      role: Role.athlete,
      displayName: a.displayName,
      profile: {
        fitnessGoal: a.fitnessGoal,
        fitnessLevel: a.fitnessLevel,
        height: a.height,
        weight: a.weight,
      },
    });
    athleteUsers.push(u);
  }
  console.log('[seed] athletes done');

  // Memberships: every athlete in the first gym, demo also in the second
  const demo = athleteUsers[0];
  const allGymsToJoin = [
    ...athleteUsers.map((a) => ({ user: a, gym: gymRecords[0] })),
    { user: demo, gym: gymRecords[1] },
  ];
  for (const { user, gym } of allGymsToJoin) {
    await prisma.gymMembership.upsert({
      where: { gymId_userId: { gymId: gym.id, userId: user.id } },
      update: { isActive: true },
      create: { gymId: gym.id, userId: user.id, isActive: true },
    });
  }

  // Sample workout logs (last 10 days for demo athlete)
  const allWorkouts = await prisma.workout.findMany({ take: 20 });
  for (let i = 0; i < 10; i++) {
    const w = allWorkouts[i % allWorkouts.length];
    const loggedAt = new Date();
    loggedAt.setDate(loggedAt.getDate() - i);
    const exists = await prisma.workoutLog.findFirst({
      where: { userId: demo.id, workoutId: w.id, loggedAt: { gte: new Date(loggedAt.toDateString()) } },
    });
    if (!exists) {
      await prisma.workoutLog.create({
        data: { userId: demo.id, workoutId: w.id, loggedAt, durationMin: w.durationMin },
      });
    }
  }

  // Sample food logs (last 5 days for demo)
  const allFoods = await prisma.foodItem.findMany({ take: 30 });
  for (let i = 0; i < 5; i++) {
    const loggedAt = new Date();
    loggedAt.setDate(loggedAt.getDate() - i);
    for (let j = 0; j < 3; j++) {
      const food = allFoods[(i * 3 + j) % allFoods.length];
      await prisma.foodLog.create({
        data: { userId: demo.id, foodItemId: food.id, grams: 150, loggedAt },
      });
    }
  }

  // One sample booking
  await prisma.trainerBooking.create({
    data: {
      athleteId: demo.id,
      trainerId: trainerUsers[0].id,
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: BookingStatus.confirmed,
      notes: 'Initial assessment session.',
    },
  });

  // One sample order
  const allProducts = await prisma.product.findMany({ take: 3 });
  if (allProducts.length > 0) {
    const total = allProducts.reduce((acc, p) => acc + p.price, 0);
    await prisma.order.create({
      data: {
        userId: demo.id,
        status: OrderStatus.delivered,
        total,
        items: {
          create: allProducts.map((p) => ({ productId: p.id, quantity: 1, unitPrice: p.price })),
        },
      },
    });
  }

  // Couple of community posts
  await prisma.communityPost.create({
    data: {
      authorId: trainerUsers[0].id,
      content: 'New cycle starting Monday — 4 day upper/lower split. Who is in?',
    },
  });
  await prisma.communityPost.create({
    data: {
      authorId: demo.id,
      content: 'Hit a PR on deadlifts today! Thanks to everyone in the community for the form tips.',
    },
  });

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
