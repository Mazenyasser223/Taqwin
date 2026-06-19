/**
 * Deterministic ordering for plan RAG catalogs — same inputs → same prompt order.
 */

function foodSortKey(food) {
  if (food?.id) return `food:${String(food.id)}`;
  if (food?.foodItemId) return `food:${String(food.foodItemId)}`;
  if (food?.webtebId != null) return `webteb:${String(food.webtebId)}`;
  return `name:${String(food?.name || '').toLowerCase()}`;
}

function exerciseSortKey(exercise) {
  const id = exercise?.id || exercise?.exerciseId;
  if (id) return `exercise:${String(id)}`;
  return `name:${String(exercise?.name || '').toLowerCase()}`;
}

function bookSortKey(chunk) {
  const topic = String(chunk?.topic || chunk?.title || '').toLowerCase();
  const text = String(chunk?.text || chunk?.content || '').slice(0, 80).toLowerCase();
  return `${topic}:${text}`;
}

function stableSortByKey(items, keyFn) {
  return [...(items || [])].sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
  });
}

function stableSortPlanFoods(foods) {
  return stableSortByKey(foods, foodSortKey);
}

function stableSortPlanExercises(exercises) {
  return stableSortByKey(exercises, exerciseSortKey);
}

function stableSortPlanBooks(bookChunks) {
  return stableSortByKey(bookChunks, bookSortKey);
}

module.exports = {
  stableSortPlanFoods,
  stableSortPlanExercises,
  stableSortPlanBooks,
  foodSortKey,
  exerciseSortKey,
};
