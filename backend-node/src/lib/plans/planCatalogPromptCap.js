/**
 * Trim merged food/exercise catalogs before sending to FastAPI / Claude.
 * Full catalogs are still used for bind/validation after generation.
 */

function readIntEnv(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function trimFoodsForPrompt(foods, opts = {}) {
  const list = Array.isArray(foods) ? foods : [];
  const maxTotal = opts.maxTotal ?? readIntEnv('PLAN_PROMPT_MAX_FOODS', 80);
  const maxPerGroup = opts.maxPerGroup ?? readIntEnv('PLAN_PROMPT_MAX_FOODS_PER_GROUP', 8);
  const groupCounts = {};
  const out = [];

  for (const item of list) {
    const group = item.planGroup || 'other';
    groupCounts[group] = groupCounts[group] || 0;
    if (groupCounts[group] >= maxPerGroup) continue;
    groupCounts[group] += 1;
    out.push(item);
    if (out.length >= maxTotal) break;
  }
  return out;
}

function exerciseCellKey(item) {
  const muscle = item.muscleGroup || 'other';
  const difficulty = item.planDifficulty || item.difficulty || 'intermediate';
  return `${muscle}:${difficulty}`;
}

function trimExercisesForPrompt(exercises, opts = {}) {
  const list = Array.isArray(exercises) ? exercises : [];
  const maxTotal = opts.maxTotal ?? readIntEnv('PLAN_PROMPT_MAX_EXERCISES', 120);
  const maxPerCell = opts.maxPerCell ?? readIntEnv('PLAN_PROMPT_MAX_EXERCISES_PER_CELL', 6);
  const cellCounts = {};
  const out = [];

  for (const item of list) {
    const key = exerciseCellKey(item);
    cellCounts[key] = cellCounts[key] || 0;
    if (cellCounts[key] >= maxPerCell) continue;
    cellCounts[key] += 1;
    out.push(item);
    if (out.length >= maxTotal) break;
  }
  return out;
}

function trimPlanCatalogForPrompt({ foods, exercises } = {}) {
  return {
    foods: trimFoodsForPrompt(foods),
    exercises: trimExercisesForPrompt(exercises),
  };
}

module.exports = {
  trimFoodsForPrompt,
  trimExercisesForPrompt,
  trimPlanCatalogForPrompt,
  exerciseCellKey,
};
