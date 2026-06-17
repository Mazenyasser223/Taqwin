/**
 * Seed sample gym reviews for sentiment overview testing.
 * Idempotent: skips rows that already exist (gym + user pair).
 * Seeds named gyms plus any active gym that still has zero reviews.
 *
 * Usage: node scripts/seed-gym-reviews.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('../generated/prisma');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();
const PASSWORD = 'Taqwin#2025';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

const REVIEW_ATHLETES = [
  { email: 'demo@taqwin.app', displayName: 'Demo Athlete' },
  { email: 'review.sara@taqwin.app', displayName: 'Sara M.' },
  { email: 'review.omar@taqwin.app', displayName: 'Omar K.' },
  { email: 'review.nadia@taqwin.app', displayName: 'Nadia H.' },
  { email: 'review.youssef@taqwin.app', displayName: 'Youssef A.' },
  { email: 'review.lina@taqwin.app', displayName: 'Lina R.' },
  { email: 'review.karim@taqwin.app', displayName: 'Karim F.' },
  { email: 'review.maya@taqwin.app', displayName: 'Maya S.' },
];

const REVIEWS_BY_GYM = {
  'Iron House Gym': [
    { athleteIndex: 0, rating: 5, body: 'Equipment is top-notch and the staff are very friendly. Clean facility and great value for money.', daysAgo: 14, helpfulCount: 12 },
    { athleteIndex: 1, rating: 5, body: 'Professional trainers and a motivating atmosphere. I saw real results in just 6 weeks.', daysAgo: 11, helpfulCount: 8 },
    { athleteIndex: 2, rating: 4, body: 'Good gym with modern machines. Gets crowded in the evening but still worth it.', daysAgo: 9, helpfulCount: 5 },
    { athleteIndex: 3, rating: 5, body: 'صالة نظيفة ومعدات ممتازة. الموظفين محترفين وودودين جداً.', daysAgo: 7, helpfulCount: 6 },
    { athleteIndex: 4, rating: 4, body: 'Friendly staff and well-maintained equipment. Great value for the monthly price.', daysAgo: 5, helpfulCount: 3 },
    { athleteIndex: 5, rating: 3, body: 'Decent gym but parking is limited. Equipment is fine overall.', daysAgo: 4, helpfulCount: 1 },
    { athleteIndex: 6, rating: 2, body: 'Some machines need maintenance. The atmosphere could be more motivating.', daysAgo: 2, helpfulCount: 0 },
    { athleteIndex: 7, rating: 5, body: 'Clean, professional, and motivating. Best gym experience I have had in Cairo.', daysAgo: 1, helpfulCount: 4 },
  ],
  'Pulse Fitness Studio': [
    { athleteIndex: 0, rating: 5, body: 'Amazing spin classes and friendly coaches. Very clean studio.', daysAgo: 10, helpfulCount: 7 },
    { athleteIndex: 1, rating: 4, body: 'Great equipment and professional staff. Good value for crossfit sessions.', daysAgo: 6, helpfulCount: 2 },
    { athleteIndex: 2, rating: 3, body: 'Nice yoga room but limited weight equipment.', daysAgo: 3, helpfulCount: 0 },
  ],
  'Flow Yoga & Pilates': [
    { athleteIndex: 3, rating: 5, body: 'Calm, clean, and motivating instructors. Perfect for recovery days.', daysAgo: 8, helpfulCount: 5 },
    { athleteIndex: 4, rating: 5, body: 'Professional pilates sessions with excellent results for my mobility.', daysAgo: 4, helpfulCount: 3 },
    { athleteIndex: 5, rating: 4, body: 'Friendly staff and a very clean heated yoga room.', daysAgo: 2, helpfulCount: 1 },
  ],
};

function defaultReviewsForGym(gymName) {
  return [
    { athleteIndex: 0, rating: 5, body: `Excellent gym! ${gymName} has modern equipment and very friendly staff.`, daysAgo: 12, helpfulCount: 5 },
    { athleteIndex: 1, rating: 5, body: `Professional trainers at ${gymName}. Clean facility and motivating atmosphere.`, daysAgo: 9, helpfulCount: 4 },
    { athleteIndex: 2, rating: 4, body: `Good value for money. ${gymName} is well maintained with great equipment.`, daysAgo: 7, helpfulCount: 2 },
    { athleteIndex: 3, rating: 5, body: `صالة ${gymName} نظيفة جداً والمعدات ممتازة. الموظفين ودودين ومحترفين.`, daysAgo: 5, helpfulCount: 3 },
    { athleteIndex: 4, rating: 4, body: `Friendly staff and clean environment at ${gymName}. I am seeing good results.`, daysAgo: 3, helpfulCount: 1 },
    { athleteIndex: 5, rating: 3, body: `Decent experience overall. ${gymName} could use more parking space.`, daysAgo: 2, helpfulCount: 0 },
  ];
}

async function ensureAthlete({ email, displayName }) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { role: 'athlete', passwordHash, emailVerifiedAt: new Date() },
    create: {
      email,
      role: 'athlete',
      passwordHash,
      emailVerifiedAt: new Date(),
      athleteProfile: { create: { displayName } },
    },
  });
}

async function reviewExists(gymId, userId) {
  const existing = await prisma.gymReview.findUnique({
    where: { gymId_userId: { gymId, userId } },
    select: { id: true },
  });
  return Boolean(existing);
}

async function insertReview({ gymId, userId, rating, body, helpfulCount, createdAt }) {
  await prisma.gymReview.create({
    data: {
      gymId,
      userId,
      rating,
      body,
      helpfulCount: helpfulCount ?? 0,
      createdAt,
      updatedAt: createdAt,
    },
  });
}

async function seedReviewsForGym(gym, athletes, reviews, stats) {
  for (const review of reviews) {
    const user = athletes[review.athleteIndex];
    if (!user) continue;

    if (await reviewExists(gym.id, user.id)) {
      stats.skipped += 1;
      continue;
    }

    const createdAt = daysAgo(review.daysAgo);
    await insertReview({
      gymId: gym.id,
      userId: user.id,
      rating: review.rating,
      body: review.body,
      helpfulCount: review.helpfulCount ?? 0,
      createdAt,
    });
    stats.created += 1;
  }
}

async function seedGymReviews() {
  const athletes = [];
  for (const athlete of REVIEW_ATHLETES) {
    athletes.push(await ensureAthlete(athlete));
  }

  const stats = { created: 0, skipped: 0 };
  const gyms = await prisma.gym.findMany({
    where: { isActive: true },
    select: { id: true, name: true, _count: { select: { reviews: true } } },
    orderBy: { name: 'asc' },
  });

  for (const gym of gyms) {
    const namedReviews = REVIEWS_BY_GYM[gym.name];
    const reviews =
      namedReviews ??
      (gym._count.reviews === 0 ? defaultReviewsForGym(gym.name) : null);

    if (!reviews?.length) continue;

    await seedReviewsForGym(gym, athletes, reviews, stats);
    console.log(`[seed-gym-reviews] ${gym.name}: ${reviews.length} template(s)`);
  }

  console.log(`[seed-gym-reviews] done (${stats.created} created, ${stats.skipped} skipped)`);
}

if (require.main === module) {
  seedGymReviews()
    .catch((err) => {
      console.error('[seed-gym-reviews] error', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { seedGymReviews, REVIEWS_BY_GYM, defaultReviewsForGym };
