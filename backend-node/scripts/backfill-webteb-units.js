#!/usr/bin/env node
/**
 * Backfill WebTeb serving units (الوزن) for foods already in DB.
 * Usage: node scripts/backfill-webteb-units.js --limit=50
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { ensureFoodServingUnits, needsServingUnitEnrichment } = require('../src/lib/webtebServingUnits');
const { sleep } = require('../src/lib/webtebScraper');

const prisma = new PrismaClient();

function parseArgs() {
  let limit = 0;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--limit=')) limit = Number(arg.split('=')[1]) || 0;
  }
  return { limit };
}

async function main() {
  const { limit } = parseArgs();
  const foods = await prisma.webtebFood.findMany({
    where: { url: { not: null } },
    orderBy: { webtebId: 'asc' },
    take: limit > 0 ? limit : undefined,
  });

  let ok = 0;
  let skip = 0;
  for (const food of foods) {
    if (!needsServingUnitEnrichment(food.servingUnits)) {
      skip++;
      continue;
    }
    try {
      const units = await ensureFoodServingUnits(food);
      await prisma.webtebFood.update({
        where: { webtebId: food.webtebId },
        data: { servingUnits: units },
      });
      ok++;
      console.log(`[ok] ${food.webtebId} ${food.nameAr} → ${units.length} units`);
    } catch (e) {
      console.warn(`[fail] ${food.webtebId}`, e.message);
    }
    await sleep(500);
  }
  console.log(`Done. enriched=${ok} skipped=${skip} total=${foods.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
