/**
 * RAG-lite exercise retrieval.
 *
 * Reads the Postgres `exercises` table and returns a filtered, ranked list
 * keyed by `id` (UUID). Filters:
 *   - injuries  → blocked patterns from `lib/plans/constraints.js`
 *   - exercisesAvoid → user-specified exclusions
 *   - fitnessLevel  → match difficulty (beginner / intermediate / advanced)
 *   - workoutLocation → bias toward home/gym/bodyweight categories
 *   - exercisesLove → boost matches
 *
 * No vector search yet — Phase 8 will rerank with embeddings.
 */
const { prisma } = require('../../db');
const { isExerciseBlocked } = require('../plans/constraints');

const DIFFICULTY_MAP = {
  beginner: ['beginner'],
  novice: ['beginner'],
  intermediate: ['beginner', 'intermediate'],
  advanced: ['intermediate', 'advanced'],
  expert: ['advanced'],
};

const LOCATION_CATEGORY_HINTS = {
  home: /bodyweight|band|home|dumbbell/i,
  gym: /barbell|machine|cable|gym/i,
  both: /.*/,
};

function asArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string' && v) return [v];
  return [];
}

function normaliseRow(r) {
  const muscles = Array.isArray(r.primaryMuscles)
    ? r.primaryMuscles
    : typeof r.primaryMuscles === 'string'
      ? [r.primaryMuscles]
      : [];
  return {
    id: r.id,
    name: r.name,
    nameAr: r.nameAr || null,
    category: r.category || '',
    difficulty: (r.difficulty || '').toLowerCase(),
    primaryMuscles: muscles,
  };
}

function pickDifficulties(fitnessLevel) {
  const lvl = String(fitnessLevel || '').toLowerCase();
  if (DIFFICULTY_MAP[lvl]) return DIFFICULTY_MAP[lvl];
  for (const key of Object.keys(DIFFICULTY_MAP)) {
    if (lvl.includes(key)) return DIFFICULTY_MAP[key];
  }
  return ['beginner', 'intermediate'];
}

/**
 * @param {object} args
 * @param {object} args.onboardingData
 * @param {object} [args.profile]
 * @param {string} [args.muscleGroup]  optional bias keyword
 * @param {number} [args.limit=40]
 */
async function retrieveExercises({ onboardingData = {}, profile, muscleGroup, limit = 40 } = {}) {
  const injuries = asArray(onboardingData.injuries).filter((i) => i !== 'none');
  const avoid = asArray(onboardingData.exercisesAvoid).map((s) => s.toLowerCase());
  const loved = new Set(asArray(onboardingData.exercisesLove).map((s) => s.toLowerCase()));
  const fitnessLevel = onboardingData.fitnessLevel || profile?.fitnessLevel || '';
  const locationRaw = String(onboardingData.workoutLocation || '').toLowerCase();
  const location = ['home', 'gym', 'both'].find((k) => locationRaw.includes(k)) || 'both';

  const difficulties = pickDifficulties(fitnessLevel);

  const where = {
    isPublic: true,
    OR: [
      { difficulty: { in: difficulties } },
      { difficulty: { in: difficulties.map((d) => d.toUpperCase()) } },
      { difficulty: null },
    ],
  };

  const rows = await prisma.exercise.findMany({
    where,
    take: 400,
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

  const locationPattern = LOCATION_CATEGORY_HINTS[location] || LOCATION_CATEGORY_HINTS.both;

  const filtered = rows
    .map(normaliseRow)
    .filter((ex) => {
      if (isExerciseBlocked(ex.name, injuries)) return false;
      const lower = ex.name.toLowerCase();
      for (const a of avoid) if (a && lower.includes(a)) return false;
      return true;
    })
    .map((ex) => {
      let score = 0;
      if (loved.size) {
        for (const lv of loved) {
          if (ex.name.toLowerCase().includes(lv)) {
            score += 5;
            break;
          }
        }
      }
      const text = `${ex.category} ${ex.name}`;
      if (locationPattern.test(text)) score += 1;
      if (muscleGroup) {
        const m = String(muscleGroup).toLowerCase();
        if (ex.primaryMuscles.some((p) => String(p).toLowerCase().includes(m))) {
          score += 3;
        }
        if (ex.name.toLowerCase().includes(m)) score += 1;
      }
      return { ...ex, score };
    });

  filtered.sort((a, b) => b.score - a.score);
  return filtered.slice(0, limit);
}

function formatExerciseLineForPrompt(ex) {
  const muscles = (ex.primaryMuscles || []).slice(0, 2).join('/');
  return `- ${ex.name} | exerciseId:${ex.id} | ${ex.category || 'general'}${
    muscles ? ` | ${muscles}` : ''
  }`;
}

module.exports = {
  retrieveExercises,
  formatExerciseLineForPrompt,
};
