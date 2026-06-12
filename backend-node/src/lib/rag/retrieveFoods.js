/**
 * @deprecated Prefer ragRetrieve({ purpose: 'plan_catalog', kind: 'food' }).
 * Re-exports catalog SQL helpers + prompt formatting for backward compatibility.
 */
const { ragRetrieve, formatFoodLineForPrompt } = require('./ragRetrieve');
const {
  retrieveFoodsSql,
  filterFoodCandidates,
  applyFoodRanking,
  normaliseFoodRow,
} = require('./catalogFood');

async function retrieveFoods({ onboardingData = {}, message, mealSlot, limit = 30, profile, traceId } = {}) {
  const { items } = await ragRetrieve({
    purpose: 'plan_catalog',
    kind: 'food',
    query: message,
    onboardingData,
    profile,
    mealSlot,
    limit,
    traceId,
  });
  return items;
}

module.exports = {
  retrieveFoods,
  retrieveFoodsSql,
  filterFoodCandidates,
  applyFoodRanking,
  normaliseFoodRow,
  formatFoodLineForPrompt,
};
