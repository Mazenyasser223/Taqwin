/**
 * Diet-to-Commerce — map meal plan food names to shop products.
 */
const { prisma } = require('../../db');
const { fetchActivePlanFromPostgres } = require('../plans/persistPostgres');
const { normalizeProduct } = require('../shopProduct');
const { rankProducts } = require('./productRanking');
const { PRODUCT_SELECT } = require('./frequentlyBoughtTogether');
const { buildReasonCopy } = require('./commerceReasons');

/** Keyword → category slug or search term */
const FOOD_KEYWORD_RULES = [
  { pattern: /\b(whey|protein powder|isolate|casein)\b/i, categorySlug: 'whey-protein', slot: 'protein' },
  { pattern: /\b(creatine)\b/i, categorySlug: 'creatine', slot: 'creatine' },
  { pattern: /\b(protein bar|bar)\b/i, categorySlug: 'protein-bars', search: 'protein bar', slot: 'diet_plan' },
  { pattern: /\b(oats?|oatmeal)\b/i, search: 'oats', slot: 'diet_plan' },
  { pattern: /\b(greek yogurt|yogurt|yoghurt)\b/i, search: 'yogurt', slot: 'diet_plan' },
  { pattern: /\b(egg|eggs)\b/i, search: 'egg', slot: 'diet_plan' },
  { pattern: /\b(almond|nuts|peanut)\b/i, search: 'nuts', slot: 'diet_plan' },
  { pattern: /\b(shaker|shake)\b/i, categorySlug: 'shakers', slot: 'shaker' },
];

async function getCategoryDescendantIds(rootId) {
  const all = await prisma.shopCategory.findMany({ select: { id: true, parentId: true } });
  const ids = [rootId];
  const queue = [rootId];
  while (queue.length) {
    const pid = queue.shift();
    for (const c of all.filter((x) => x.parentId === pid)) {
      ids.push(c.id);
      queue.push(c.id);
    }
  }
  return ids;
}

async function searchProductsForRule(rule, excludeIds) {
  const where = {
    isActive: true,
    stock: { gt: 0 },
    ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
  };

  if (rule.categorySlug) {
    const cat = await prisma.shopCategory.findFirst({ where: { slug: rule.categorySlug } });
    if (!cat) return [];
    const categoryIds = await getCategoryDescendantIds(cat.id);
    where.categoryId = { in: categoryIds };
  } else if (rule.search) {
    where.OR = [
      { name: { contains: rule.search, mode: 'insensitive' } },
      { brand: { contains: rule.search, mode: 'insensitive' } },
    ];
  } else {
    return [];
  }

  return prisma.product.findMany({
    where,
    take: 8,
    select: PRODUCT_SELECT,
  });
}

function collectMealNamesFromPlan(plan, dayIndex) {
  const names = new Set();
  const dietDays = plan?.dietDays || [];
  const days = dayIndex != null ? dietDays.filter((d) => d.dayIndex === dayIndex) : dietDays;
  for (const day of days.length ? days : dietDays) {
    for (const meal of day.meals || []) {
      for (const item of meal.items || []) {
        if (item.name) names.add(String(item.name).trim());
        if (item.notes) names.add(String(item.notes).trim());
      }
      if (meal.name) names.add(String(meal.name).trim());
    }
  }
  return [...names];
}

function rulesForMealText(text) {
  const matched = [];
  for (const rule of FOOD_KEYWORD_RULES) {
    if (rule.pattern.test(text)) matched.push(rule);
  }
  return matched;
}

/**
 * @param {string} userId
 * @param {{ locale?: 'en'|'ar', dayIndex?: number }} [opts]
 */
async function getDietPlanShopProducts(userId, opts = {}) {
  const locale = opts.locale === 'en' ? 'en' : 'ar';
  const plan = await fetchActivePlanFromPostgres(userId);
  if (!plan?.dietDays?.length) {
    return { products: [], mealNames: [], empty: true, locale };
  }

  const mealNames = collectMealNamesFromPlan(plan, opts.dayIndex);
  const rulesSeen = new Set();
  const rules = [];
  for (const name of mealNames) {
    for (const rule of rulesForMealText(name)) {
      const key = rule.categorySlug || rule.search || rule.slot;
      if (rulesSeen.has(key)) continue;
      rulesSeen.add(key);
      rules.push(rule);
    }
  }

  const picked = [];
  const usedIds = [];

  for (const rule of rules) {
    const candidates = await searchProductsForRule(rule, usedIds);
    const ranked = rankProducts(candidates, { slot: rule.slot, goalKey: 'muscle' });
    const top = ranked[0]?.product;
    if (!top) continue;
    usedIds.push(top.id);
    const reasonEn = buildReasonCopy('diet_plan', {}, 'en');
    const reasonAr = buildReasonCopy('diet_plan', {}, 'ar');
    picked.push({
      slot: rule.slot,
      reasonKey: 'diet_plan',
      reasonEn,
      reasonAr,
      reason: locale === 'en' ? reasonEn : reasonAr,
      matchedMeal: mealNames.find((n) => rule.pattern.test(n)) || null,
      product: normalizeProduct(top),
    });
  }

  const subtotal = picked.reduce((s, r) => s + Number(r.product.price || 0), 0);

  return {
    locale,
    mealNames,
    products: picked,
    subtotal: Math.round(subtotal * 100) / 100,
    currency: picked[0]?.product.currency || 'EGP',
    empty: picked.length === 0,
  };
}

module.exports = { getDietPlanShopProducts, FOOD_KEYWORD_RULES };
