#!/usr/bin/env node
/**
 * Upsert gamification challenge templates from challengeConfig.
 * Run: npm run db:seed:challenges
 */
require('dotenv').config({ override: true });
const { PrismaClient } = require('../generated/prisma');
const { CHALLENGE_TEMPLATES } = require('../src/lib/gamification/challengeConfig');

const prisma = new PrismaClient();

async function main() {
  let upserted = 0;
  for (const template of CHALLENGE_TEMPLATES) {
    await prisma.challengeTemplate.upsert({
      where: { slug: template.slug },
      create: { ...template, active: true },
      update: {
        durationDays: template.durationDays,
        metric: template.metric,
        target: template.target,
        xpReward: template.xpReward,
        badgeSlug: template.badgeSlug,
        icon: template.icon,
        sortOrder: template.sortOrder,
        active: true,
      },
    });
    upserted += 1;
  }
  console.log(`Challenge templates upserted: ${upserted}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
