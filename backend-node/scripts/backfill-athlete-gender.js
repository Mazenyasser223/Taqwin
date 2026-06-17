/**
 * Copy gender from athlete_profiles.onboarding_data->gender when gender column is null.
 * Usage: node scripts/backfill-athlete-gender.js
 */
require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.athleteProfile.findMany({
    where: { gender: null },
    select: { id: true, userId: true, onboardingData: true },
  });
  let updated = 0;
  for (const row of rows) {
    const od = row.onboardingData;
    if (!od || typeof od !== 'object' || Array.isArray(od) || !od.gender) continue;
    await prisma.athleteProfile.update({
      where: { id: row.id },
      data: { gender: String(od.gender) },
    });
    updated += 1;
  }
  console.log(`Backfilled gender on ${updated} athlete profile(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
