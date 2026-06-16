/**
 * Cached aggregates for exercise library filter UI.
 */
const { Prisma } = require('../../generated/prisma');
const { prisma } = require('../db');
const { muscleLabelsForZone, MUSCLE_ZONE_TO_LABELS } = require('./exerciseMuscleMap');
const { EXERCISE_MUSCLE_BROWSE_ZONES } = require('./exerciseMuscleBrowse');
const {
  EQUIPMENT_GROUPS,
  allGroupedCategories,
} = require('./exerciseCategoryGroups');
const { EXERCISE_FITNESS_GOALS } = require('./exerciseFitnessGoals');
const { getOrFetch } = require('./exerciseBrowseCache');

function muscleOverlapSql(labels) {
  return Prisma.sql`primary_muscles ?| ARRAY[${Prisma.join(labels.map((l) => Prisma.sql`${l}`))}]::text[]`;
}

async function fetchCategories() {
  const grouped = await prisma.exercise.groupBy({
    by: ['category'],
    where: { isPublic: true },
    _count: { category: true },
    orderBy: { _count: { category: 'desc' } },
  });
  return grouped.map((row) => ({
    category: row.category,
    count: row._count.category,
  }));
}

async function fetchCategoryGroups() {
  const grouped = await prisma.exercise.groupBy({
    by: ['category'],
    where: { isPublic: true },
    _count: { category: true },
  });
  const byCat = Object.fromEntries(grouped.map((r) => [r.category, r._count.category]));
  const known = new Set(allGroupedCategories());
  const counts = {};
  for (const group of EQUIPMENT_GROUPS) {
    counts[group.id] = group.categories.reduce((sum, cat) => sum + (byCat[cat] ?? 0), 0);
  }
  counts.other = grouped
    .filter((r) => !known.has(r.category))
    .reduce((sum, r) => sum + r._count.category, 0);
  return counts;
}

async function fetchGoalCounts() {
  const rows = await prisma.$queryRaw`
    SELECT g.goal, COUNT(*)::int AS count
    FROM exercises e, unnest(e.fitness_goals) AS g(goal)
    WHERE e.is_public = true
    GROUP BY g.goal
  `;
  const counts = Object.fromEntries(EXERCISE_FITNESS_GOALS.map((goal) => [goal, 0]));
  for (const row of rows) {
    if (row.goal && counts[row.goal] != null) counts[row.goal] = Number(row.count);
  }
  return counts;
}

async function fetchDifficulties() {
  const grouped = await prisma.exercise.groupBy({
    by: ['difficulty'],
    where: { isPublic: true, difficulty: { not: null } },
    _count: { difficulty: true },
    orderBy: { _count: { difficulty: 'desc' } },
  });
  const order = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert'];
  return grouped
    .filter((r) => r.difficulty)
    .map((r) => ({ difficulty: r.difficulty, count: r._count.difficulty }))
    .sort((a, b) => {
      const ai = order.indexOf(a.difficulty);
      const bi = order.indexOf(b.difficulty);
      if (ai === -1 && bi === -1) return a.difficulty.localeCompare(b.difficulty);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
}

async function fetchBrowseMuscleCounts() {
  const grouped = await prisma.exercise.groupBy({
    by: ['browseMuscleZone'],
    where: { isPublic: true, browseMuscleZone: { not: null } },
    _count: { browseMuscleZone: true },
  });
  const counts = Object.fromEntries(EXERCISE_MUSCLE_BROWSE_ZONES.map((z) => [z, 0]));
  for (const row of grouped) {
    if (row.browseMuscleZone && counts[row.browseMuscleZone] != null) {
      counts[row.browseMuscleZone] = row._count.browseMuscleZone;
    }
  }
  return counts;
}

async function fetchWikiMuscleCounts() {
  const zones = Object.keys(MUSCLE_ZONE_TO_LABELS);
  const counts = {};
  for (const zone of zones) {
    const labels = muscleLabelsForZone(zone);
    if (!labels?.length) {
      counts[zone] = 0;
      continue;
    }
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM exercises
      WHERE is_public = true
      AND ${muscleOverlapSql(labels)}
    `;
    counts[zone] = Number(rows[0]?.count ?? 0);
  }
  return counts;
}

function getCategories() {
  return getOrFetch('categories:v1', fetchCategories);
}

function getCategoryGroups() {
  return getOrFetch('category-groups:v1', fetchCategoryGroups);
}

function getGoalCounts() {
  return getOrFetch('goal-counts:v1', fetchGoalCounts);
}

function getDifficulties() {
  return getOrFetch('difficulties:v1', fetchDifficulties);
}

function getMuscleCounts(set = 'browse') {
  const key = set === 'wiki' ? 'muscle-counts:wiki:v1' : 'muscle-counts:browse:v1';
  const factory = set === 'wiki' ? fetchWikiMuscleCounts : fetchBrowseMuscleCounts;
  return getOrFetch(key, factory);
}

module.exports = {
  getCategories,
  getCategoryGroups,
  getGoalCounts,
  getDifficulties,
  getMuscleCounts,
};
