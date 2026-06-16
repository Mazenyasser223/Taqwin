#!/usr/bin/env node
/**
 * Block D1 — enqueue mid-week checks for due athletes (Wed 09:00–13:59 local).
 * Host crontab example (Wednesday 09:05 UTC — adjust for VPS TZ):
 *   5 9 * * 3 cd /path/to/backend-node && node scripts/cron-enqueue-mid-week.js
 */
require('dotenv').config({ override: true });

const { runMidWeekBatch } = require('../src/lib/adaptation/midWeekBatch');
const { prisma } = require('../src/db');
const { initCronSentry, failCronScript } = require('./lib/cronSentry');

initCronSentry();

const dryRun = process.argv.includes('--dry-run');
const respectWindow = !process.argv.includes('--force-all-timezones');

async function main() {
  const result = await runMidWeekBatch({
    dryRun,
    respectTimezoneWindow: respectWindow,
  });
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
  if (result.ok === false) process.exit(1);
}

main().catch((err) => failCronScript('mid-week', err));
