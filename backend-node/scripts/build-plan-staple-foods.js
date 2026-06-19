#!/usr/bin/env node
/**
 * Build shared/plan-staple-foods.json from Postgres WebTeb catalog.
 * Top N (default 50) popular foods per plan group.
 *
 *   node scripts/build-plan-staple-foods.js
 *   node scripts/build-plan-staple-foods.js --per-group=50
 */
require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');
const { prisma } = require('../src/db');
const { loadStaplesFromDb, STAPLES_PATH, loadGroupConfig } = require('../src/lib/plans/planStapleFoods');

function parsePerGroup(argv) {
  for (const arg of argv) {
    if (arg.startsWith('--per-group=')) return Number(arg.split('=')[1]) || 50;
  }
  return 50;
}

async function main() {
  const perGroup = parsePerGroup(process.argv.slice(2));
  const flat = await loadStaplesFromDb({ onboardingData: {}, locale: 'en', perGroup });
  const config = loadGroupConfig();
  const groups = {};
  for (const key of Object.keys(config.groups)) groups[key] = [];

  for (const item of flat) {
    const g = item.planGroup || 'other';
    if (!groups[g]) groups[g] = [];
    groups[g].push({
      webtebId: item.webtebId,
      name: item.nameEn || item.name,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      category: item.category,
      planGroup: g,
    });
  }

  const payload = {
    version: 1,
    builtAt: new Date().toISOString(),
    perGroupLimit: perGroup,
    groups,
    totals: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
  };

  fs.mkdirSync(path.dirname(STAPLES_PATH), { recursive: true });
  fs.writeFileSync(STAPLES_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log('Wrote', STAPLES_PATH);
  console.log('Totals:', payload.totals);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
