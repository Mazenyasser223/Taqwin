#!/usr/bin/env node
/** Verify browse_muscle_zone: one zone per exercise, no overlap in counts. */
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

  let unassigned = 0;
  let mismatch = 0;
  const zoneCounts = Object.fromEntries(EXERCISE_MUSCLE_BROWSE_ZONES.map((z) => [z, 0]));
  const mismatchExamples = [];
  const unassignedExamples = [];

  for (const row of rows) {
    const expected = assignBrowseMuscleZone(row.primaryMuscles, row.name);
    const stored = row.browseMuscleZone;

    if (!stored) {
      unassigned++;
      if (unassignedExamples.length < 10) {
        unassignedExamples.push({ name: row.name, primaryMuscles: row.primaryMuscles, expected });
      }
    } else if (stored !== expected) {
      mismatch++;
      if (mismatchExamples.length < 10) {
        mismatchExamples.push({ name: row.name, stored, expected, primaryMuscles: row.primaryMuscles });
      }
    }

    if (stored && zoneCounts[stored] != null) zoneCounts[stored]++;
  }

  const sumZones = Object.values(zoneCounts).reduce((a, b) => a + b, 0);

  console.log(
    JSON.stringify(
      {
        total: rows.length,
        assigned: rows.length - unassigned,
        unassigned,
        mismatch,
        sumZones,
        zoneCounts,
        unassignedExamples,
        mismatchExamples,
        ok: unassigned === 0 && mismatch === 0 && sumZones === rows.length - unassigned,
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
