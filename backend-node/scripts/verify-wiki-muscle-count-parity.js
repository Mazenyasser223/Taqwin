#!/usr/bin/env node
/** Verify wiki muscle-counts match list API total for every region. */
require('dotenv').config();
const { prisma } = require('../src/db');
const { Prisma } = require('../generated/prisma');
const { MUSCLE_ZONE_TO_LABELS } = require('../src/lib/exerciseMuscleMap');
const exerciseBrowseMetadata = require('../src/lib/exerciseBrowseMetadata');

function muscleOverlapSql(labels) {
  return Prisma.sql`primary_muscles ?| ARRAY[${Prisma.join(labels.map((l) => Prisma.sql`${l}`))}]::text[]`;
}

async function listTotal(muscle) {
  const labels = MUSCLE_ZONE_TO_LABELS[muscle];
  if (!labels?.length) return 0;
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count FROM exercises
    WHERE is_public = true AND ${muscleOverlapSql(labels)}
  `;
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const counts = await exerciseBrowseMetadata.getMuscleCounts('wiki');
  const mismatches = [];

  for (const zone of Object.keys(MUSCLE_ZONE_TO_LABELS)) {
    const fromCounts = counts[zone] ?? 0;
    const fromList = await listTotal(zone);
    if (fromCounts !== fromList) {
      mismatches.push({ zone, fromCounts, fromList });
    }
    console.log(`${zone}: counts=${fromCounts} list=${fromList} ${fromCounts === fromList ? 'OK' : 'MISMATCH'}`);
  }

  console.log(JSON.stringify({ ok: mismatches.length === 0, mismatches }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
