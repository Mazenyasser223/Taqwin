/**
 * Meal capture catalog matching — only link to WebTeb when match + confidence are strong.
 */
const { itemConfWorst, itemConfNumeric } = require('./mealCaptureEnrich');

const CATALOG_MATCH_SCORE_MIN = 0.82;
const ITEM_AI_CONFIDENCE_MIN = 0.75;

function itemAiConfidenceScore(item) {
  if (typeof item?.confidence_score === 'number' && Number.isFinite(item.confidence_score)) {
    return item.confidence_score;
  }
  return itemConfNumeric(item?.confidence);
}

function shouldUseCatalogMatch(item, matchScore) {
  if (!matchScore || !Number.isFinite(matchScore) || matchScore < CATALOG_MATCH_SCORE_MIN) {
    return false;
  }
  if (itemConfWorst(item?.confidence) === 'low') return false;
  if (itemAiConfidenceScore(item) < ITEM_AI_CONFIDENCE_MIN) return false;
  return true;
}

function markKitchenFoodItem(item) {
  return {
    ...item,
    webtebId: null,
    dbMatched: false,
    kitchenFood: true,
  };
}

module.exports = {
  CATALOG_MATCH_SCORE_MIN,
  ITEM_AI_CONFIDENCE_MIN,
  itemAiConfidenceScore,
  shouldUseCatalogMatch,
  markKitchenFoodItem,
};
