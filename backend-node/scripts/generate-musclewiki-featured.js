#!/usr/bin/env node
/**
 * Resolve static Muscle Wiki exercise labels → library exercise IDs (per wiki region).
 * Output: frontend/features/muscle-wiki/muscleFeaturedExercises.generated.ts
 *
 *   npm run generate:musclewiki-featured
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { prisma } = require('../src/db');
const { MUSCLE_ZONE_TO_LABELS } = require('../src/lib/exerciseMuscleMap');

const STATIC_BY_ZONE = {
  chest: ['Bench Press', 'Push-ups', 'Dumbbell Flyes', 'Incline Press', 'Cable Crossover', 'Chest Dips'],
  back: ['Pull-ups', 'Barbell Rows', 'Lat Pulldown', 'Face Pulls', 'T-Bar Row', 'Deadlift'],
  shoulders: ['Overhead Press', 'Lateral Raises', 'Front Raises', 'Arnold Press', 'Upright Row', 'Shrugs'],
  biceps: ['Barbell Curl', 'Hammer Curls', 'Preacher Curl', 'Concentration Curl', 'Cable Curl', 'Chin-ups'],
  triceps: ['Tricep Pushdown', 'Skull Crushers', 'Overhead Extension', 'Close-Grip Bench', 'Dips', 'Kickbacks'],
  forearms: ['Wrist Curls', 'Reverse Curls', 'Farmer Walks', 'Plate Pinches', 'Dead Hang', 'Hammer Curl'],
  abs: ['Crunches', 'Planks', 'Leg Raises', 'Russian Twists', 'Hanging Knee Raises', 'Ab Wheel Rollout'],
  quads: ['Barbell Back Squat', 'Leg Press', 'Hack Squat', 'Leg Extension', 'Bulgarian Split Squat', 'Walking Lunges'],
  hamstrings: ['Romanian Deadlift', 'Lying Leg Curl', 'Seated Leg Curl', 'Nordic Hamstring Curl', 'Glute Ham Raise', 'Stiff Leg Deadlift'],
  calves: ['Standing Calf Raise', 'Seated Calf Raise', 'Donkey Calf Raise', 'Single Leg Calf Raise', 'Jump Rope', 'Leg Press Calf Raise'],
  glutes: ['Hip Thrust', 'Bulgarian Split Squat', 'Romanian Deadlift', 'Glute Bridge', 'Cable Kickback', 'Step Up'],
  lats: ['Pull Ups', 'Lat Pulldown', 'Barbell Bent Over Row', 'Cable Pulldown', 'Dumbbell Pullover', 'Straight Arm Pulldown'],
  lowerback: ['Deadlift', 'Back Extension', 'Good Morning', 'Superman', 'Reverse Hyperextension', 'Bird Dog'],
  traps: ['Barbell Shrug', 'Dumbbell Shrug', 'Face Pull', 'Farmer Walk', 'Upright Row', 'Power Shrug'],
  trapsmiddle: ['Face Pull', 'Cable Row', 'Reverse Fly', 'T Bar Row', 'Chest Supported Row', 'Seal Row'],
  frontshoulders: ['Overhead Press', 'Front Raise', 'Arnold Press', 'Landmine Press', 'Cable Front Raise', 'Pike Push Up'],
  rearshoulders: ['Face Pull', 'Reverse Fly', 'Rear Delt Fly', 'Band Pull Apart', 'Cable Rear Delt Fly', 'Bent Over Lateral Raise'],
  hands: ['Wrist Curl', 'Reverse Wrist Curl', 'Farmer Walk', 'Plate Pinch', 'Dead Hang', 'Hammer Curl'],
  abdominals: ['Crunches', 'Plank', 'Leg Raise', 'Cable Crunch', 'Hanging Knee Raise', 'Ab Wheel'],
  obliques: ['Russian Twist', 'Side Plank', 'Woodchopper', 'Bicycle Crunch', 'Oblique Crunch', 'Pallof Press'],
};

const EQUIPMENT_PREFIX = /^(band|barbell|dumbbell|cable|machine|bodyweight|kettlebell|smith)\s+/i;

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(s) {
  return norm(s).split(/\s+/).filter(Boolean);
}

function synonyms(token) {
  const map = {
    ups: ['up'],
    up: ['ups'],
    press: ['presses'],
    presses: ['press'],
    curl: ['curls'],
    curls: ['curl'],
    raise: ['raises'],
    raises: ['raise'],
    row: ['rows'],
    rows: ['row'],
    dip: ['dips'],
    dips: ['dip'],
    fly: ['flye', 'flies'],
    flye: ['fly', 'flies'],
    flies: ['fly', 'flye'],
    tricep: ['triceps'],
    triceps: ['tricep'],
    bicep: ['biceps'],
    biceps: ['bicep'],
    push: ['pushup', 'pushups'],
    pull: ['pullup', 'pullups'],
  };
  return [token, ...(map[token] || [])];
}

function tokenMatch(wantTok, nameTok) {
  if (wantTok === nameTok) return true;
  return synonyms(wantTok).some((s) => s === nameTok);
}

function tokenInName(token, nameTokens) {
  return nameTokens.some((nt) => tokenMatch(token, nt));
}

function scoreCandidate(staticName, exerciseName) {
  const stripped = exerciseName.replace(EQUIPMENT_PREFIX, '').trim();
  const nStatic = norm(staticName);
  const nName = norm(stripped);
  if (!nStatic) return 0;
  if (nName === nStatic) return 1000;
  if (nName.includes(nStatic) || nStatic.includes(nName)) return 800;

  const want = tokens(staticName);
  const nameTokens = tokens(stripped);
  if (!want.length || !nameTokens.length) return 0;

  let wi = 0;
  for (const nt of nameTokens) {
    if (wi >= want.length) break;
    if (tokenInName(want[wi], [nt])) wi += 1;
  }
  if (wi < want.length) return 0;

  let score = 120 + wi * 12;
  score -= Math.max(0, nameTokens.length - want.length) * 4;
  if (EQUIPMENT_PREFIX.test(exerciseName) && !EQUIPMENT_PREFIX.test(staticName)) score -= 15;
  return score;
}

function regionCandidates(all, zone) {
  const labels = new Set(MUSCLE_ZONE_TO_LABELS[zone] || []);
  return all.filter((row) => {
    const pm = Array.isArray(row.primaryMuscles) ? row.primaryMuscles : [];
    return pm.some((m) => labels.has(m));
  });
}

function resolveFeatured(staticName, candidates, usedIds) {
  let best = null;
  let bestScore = 0;
  for (const row of candidates) {
    if (usedIds.has(row.id)) continue;
    const score = scoreCandidate(staticName, row.name);
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  if (best && bestScore >= 100) return { ...best, matchScore: bestScore };
  return null;
}

function escapeStr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function main() {
  const all = await prisma.exercise.findMany({
    where: { isPublic: true },
    select: { id: true, name: true, slug: true, primaryMuscles: true },
    orderBy: { name: 'asc' },
  });

  const featured = {};
  const links = {};
  const unresolved = [];

  for (const [zone, staticNames] of Object.entries({ ...STATIC_BY_ZONE })) {
    const candidates = regionCandidates(all, zone);
    const used = new Set();
    const ids = [];
    const zoneLinks = [];

    for (const staticName of staticNames) {
      const hit = resolveFeatured(staticName, candidates, used);
      if (hit) {
        used.add(hit.id);
        ids.push(hit.id);
        zoneLinks.push({
          label: staticName,
          id: hit.id,
          libraryName: hit.name,
          score: hit.matchScore,
        });
      } else {
        unresolved.push({ zone, staticName });
      }
    }

    // Fill remaining slots from region catalog (alphabetical) if static labels did not resolve
    if (ids.length < 6) {
      for (const row of candidates) {
        if (ids.length >= 6) break;
        if (used.has(row.id)) continue;
        used.add(row.id);
        ids.push(row.id);
        zoneLinks.push({
          label: row.name,
          id: row.id,
          libraryName: row.name,
          score: 0,
          fallback: true,
        });
      }
    }

    featured[zone] = ids;
    links[zone] = zoneLinks;
  }

  const outPath = path.join(
    __dirname,
    '../../frontend/features/muscle-wiki/muscleFeaturedExercises.generated.ts',
  );

  const lines = [
    '/** AUTO-GENERATED — npm run generate:musclewiki-featured */',
    "import type { MuscleRegion } from './types';",
    '',
    'export type MuscleFeaturedLink = {',
    '  label: string;',
    '  exerciseId: string;',
    '  libraryName: string;',
    '};',
    '',
    '/** Library exercise IDs featured per wiki muscle region (same labels as 3D model hints). */',
    'export const MUSCLE_FEATURED_EXERCISE_IDS: Partial<Record<MuscleRegion, string[]>> = {',
  ];

  for (const [zone, ids] of Object.entries(featured)) {
    lines.push(`  ${zone}: [${ids.map((id) => `'${id}'`).join(', ')}],`);
  }
  lines.push('};', '');

  lines.push('export const MUSCLE_FEATURED_LINKS: Partial<Record<MuscleRegion, MuscleFeaturedLink[]>> = {');
  for (const [zone, zoneLinks] of Object.entries(links)) {
    const entries = zoneLinks
      .map(
        (l) =>
          `    { label: '${escapeStr(l.label)}', exerciseId: '${l.id}', libraryName: '${escapeStr(l.libraryName)}' }`,
      )
      .join(',\n');
    lines.push(`  ${zone}: [\n${entries},\n  ],`);
  }
  lines.push('};', '');

  fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        zones: Object.keys(featured).length,
        unresolved: unresolved.length,
        unresolvedSample: unresolved.slice(0, 15),
        output: outPath,
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
