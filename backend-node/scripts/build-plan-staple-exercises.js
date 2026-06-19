#!/usr/bin/env node
/**
 * Build shared/plan-staple-exercises.json from Postgres exercise library.
 * Staples are barbell, dumbbell, or cable only (up to 50 per muscle×difficulty cell).
 *
 *   node scripts/build-plan-staple-exercises.js
 *   node scripts/build-plan-staple-exercises.js --per-cell=50
 */
require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');
const { prisma } = require('../src/db');
const {
  loadStaplesFromDb,
  STAPLES_PATH,
  loadGroupConfig,
} = require('../src/lib/plans/planStapleExercises');

function parsePerCell(argv) {
  for (const arg of argv) {
    if (arg.startsWith('--per-cell=')) return Number(arg.split('=')[1]) || 50;
  }
  return 50;
}

async function main() {
  const perCell = parsePerCell(process.argv.slice(2));
  const flat = await loadStaplesFromDb({
    onboardingData: {},
    profile: {},
    locale: 'en',
    perCell,
  });
  const config = loadGroupConfig();
  const cells = {};

  for (const item of flat) {
    const key = `${item.muscleGroup}:${item.planDifficulty}`;
    if (!cells[key]) cells[key] = [];
    cells[key].push({
      id: item.id,
      exerciseId: item.exerciseId,
      name: item.name,
      nameAr: item.nameAr,
      category: item.category,
      difficulty: item.difficulty,
      primaryMuscles: item.primaryMuscles,
      browseMuscleZone: item.browseMuscleZone,
      muscleGroup: item.muscleGroup,
      planDifficulty: item.planDifficulty,
    });
  }

  const payload = {
    version: 1,
    builtAt: new Date().toISOString(),
    perCellLimit: perCell,
    cells,
    totals: Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, v.length])),
    groupCount: Object.keys(config.groups).length,
    difficultyCount: (config.difficulties || []).length,
  };

  fs.mkdirSync(path.dirname(STAPLES_PATH), { recursive: true });
  fs.writeFileSync(STAPLES_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log('Wrote', STAPLES_PATH);
  console.log('Cell totals sample:', Object.entries(payload.totals).slice(0, 8));
  console.log('Total exercises:', flat.length);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
