#!/usr/bin/env node
/** Compare static MUSCLE_EXERCISES names with library DB; report counts per wiki region. */
require('dotenv').config();
const { prisma } = require('../src/db');
const { MUSCLE_ZONE_TO_LABELS } = require('../src/lib/exerciseMuscleMap');

const STATIC_BY_ZONE = {
  chest: ['Bench Press', 'Push-ups', 'Dumbbell Flyes', 'Incline Press', 'Cable Crossover', 'Chest Dips'],
  back: ['Pull-ups', 'Barbell Rows', 'Lat Pulldown', 'Face Pulls', 'T-Bar Row', 'Deadlift'],
  shoulders: ['Overhead Press', 'Lateral Raises', 'Front Raises', 'Arnold Press', 'Upright Row', 'Shrugs'],
  biceps: ['Barbell Curl', 'Hammer Curls', 'Preacher Curl', 'Concentration Curl', 'Cable Curl', 'Chin-ups'],
  triceps: ['Tricep Pushdown', 'Skull Crushers', 'Overhead Extension', 'Close-Grip Bench', 'Dips', 'Kickbacks'],
  forearms: ['Wrist Curls', 'Reverse Curls', 'Farmer Walks', 'Plate Pinches', 'Hammer Holds', 'Dead Hangs'],
  abs: ['Crunches', 'Planks', 'Leg Raises', 'Russian Twists', 'Hanging Knee Raises', 'Ab Wheel Rollout'],
  quads: ['Barbell Back Squat', 'Leg Press', 'Hack Squat', 'Leg Extension', 'Bulgarian Split Squat', 'Walking Lunges'],
  hamstrings: ['Romanian Deadlift', 'Lying Leg Curl', 'Seated Leg Curl', 'Nordic Hamstring Curl', 'Glute-Ham Raise', 'Stiff-Leg Deadlift'],
  calves: ['Standing Calf Raise', 'Seated Calf Raise', 'Donkey Calf Raise', 'Single-Leg Calf Raise', 'Jump Rope', 'Leg Press Calf Raise'],
  glutes: ['Hip Thrust', 'Bulgarian Split Squat', 'Romanian Deadlift', 'Glute Bridge', 'Cable Kickback', 'Step-Up'],
};

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(s) {
  return norm(s).split(/\s+/).filter(Boolean);
}

function scoreMatch(staticName, dbName) {
  const a = norm(staticName);
  const b = norm(dbName);
  if (a === b) return 100;
  if (b.includes(a) || a.includes(b)) return 85;
  const ta = tokens(staticName);
  const tb = tokens(dbName);
  const overlap = ta.filter((t) => tb.some((u) => u.includes(t) || t.includes(u))).length;
  if (!ta.length) return 0;
  return Math.round((overlap / ta.length) * 70);
}

function wikiCountForRegion(all, zone) {
  const labels = new Set(MUSCLE_ZONE_TO_LABELS[zone] || []);
  return all.filter((row) => {
    const pm = Array.isArray(row.primaryMuscles) ? row.primaryMuscles : [];
    return pm.some((m) => labels.has(m));
  }).length;
}

function wikiExercisesForRegion(all, zone) {
  const labels = new Set(MUSCLE_ZONE_TO_LABELS[zone] || []);
  return all.filter((row) => {
    const pm = Array.isArray(row.primaryMuscles) ? row.primaryMuscles : [];
    return pm.some((m) => labels.has(m));
  });
}

async function main() {
  const all = await prisma.exercise.findMany({
    where: { isPublic: true },
    select: { id: true, name: true, slug: true, primaryMuscles: true },
    orderBy: { name: 'asc' },
  });

  const byNormName = new Map();
  for (const row of all) {
    const key = norm(row.name);
    if (!byNormName.has(key)) byNormName.set(key, []);
    byNormName.get(key).push(row);
  }

  const report = { zones: {}, staticMatches: {}, countParity: {} };

  for (const [zone, staticNames] of Object.entries(STATIC_BY_ZONE)) {
    const regionExercises = wikiExercisesForRegion(all, zone);
    const wikiCount = regionExercises.length;
    const matches = [];

    for (const staticName of staticNames) {
      let best = null;
      let bestScore = 0;
      for (const row of all) {
        const sc = scoreMatch(staticName, row.name);
        if (sc > bestScore) {
          bestScore = sc;
          best = row;
        }
      }
      const exact = byNormName.get(norm(staticName))?.[0] ?? null;
      matches.push({
        staticName,
        exactId: exact?.id ?? null,
        exactName: exact?.name ?? null,
        fuzzyId: bestScore >= 60 ? best?.id : null,
        fuzzyName: bestScore >= 60 ? best?.name : null,
        fuzzyScore: bestScore,
      });
    }

    report.zones[zone] = { wikiCount, staticCount: staticNames.length };
    report.staticMatches[zone] = matches;
    report.countParity[zone] = {
      wikiCount,
      staticFallbackWouldShow: staticNames.length,
      mismatch: staticNames.length !== wikiCount,
    };
  }

  // Fine regions (no static list) — counts only
  const fineZones = Object.keys(MUSCLE_ZONE_TO_LABELS).filter((z) => !STATIC_BY_ZONE[z]);
  report.fineRegions = {};
  for (const zone of fineZones) {
    report.fineRegions[zone] = wikiCountForRegion(all, zone);
  }

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
