/**

 * Exercise catalog SQL pool + constraint filters (shared by ragRetrieve catalog mode).

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



function normaliseExerciseRow(r) {

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



function filterExerciseCandidates(rows, { onboardingData = {}, profile } = {}) {

  const injuries = asArray(onboardingData.injuries).filter((i) => i !== 'none');

  const avoid = asArray(onboardingData.exercisesAvoid).map((s) => s.toLowerCase());



  return rows.filter((ex) => {

    if (isExerciseBlocked(ex.name, injuries)) return false;

    const lower = ex.name.toLowerCase();

    for (const a of avoid) if (a && lower.includes(a)) return false;

    return true;

  });

}



function scoreExerciseRow(ex, { onboardingData = {}, profile, muscleGroup } = {}) {

  const loved = new Set(asArray(onboardingData.exercisesLove).map((s) => s.toLowerCase()));

  const locationRaw = String(onboardingData.workoutLocation || '').toLowerCase();

  const location = ['home', 'gym', 'both'].find((k) => locationRaw.includes(k)) || 'both';

  const locationPattern = LOCATION_CATEGORY_HINTS[location] || LOCATION_CATEGORY_HINTS.both;



  let score = ex._vectorScore ?? ex.score ?? 0;

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

    if (ex.primaryMuscles.some((p) => String(p).toLowerCase().includes(m))) score += 3;

    if (ex.name.toLowerCase().includes(m)) score += 1;

  }

  return { ...ex, score };

}



async function retrieveExercisesSql({

  onboardingData = {},

  profile,

  muscleGroup,

  limit = 40,

} = {}) {

  const fitnessLevel = onboardingData.fitnessLevel || profile?.fitnessLevel || '';

  const difficulties = pickDifficulties(fitnessLevel);



  const rows = await prisma.exercise.findMany({

    where: {

      isPublic: true,

      OR: [

        { difficulty: { in: difficulties } },

        { difficulty: { in: difficulties.map((d) => d.toUpperCase()) } },

        { difficulty: null },

      ],

    },

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



  const filtered = filterExerciseCandidates(rows.map(normaliseExerciseRow), {

    onboardingData,

    profile,

  });

  const scored = filtered.map((ex) => scoreExerciseRow(ex, { onboardingData, profile, muscleGroup }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ score, _vectorScore, ...rest }) => ({ ...rest, score }));

}



module.exports = {

  retrieveExercisesSql,

  filterExerciseCandidates,

  scoreExerciseRow,

  normaliseExerciseRow,

};

