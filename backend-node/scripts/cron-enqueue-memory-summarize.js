#!/usr/bin/env node
/**
 * Block E4 — enqueue nightly AI memory summarization for athletes with recent chat.
 * Host crontab example (daily 02:05 UTC — adjust for VPS TZ):
 *   5 2 * * * cd /path/to/backend-node && node scripts/cron-enqueue-memory-summarize.js
 */
require('dotenv').config({ override: true });

const { runMemorySummarizeBatch } = require('../src/lib/ai/memorySummarizeBatch');
const { prisma } = require('../src/db');

const dryRun = process.argv.includes('--dry-run');
const respectWindow = !process.argv.includes('--force-all-timezones');

async function main() {
  const result = await runMemorySummarizeBatch({
    dryRun,
    respectTimezoneWindow: respectWindow,
  });
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
  if (result.ok === false) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
