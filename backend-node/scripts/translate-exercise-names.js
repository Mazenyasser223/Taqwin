#!/usr/bin/env node
/**
 * Batch-translate exercise names EN → AR and persist to name_ar.
 *
 * Usage:
 *   node scripts/translate-exercise-names.js
 *   node scripts/translate-exercise-names.js --limit=100
 *   node scripts/translate-exercise-names.js --dry-run
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { translateExerciseNameEnToAr, needsNameAr } = require('../src/lib/exerciseNameAr');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const opts = { limit: 0, dryRun: false, delayMs: Number(process.env.EXERCISE_TRANSLATE_DELAY_MS) || 250 };
  for (const arg of argv) {
    if (arg.startsWith('--limit=')) opts.limit = Number(arg.split('=')[1]) || 0;
    else if (arg.startsWith('--delay-ms=')) opts.delayMs = Number(arg.split('=')[1]) || 250;
    else if (arg === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rows = await prisma.exercise.findMany({
    where: { isPublic: true },
    orderBy: { name: 'asc' },
    ...(opts.limit > 0 ? { take: opts.limit } : {}),
  });

  const missing = rows.filter(needsNameAr);
  console.log(`[translate-exercises] ${missing.length} / ${rows.length} need Arabic names`);

  let done = 0;
  for (const row of missing) {
    const nameAr = await translateExerciseNameEnToAr(row.name, { delayMs: opts.delayMs });
    if (!nameAr) continue;
    console.log(`  ${row.name} → ${nameAr}`);
    if (!opts.dryRun) {
      await prisma.exercise.update({ where: { id: row.id }, data: { nameAr } });
    }
    done += 1;
  }

  console.log(`[translate-exercises] updated ${done} exercises`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
