/**
 * Plan exercise whitelist from diets & workouts/Workout 1.pdf … Workout 4.pdf manifest.
 * Resolves extracted English names to public exercise catalog rows.
 */
const fs = require('fs');
const path = require('path');
const { prisma } = require('../../db');
const {
  normaliseExerciseRow,
  filterExerciseCandidates,
} = require('./catalogExercise');
const { normalizeForMatch } = require('./planDietWorkoutMatch');
const { resolveExerciseFromPool } = require('./planDietWorkoutMatch');

const MANIFEST_PATH = path.join(__dirname, '../../../data/diet-workout-catalog/exercises.manifest.json');

const EXERCISE_TOKEN_SKIP = new Set([
  'the', 'and', 'with', 'male', 'female', 'single', 'arm', 'one', 'two', 'hand',
]);

let manifestCache = null;
let exercisePoolCache = null;
let exercisePoolLoadedAt = 0;
const POOL_TTL_MS = 10 * 60 * 1000;

function loadManifest() {
  if (manifestCache) return manifestCache;
  if (!fs.existsSync(MANIFEST_PATH)) {
    manifestCache = { exercises: [] };
    return manifestCache;
  }
  manifestCache = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  return manifestCache;
}

function meaningfulTokens(name) {
  return normalizeForMatch(name)
    .split(' ')
    .filter((t) => t.length > 2 && !EXERCISE_TOKEN_SKIP.has(t));
}

function scoreExerciseNameMatch(query, row) {
  const q = normalizeForMatch(query);
  if (!q) return 0;
  const en = normalizeForMatch(row.name);
  const ar = normalizeForMatch(row.nameAr);
  if (en === q || ar === q) return 100;
  if (en.includes(q) || q.includes(en)) return 88;
  if (ar && (ar.includes(q) || q.includes(ar))) return 82;

  const qTokens = meaningfulTokens(query);
  if (!qTokens.length) return 0;
  const rowTokens = [
    ...meaningfulTokens(row.name),
    ...(row.nameAr ? meaningfulTokens(row.nameAr) : []),
  ];
  if (!rowTokens.length) return 0;

  let overlap = 0;
  for (const token of qTokens) {
    if (rowTokens.some((rt) => rt.includes(token) || token.includes(rt))) overlap += 1;
  }
  const ratio = overlap / qTokens.length;
  if (ratio >= 0.75) return 70 + overlap * 5;
  if (ratio >= 0.5) return 45 + overlap * 4;
  return overlap * 8;
}

async function loadExercisePool() {
  const now = Date.now();
  if (exercisePoolCache && now - exercisePoolLoadedAt < POOL_TTL_MS) {
    return exercisePoolCache;
  }
  exercisePoolCache = await prisma.exercise.findMany({
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
  exercisePoolLoadedAt = now;
  return exercisePoolCache;
}

async function loadRowsByExerciseIds(exerciseIds) {
  const ids = [...new Set(exerciseIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.exercise.findMany({
    where: { id: { in: ids }, isPublic: true },
    select: {
      id: true,
      name: true,
      nameAr: true,
      category: true,
      difficulty: true,
      primaryMuscles: true,
    },
  });
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * @param {object} [opts]
 * @param {object} [opts.onboardingData]
 * @param {object} [opts.profile]
 * @param {number} [opts.limit]
 */
async function loadWorkoutPdfExerciseCatalog({
  onboardingData = {},
  profile,
  limit = 80,
} = {}) {
  const manifest = loadManifest();
  const entries = manifest.exercises || [];
  if (!entries.length) return [];

  const boundIds = entries.map((entry) => entry.exerciseId).filter(Boolean);
  const boundRows = await loadRowsByExerciseIds(boundIds);
  const pool = boundRows.size < entries.length ? await loadExercisePool() : [];

  const resolved = [];
  const seen = new Set();

  for (const entry of entries) {
    let row = entry.exerciseId ? boundRows.get(entry.exerciseId) : null;
    if (!row) {
      const match = resolveExerciseFromPool(entry.name, pool);
      row = match.row;
    }
    if (!row) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    resolved.push({
      ...normaliseExerciseRow(row),
      _workoutPdf: true,
      _pdfName: entry.name,
      defaultSets: entry.defaultSets ?? null,
      defaultReps: entry.defaultReps ?? null,
      score: 110,
    });
  }

  const filtered = filterExerciseCandidates(resolved, { onboardingData, profile });
  return filtered.slice(0, limit);
}

function getWorkoutPdfExerciseNameList() {
  return (loadManifest().exercises || []).map((e) => e.name).filter(Boolean);
}

module.exports = {
  MANIFEST_PATH,
  loadManifest,
  loadWorkoutPdfExerciseCatalog,
  getWorkoutPdfExerciseNameList,
  scoreExerciseNameMatch,
};
