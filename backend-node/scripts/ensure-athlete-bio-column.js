#!/usr/bin/env node
/* eslint-disable no-console */
/** Idempotent — safe when migration is blocked or not yet applied. */
require('dotenv').config({ override: true });
const { prisma } = require('../src/db');

async function main() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "athlete_profiles" ADD COLUMN IF NOT EXISTS "bio" TEXT',
  );
  console.log('[ensure-athlete-bio] athlete_profiles.bio column OK');
}

main()
  .catch((e) => {
    console.error('[ensure-athlete-bio] FAIL', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
