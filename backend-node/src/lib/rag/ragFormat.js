/**
 * Prompt formatting helpers for RAG catalog items (plan generation).
 */

function formatFoodLineForPrompt(f) {
  const idHint = f.source === 'foodItem' ? `foodItemId:${f.id}` : `webtebId:${f.webtebId}`;
  return `- ${f.name} | ${idHint} | ${Math.round(f.calories)} kcal/100g | P${Math.round(
    f.protein
  )}g C${Math.round(f.carbs)}g F${Math.round(f.fat)}g`;
}

function formatExerciseLineForPrompt(ex) {
  const muscles = (ex.primaryMuscles || []).slice(0, 2).join('/');
  return `- ${ex.name} | exerciseId:${ex.id} | ${ex.category || 'general'}${
    muscles ? ` | ${muscles}` : ''
  }`;
}

function formatBookChunkForPrompt(c) {
  return `[${c.topic}] ${c.text}`;
}

module.exports = {
  formatFoodLineForPrompt,
  formatExerciseLineForPrompt,
  formatBookChunkForPrompt,
};
