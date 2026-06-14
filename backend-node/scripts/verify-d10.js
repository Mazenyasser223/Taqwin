#!/usr/bin/env node
/**
 * Block D10 — smart notifications checklist.
 *   npm run verify:d10            # offline (modules + pure logic)
 *   npm run verify:d10 -- --db    # also runs a dry-run batch against the DB
 */
/* eslint-disable no-console */
require('dotenv').config({ override: true });

const DB = process.argv.includes('--db');

const {
  parseWindowStartMinutes,
  mealStartMinutes,
  workoutReminderHour,
} = require('../src/lib/adaptation/smartNotify');
const { runSmartNotifyBatch } = require('../src/lib/adaptation/smartNotifyBatch');
const {
  isSmartNotifySchedulerEnabled,
} = require('../src/jobs/schedulers/smartNotifyScheduler');

function ok(m) {
  console.log(`\u2713 ${m}`);
  return true;
}
function fail(m) {
  console.error(`\u2717 ${m}`);
  return false;
}

async function main() {
  let passed = true;
  console.log('\u2500\u2500 Smart notifications (D10) \u2500\u2500\n');

  if (parseWindowStartMinutes('07:00-09:00') === 420) ok('parse meal window start');
  else passed = fail('parse meal window start') && passed;

  if (mealStartMinutes({ mealType: 'dinner' }) === 19 * 60) ok('default meal start (dinner)');
  else passed = fail('default meal start (dinner)') && passed;

  if (workoutReminderHour() >= 0 && workoutReminderHour() <= 23) ok('workout reminder hour configured');
  else passed = fail('workout reminder hour configured') && passed;

  // Route + cron wiring loads without throwing.
  try {
    require('../src/routes/ai/notify');
    ok('route module: /api/ai/notify');
  } catch (err) {
    passed = fail(`route module load: ${err.message}`) && passed;
  }
  try {
    require('../src/routes/internal/cron');
    ok('cron route module: /api/internal/cron');
  } catch (err) {
    passed = fail(`cron route load: ${err.message}`) && passed;
  }

  console.log(
    isSmartNotifySchedulerEnabled()
      ? '\u2713 FEATURE_SMART_NOTIFY_CRON enabled'
      : '  \u26a0 FEATURE_SMART_NOTIFY_CRON off (reminders run via cron/internal route only)'
  );

  if (DB) {
    const { prisma } = require('../src/db');
    try {
      const result = await runSmartNotifyBatch({ dryRun: true });
      if (result.ok) ok(`dry-run batch scanned ${result.scanned} athletes`);
      else passed = fail('dry-run batch returned not-ok') && passed;
    } catch (err) {
      passed = fail(`dry-run batch failed: ${err.message}`) && passed;
    } finally {
      await prisma.$disconnect().catch(() => null);
    }
  }

  console.log(passed ? '\n\u2713 D10 checklist passed' : '\n\u2717 D10 checklist failed');
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
