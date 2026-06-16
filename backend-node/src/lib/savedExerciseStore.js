const { randomUUID } = require('crypto');
const { prisma } = require('../db');
const { searchExercises, MIN_QUERY_LEN, buildFilterSql } = require('./exerciseSearchCore');

function reorderByIds(rows, ids) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

async function getFavoriteExerciseIds(userId) {
  const rows = await prisma.$queryRaw`
    SELECT exercise_id AS "exerciseId"
    FROM saved_exercises
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map((row) => row.exerciseId);
}

async function saveFavorite(userId, exerciseId) {
  await prisma.$executeRaw`
    INSERT INTO saved_exercises (id, user_id, exercise_id, created_at)
    VALUES (${randomUUID()}, ${userId}, ${exerciseId}, NOW())
    ON CONFLICT (user_id, exercise_id) DO NOTHING
  `;
}

async function removeFavorite(userId, exerciseId) {
  await prisma.$executeRaw`
    DELETE FROM saved_exercises
    WHERE user_id = ${userId} AND exercise_id = ${exerciseId}
  `;
}

async function listSavedExercises(userId, { searchFilters = {}, searchTerm, offset, pageSize }) {
  const term = String(searchTerm || '').trim();

  if (term.length >= MIN_QUERY_LEN) {
    const searched = await searchExercises(prisma, {
      query: term,
      filters: { ...searchFilters, savedUserId: userId },
      pageSize,
      offset,
    });
    if (searched) return searched;
  }

  const filterSql = buildFilterSql(searchFilters);
  const rows = await prisma.$queryRaw`
    SELECT e.*
    FROM saved_exercises se
    INNER JOIN exercises e ON e.id = se.exercise_id
    WHERE se.user_id = ${userId} AND ${filterSql}
    ORDER BY se.created_at DESC
    LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}
  `;
  const countRows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM saved_exercises se
    INNER JOIN exercises e ON e.id = se.exercise_id
    WHERE se.user_id = ${userId} AND ${filterSql}
  `;

  return { rows, total: Number(countRows[0]?.count ?? 0) };
}

module.exports = {
  getFavoriteExerciseIds,
  saveFavorite,
  removeFavorite,
  listSavedExercises,
  reorderByIds,
};
