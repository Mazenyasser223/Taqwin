#!/usr/bin/env node
/**
 * Block C11 — enqueue daily DailyAthletePlan refresh for all athletes.
 * Crontab example (every day 00:10 UTC — tune for VPS TZ):
 *   10 0 * * * cd /path/to/backend-node && node scripts/cron-enqueue-daily-refresh.js
 *
 *   --dry-run
 *   --force-all-timezones
 *   --days=7
 */
require('dotenv').config({ override: true });

const { runDailyRefreshBatch } = require('../src/lib/plans/dailyRefreshBatch');
const { prisma } = require('../src/db');
const { initCronSentry, failCronScript } = require('./lib/cronSentry');

initCronSentry();

const dryRun = process.argv.includes('--dry-run');
const respectWindow = !process.argv.includes('--force-all-timezones');
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const days = daysArg ? Number(daysArg.split('=')[1]) : undefined;

async function main() {
  const result = await runDailyRefreshBatch({
    dryRun,
    respectTimezoneWindow: respectWindow,
    days,
  });
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
  if (result.ok === false) process.exit(1);
}

main().catch((err) => failCronScript('daily-refresh', err));
