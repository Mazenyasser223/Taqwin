#!/usr/bin/env node
/**
 * Backfill legacy notifications with category, priority, schemaVersion, readAt, icon.
 *
 *   node scripts/backfill-notifications-v2.js
 *   node scripts/backfill-notifications-v2.js --dry-run
 *   node scripts/backfill-notifications-v2.js --limit=10000
 */
require('dotenv').config({ override: true });
const { backfillNotifications } = require('../src/lib/notifications/notificationBackfill');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 50_000;

  const result = await backfillNotifications({ dryRun, limit });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
