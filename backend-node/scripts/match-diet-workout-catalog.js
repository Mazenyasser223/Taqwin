/* eslint-disable no-console */
/**
 * Match Diet / Workout PDF manifest entries to WebTeb foods and public exercises in Postgres.
 * Writes webtebId / exerciseId bindings back into the manifest files for plan generation.
 *
 *   node scripts/match-diet-workout-catalog.js
 *   node scripts/match-diet-workout-catalog.js --write
 */
const fs = require('fs');
const path = require('path');
const { prisma } = require('../src/db');
const {
  loadManifest: loadFoodManifest,
  MANIFEST_PATH: FOOD_MANIFEST,
} = require('../src/lib/rag/planDietPdfCatalog');
const {
  loadManifest: loadExerciseManifest,
  MANIFEST_PATH: EXERCISE_MANIFEST,
} = require('../src/lib/rag/planWorkoutPdfCatalog');
const {
  resolveFoodFromPool,
  resolveExerciseFromPool,
} = require('../src/lib/rag/planDietWorkoutMatch');

async function loadWebtebPool() {
  return prisma.webtebFood.findMany({
    take: 4000,
    orderBy: { protein: 'desc' },
    select: {
      webtebId: true,
      nameEn: true,
      nameAr: true,
      calories: true,
      protein: true,
      carbs: true,
      fat: true,
      categorySlug: true,
    },
  });
}

async function loadExercisePool() {
  return prisma.exercise.findMany({
    where: { isPublic: true },
    take: 5000,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      nameAr: true,
      category: true,
      difficulty: true,
      primaryMuscles: true,
    },
  });
}

function attachFoodBinding(entry, resolved) {
  const next = { ...entry };
  if (resolved.row) {
    next.webtebId = resolved.row.webtebId;
    next.dbNameAr = resolved.row.nameAr || null;
    next.dbNameEn = resolved.row.nameEn || null;
    next.matchScore = resolved.score;
    next.matchMethod = resolved.method;
  } else {
    delete next.webtebId;
    delete next.dbNameAr;
    delete next.dbNameEn;
    next.matchScore = resolved.score;
    next.matchMethod = 'unmatched';
  }
  return next;
}

function attachExerciseBinding(entry, resolved) {
  const next = { ...entry };
  if (resolved.row) {
    next.exerciseId = resolved.row.id;
    next.dbName = resolved.row.name;
    next.dbNameAr = resolved.row.nameAr || null;
    next.matchScore = resolved.score;
    next.matchMethod = resolved.method;
  } else {
    delete next.exerciseId;
    delete next.dbName;
    delete next.dbNameAr;
    next.matchScore = resolved.score;
    next.matchMethod = 'unmatched';
  }
  return next;
}

async function matchFoods() {
  const manifest = loadFoodManifest();
  const pool = await loadWebtebPool();
  const foods = (manifest.foods || []).map((entry) =>
    attachFoodBinding(entry, resolveFoodFromPool(entry.nameAr, pool))
  );

  const diets = {};
  for (const [dietKey, rows] of Object.entries(manifest.diets || {})) {
    diets[dietKey] = (rows || []).map((entry) =>
      attachFoodBinding(entry, resolveFoodFromPool(entry.nameAr, pool))
    );
  }

  const matched = foods.filter((f) => f.webtebId != null).length;
  const unmatched = foods.filter((f) => f.webtebId == null);

  return { manifest, foods, diets, matched, unmatched, total: foods.length };
}

async function matchExercises() {
  const manifest = loadExerciseManifest();
  const pool = await loadExercisePool();
  const exercises = (manifest.exercises || []).map((entry) =>
    attachExerciseBinding(entry, resolveExerciseFromPool(entry.name, pool))
  );

  const workouts = {};
  for (const [workoutKey, rows] of Object.entries(manifest.workouts || {})) {
    workouts[workoutKey] = (rows || []).map((entry) =>
      attachExerciseBinding(entry, resolveExerciseFromPool(entry.name, pool))
    );
  }

  const matched = exercises.filter((e) => e.exerciseId).length;
  const unmatched = exercises.filter((e) => !e.exerciseId);

  return { manifest, exercises, workouts, matched, unmatched, total: exercises.length };
}

async function main() {
  const write = process.argv.includes('--write');
  const [foodResult, exerciseResult] = await Promise.all([matchFoods(), matchExercises()]);

  console.log(`Foods: ${foodResult.matched}/${foodResult.total} matched to WebTeb`);
  if (foodResult.unmatched.length) {
    console.log('Unmatched foods:');
    for (const row of foodResult.unmatched) {
      console.log(`  - ${row.nameAr} (score ${row.matchScore || 0})`);
    }
  }

  console.log(`Exercises: ${exerciseResult.matched}/${exerciseResult.total} matched to catalog`);
  if (exerciseResult.unmatched.length) {
    console.log('Unmatched exercises:');
    for (const row of exerciseResult.unmatched) {
      console.log(`  - ${row.name} (score ${row.matchScore || 0})`);
    }
  }

  if (!write) {
    console.log('\nPass --write to save webtebId / exerciseId bindings into manifest JSON files.');
    await prisma.$disconnect();
    return;
  }

  const foodManifest = {
    ...foodResult.manifest,
    version: 2,
    matchedAt: new Date().toISOString(),
    diets: foodResult.diets,
    foods: foodResult.foods,
  };
  const exerciseManifest = {
    ...exerciseResult.manifest,
    version: 2,
    matchedAt: new Date().toISOString(),
    workouts: exerciseResult.workouts,
    exercises: exerciseResult.exercises,
  };

  fs.writeFileSync(FOOD_MANIFEST, `${JSON.stringify(foodManifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(EXERCISE_MANIFEST, `${JSON.stringify(exerciseManifest, null, 2)}\n`, 'utf8');
  console.log('\nWrote', FOOD_MANIFEST);
  console.log('Wrote', EXERCISE_MANIFEST);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
