/**
 * Backfill AI sentiment summaries for all gyms with reviews.
 * Usage: node scripts/backfill-gym-review-analysis.js
 */
require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');
const { refreshGymReviewAnalysis } = require('../src/lib/gymReviewAnalysis');

const prisma = new PrismaClient();

async function main() {
  const gyms = await prisma.gym.findMany({
    where: { isActive: true, reviews: { some: {} } },
    select: { id: true, name: true, _count: { select: { reviews: true } } },
    orderBy: { name: 'asc' },
  });

  if (gyms.length === 0) {
    console.log('[backfill-gym-review-analysis] no gyms with reviews');
    return;
  }

  for (const gym of gyms) {
    const summary = await refreshGymReviewAnalysis(gym.id, { force: true });
    console.log(
      `[backfill] ${gym.name}: ${summary?.reviewCount ?? 0} reviews, `
        + `source=${summary?.source}, `
        + `${summary?.positive}/${summary?.neutral}/${summary?.negative}%`,
    );
  }

  console.log(`[backfill-gym-review-analysis] done (${gyms.length} gym(s))`);
}

main()
  .catch((err) => {
    console.error('[backfill-gym-review-analysis] error', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
