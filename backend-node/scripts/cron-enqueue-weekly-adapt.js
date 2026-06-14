#!/usr/bin/env node
/**
 * Block C10 — enqueue weekly adaptation for all due athletes.
 * Host crontab example (Sunday 00:05 UTC — adjust for VPS TZ):
 *   5 0 * * 0 cd /path/to/backend-node && node scripts/cron-enqueue-weekly-adapt.js
 *
 * Options:
 *   --dry-run
 *   --force-all-timezones   (skip Sunday local window)
 */
require('dotenv').config({ override: true });

const { runWeeklyAdaptBatch } = require('../src/lib/adaptation/weeklyAdaptBatch');
const { prisma } = require('../src/db');

const dryRun = process.argv.includes('--dry-run');
const respectWindow = !process.argv.includes('--force-all-timezones');

async function main() {
  const result = await runWeeklyAdaptBatch({
    dryRun,
    respectTimezoneWindow: respectWindow,
    precomputeMetrics: true,
  });
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
  if (result.ok === false) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
