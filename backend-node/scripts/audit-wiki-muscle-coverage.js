#!/usr/bin/env node
/** Audit Muscle Wiki region → exercise coverage via primary_muscles overlap. */
require('dotenv').config();
const { prisma } = require('../src/db');
const { MUSCLE_ZONE_TO_LABELS } = require('../src/lib/exerciseMuscleMap');

async function main() {
  const all = await prisma.exercise.findMany({
    where: { isPublic: true },
    select: { primaryMuscles: true },
  });

  const labelSet = new Set();
  for (const row of all) {
    const pm = Array.isArray(row.primaryMuscles) ? row.primaryMuscles : [];
    for (const m of pm) labelSet.add(m);
  }
  const dbLabels = [...labelSet].sort();

  const zones = Object.keys(MUSCLE_ZONE_TO_LABELS);
  const zero = [];
  const counts = {};
  for (const zone of zones) {
    const labels = new Set(MUSCLE_ZONE_TO_LABELS[zone]);
    const count = all.filter((row) => {
      const pm = Array.isArray(row.primaryMuscles) ? row.primaryMuscles : [];
      return pm.some((m) => labels.has(m));
    }).length;
    counts[zone] = count;
    if (count === 0) zero.push({ zone, labels: [...labels] });
    console.log(`${zone}: ${count}`);
  }

  const allMapped = new Set(Object.values(MUSCLE_ZONE_TO_LABELS).flat());
  const unmapped = dbLabels.filter((m) => !allMapped.has(m));

  console.log(
    JSON.stringify(
      {
        totalExercises: all.length,
        totalZones: zones.length,
        zeroCountZones: zero.length,
        zeroZones: zero,
        unmappedDbLabels: unmapped,
        ok: zero.length === 0,
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
