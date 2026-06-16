#!/usr/bin/env node
require('dotenv').config();
const { prisma } = require('../src/db');

async function main() {
  const counts = await prisma.exercise.groupBy({
    by: ['browseMuscleZone'],
    where: { isPublic: true, browseMuscleZone: { not: null } },
    _count: { browseMuscleZone: true },
  });
  const totalAssigned = counts.reduce((s, r) => s + r._count.browseMuscleZone, 0);
  const unassigned = await prisma.exercise.count({
    where: { isPublic: true, browseMuscleZone: null },
  });
  const chest = await prisma.exercise.findMany({
    where: { isPublic: true, browseMuscleZone: 'chest' },
    select: { name: true, browseMuscleZone: true },
    take: 3,
  });
  const chestWrong = await prisma.exercise.count({
    where: {
      isPublic: true,
      browseMuscleZone: 'chest',
      name: { contains: 'lat pulldown', mode: 'insensitive' },
    },
  });

  console.log(
    JSON.stringify(
      {
        totalAssigned,
        unassigned,
        chestCount: counts.find((c) => c.browseMuscleZone === 'chest')?._count.browseMuscleZone,
        chestSample: chest,
        chestHasLatPulldown: chestWrong,
        ok: totalAssigned === 1977 && unassigned === 4,
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
