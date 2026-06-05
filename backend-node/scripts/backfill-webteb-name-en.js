#!/usr/bin/env node
/**
 * Fill WebTeb food English names (name_en) from Arabic titles.
 * Usage: node scripts/backfill-webteb-name-en.js --limit=100
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { translateFoodNameArToEn } = require('../src/lib/webtebFoodNameEn');
const { sleep } = require('../src/lib/webtebScraper');

const prisma = new PrismaClient();

function parseArgs() {
  let limit = 0;
  let force = false;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--limit=')) limit = Number(arg.split('=')[1]) || 0;
    if (arg === '--force') force = true;
  }
  return { limit, force };
}

async function main() {
  const { limit, force } = parseArgs();
  const foods = await prisma.webtebFood.findMany({
    where: force ? {} : { OR: [{ nameEn: null }, { nameEn: '' }] },
    orderBy: { webtebId: 'asc' },
    take: limit > 0 ? limit : undefined,
    select: { webtebId: true, nameAr: true, nameEn: true },
  });

  console.log(`[name-en] ${foods.length} foods to translate`);
  let ok = 0;
  let fail = 0;

  for (const food of foods) {
    try {
      const nameEn = await translateFoodNameArToEn(food.nameAr);
      if (!nameEn) {
        fail++;
        continue;
      }
      await prisma.webtebFood.update({
        where: { webtebId: food.webtebId },
        data: { nameEn },
      });
      ok++;
      if (ok % 25 === 0) {
        console.log(`[name-en] ${ok}/${foods.length} — latest: ${food.nameAr} → ${nameEn}`);
      }
    } catch (e) {
      fail++;
      console.warn(`[name-en] fail ${food.webtebId}`, e.message);
      await sleep(2000);
    }
  }

  console.log(`[name-en] Done. updated=${ok} failed=${fail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
