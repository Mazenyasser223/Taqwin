/**
 * Order revenue attribution — normalized commerce sources.
 */
const ORDER_SOURCES = Object.freeze({
  AI_BUNDLE: 'ai_bundle',
  AI_RECOMMENDATION: 'ai_recommendation',
  SEARCH: 'search',
  CATEGORY: 'category',
  FEATURED: 'featured',
  DIRECT: 'direct',
});

const VALID_SOURCES = new Set(Object.values(ORDER_SOURCES));

/** Higher wins when resolving mixed cart attribution at checkout. */
const SOURCE_PRIORITY = {
  [ORDER_SOURCES.AI_BUNDLE]: 100,
  [ORDER_SOURCES.AI_RECOMMENDATION]: 90,
  [ORDER_SOURCES.FEATURED]: 50,
  [ORDER_SOURCES.SEARCH]: 40,
  [ORDER_SOURCES.CATEGORY]: 30,
  [ORDER_SOURCES.DIRECT]: 10,
};

function normalizeCommerceSource(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!s) return null;
  if (VALID_SOURCES.has(s)) return s;
  // Legacy aliases
  if (s === 'dashboard_diet' || s === 'coach_chat' || s === 'diet_plan' || s === 'marketplace') {
    return ORDER_SOURCES.AI_RECOMMENDATION;
  }
  if (s === 'ai_recommendation' || s === 'ai_recommendations') {
    return ORDER_SOURCES.AI_RECOMMENDATION;
  }
  return null;
}

function resolveCheckoutSource(primary, fallback) {
  const a = normalizeCommerceSource(primary);
  const b = normalizeCommerceSource(fallback);
  if (!a) return b;
  if (!b) return a;
  return (SOURCE_PRIORITY[a] || 0) >= (SOURCE_PRIORITY[b] || 0) ? a : b;
}

function isAiSource(source) {
  const s = normalizeCommerceSource(source);
  return s === ORDER_SOURCES.AI_BUNDLE || s === ORDER_SOURCES.AI_RECOMMENDATION;
}

module.exports = {
  ORDER_SOURCES,
  VALID_SOURCES,
  SOURCE_PRIORITY,
  normalizeCommerceSource,
  resolveCheckoutSource,
  isAiSource,
};
