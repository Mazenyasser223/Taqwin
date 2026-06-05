/* eslint-disable no-console */
/**
 * One-off: copy active Mongo `plans` documents into Postgres (official store).
 *
 *   node scripts/migrate-plans-mongo-to-pg.js
 *   node scripts/migrate-plans-mongo-to-pg.js --userId=<uuid>
 *
 * Requires MONGO_URI + DATABASE_URL. Skips users who already have active Postgres plans.
 */
require('dotenv').config();

const { connectMongo, isMongoConfigured } = require('../src/db/mongo/client');
const { persistPlanToPostgres } = require('../src/lib/plans/persistPostgres');
const { prisma } = require('../src/db');

async function main() {
  if (!isMongoConfigured()) {
    console.error('MONGO_URI required');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }

  const filterUserId = process.argv.find((a) => a.startsWith('--userId='))?.split('=')[1];

  await connectMongo();
  const Plan = require('../src/db/mongo/models/plan');

  const query = { isActive: true };
  if (filterUserId) query.userId = filterUserId;

  const mongoPlans = await Plan.find(query).sort({ createdAt: -1 }).lean();
  console.log(`Found ${mongoPlans.length} active Mongo plan(s) to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const doc of mongoPlans) {
    const existing = await prisma.workoutPlan.findFirst({
      where: { userId: doc.userId, status: 'active' },
    });
    if (existing) {
      console.log(`skip ${doc.userId} — already has active Postgres plan`);
      skipped += 1;
      continue;
    }

    const user = await prisma.user.findUnique({ where: { id: doc.userId } });
    if (!user) {
      console.log(`skip ${doc.userId} — user not in Postgres`);
      skipped += 1;
      continue;
    }

    const planData = {
      dailyTargets: doc.dailyTargets,
      dietDays: doc.dietDays || [],
      workoutWeeks: doc.workoutWeeks || [],
      coachNotes: doc.coachNotes || '',
      regenerationReason: doc.regenerationReason || 'migrated_from_mongo',
    };

    await persistPlanToPostgres({
      userId: doc.userId,
      planData,
      legacySource: doc.source === 'fallback' ? 'fallback' : 'ai',
      locale: doc.locale || 'ar',
      regenerationReason: 'migrated_from_mongo',
      explainabilityText: doc.coachNotes || '',
    });

    console.log(`migrated ${doc.userId} v${doc.version}`);
    migrated += 1;
  }

  console.log(`Done: migrated=${migrated} skipped=${skipped}`);
  await prisma.$disconnect().catch(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
