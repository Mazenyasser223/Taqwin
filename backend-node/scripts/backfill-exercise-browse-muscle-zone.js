#!/usr/bin/env node
/**
 * Backfill exercises.browse_muscle_zone from primary_muscles (one zone per exercise).
 *
 * Usage: node scripts/backfill-exercise-browse-muscle-zone.js
 */
require('dotenv').config();
const { prisma } = require('../src/db');
const {
  assignBrowseMuscleZone,
  EXERCISE_MUSCLE_BROWSE_ZONES,
} = require('../src/lib/exerciseMuscleBrowse');

async function main() {
  const rows = await prisma.exercise.findMany({
    where: { isPublic: true },
    select: { id: true, name: true, primaryMuscles: true, browseMuscleZone: true },
  });

  const counts = Object.fromEntries(EXERCISE_MUSCLE_BROWSE_ZONES.map((z) => [z, 0]));
  let unassigned = 0;
  let updated = 0;
  const BATCH = 50;
  const pending = [];

  for (const row of rows) {
    const zone = assignBrowseMuscleZone(row.primaryMuscles, row.name);
    if (zone) counts[zone]++;
    else unassigned++;
    if (row.browseMuscleZone === zone) continue;
    pending.push({ id: row.id, zone });
  }

  for (let i = 0; i < pending.length; i += BATCH) {
    const chunk = pending.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map(({ id, zone }) =>
        prisma.exercise.update({
          where: { id },
          data: { browseMuscleZone: zone },
        })
      )
    );
    updated += chunk.length;
    if ((i + BATCH) % 200 === 0 || i + BATCH >= pending.length) {
      console.log(`progress ${Math.min(i + BATCH, pending.length)}/${pending.length} updates`);
    }
  }

  console.log(JSON.stringify({ total: rows.length, updated, unassigned, counts }, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
