#!/usr/bin/env node
/**
 * Block D10 — emit meal/workout reminders for athletes with active plans.
 * Reminders self-gate by local time and dedupe per slot/day, so run hourly.
 * Host crontab example (every hour):
 *   0 * * * * cd /path/to/backend-node && node scripts/cron-enqueue-smart-notify.js
 */
require('dotenv').config({ override: true });

const { runSmartNotifyBatch } = require('../src/lib/adaptation/smartNotifyBatch');
const { prisma } = require('../src/db');

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const result = await runSmartNotifyBatch({ dryRun });
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
  if (result.ok === false) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
