/**
 * Merge user prefs + staple groups + RAG foods for plan generation prompt.
 */
const { loadGroupConfig } = require('./planStapleFoods');

function foodDedupeKey(item) {
  if (item.webtebId != null) return `w:${item.webtebId}`;
  if (item.id) return `fi:${item.id}`;
  return `n:${String(item.name || '').toLowerCase().trim()}`;
}

function inferPlanGroupFromCategory(item) {
  if (item.planGroup) return item.planGroup;
  const cat = String(item.category || '').toLowerCase();
  const config = loadGroupConfig();
  for (const [groupKey, def] of Object.entries(config.groups)) {
    for (const cid of def.categoryIds || []) {
      if (cat.includes(cid) || cid.includes(cat)) return groupKey;
    }
  }
  const name = `${item.name || ''} ${item.nameAr || ''}`.toLowerCase();
  if (/egg|بيض/.test(name)) return 'eggs';
  if (/milk|cheese|yogurt|حليب|جبن|زبادي/.test(name)) return 'dairy';
  if (/almond|walnut|peanut|nut|seed|لوز|جوز|فول سوداني|بذر/.test(name)) return 'nuts';
  if (/oil|زيت|butter|زبدة/.test(name)) return 'fats';
  if (/rice|bread|oat|pasta|أرز|خبز|شوفان|مكرونة/.test(name)) return 'carbs';
  if (/apple|banana|fruit|تفاح|موز|فاكهة/.test(name)) return 'fruits';
  if (/tomato|lettuce|vegetable|خس|طماطم|خضار/.test(name)) return 'vegetables';
  return 'other';
}

/**
 * @param {object[]} layers - arrays in priority order (first wins dedupe)
 * @returns {object[]}
 */
function mergePlanFoodCatalog(...layers) {
  const seen = new Set();
  const out = [];
  for (const layer of layers) {
    for (const raw of layer || []) {
      const item = { ...raw, planGroup: inferPlanGroupFromCategory(raw) };
      const key = foodDedupeKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

module.exports = {
  mergePlanFoodCatalog,
  inferPlanGroupFromCategory,
  foodDedupeKey,
};
