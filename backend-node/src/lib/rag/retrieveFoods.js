/**
 * RAG-lite food retrieval.
 *
 * Queries Postgres (`food_items` + `webteb_foods`) for foods that are safe
 * and relevant given the user's onboarding answers. No vector search yet —
 * just SQL filters + simple ranking. Phase 8 adds embedding-based reranking.
 *
 * Used by:
 *   - `lib/plans/prompt.js` (Phase 5) to give the LLM a closed food list.
 *   - `lib/coachFoodContext.js` to inject relevant DB foods into chat.
 *
 * Returns up to `limit` plain objects, each with the fields needed by the
 * prompt + validator: `{ source, id, webtebId?, name, calories, protein,
 * carbs, fat, category }`.
 */
const { prisma } = require('../../db');
const { buildExclusionMatchers, BUDGET_CHEAP_VALUES } = require('../plans/constraints');

const HIGH_PROTEIN_CATEGORIES = new Set([
  'poultry',
  'chicken',
  'beef',
  'lamb',
  'meat',
  'fish',
  'seafood',
  'egg',
  'eggs',
  'dairy',
  'legume',
  'legumes',
  'protein',
  'protein_supplement',
]);

const LOW_CARB_CATEGORIES = new Set([
  'poultry',
  'beef',
  'fish',
  'seafood',
  'egg',
  'dairy',
  'vegetable',
  'vegetables',
  'oil',
]);

function isFiniteNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function normaliseRow(row, source) {
  return {
    source,
    id: row.id,
    webtebId: row.webtebId ?? null,
    name: row.name || row.nameEn || row.nameAr || '',
    nameAr: row.nameAr || null,
    category: row.category || row.categorySlug || '',
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    carbs: Number(row.carbs) || 0,
    fat: Number(row.fat) || 0,
  };
}

function dedupeByName(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const key = r.webtebId ? `w${r.webtebId}` : r.name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function pickSortComparator(onboardingData) {
  const dietType = String(onboardingData?.dietType || '').toLowerCase();
  if (dietType.includes('high') || dietType.includes('protein')) {
    return (a, b) => b.protein - a.protein;
  }
  if (dietType.includes('low') && dietType.includes('carb')) {
    return (a, b) => a.carbs - b.carbs;
  }
  // Default: highest protein-to-calorie ratio first (lean food density)
  return (a, b) => {
    const ra = a.calories ? a.protein / a.calories : 0;
    const rb = b.calories ? b.protein / b.calories : 0;
    return rb - ra;
  };
}

function dietTypeCategoryFilter(onboardingData) {
  const dietType = String(onboardingData?.dietType || '').toLowerCase();
  if (dietType.includes('high') || dietType.includes('protein')) {
    return (row) => {
      const cat = String(row.category || row.categorySlug || '').toLowerCase();
      if (HIGH_PROTEIN_CATEGORIES.has(cat)) return true;
      return Number(row.protein) >= 10;
    };
  }
  if (dietType.includes('low') && dietType.includes('carb')) {
    return (row) => {
      const cat = String(row.category || row.categorySlug || '').toLowerCase();
      if (LOW_CARB_CATEGORIES.has(cat)) return true;
      return Number(row.carbs) <= 15;
    };
  }
  return () => true;
}

/**
 * @param {object} args
 * @param {object} [args.onboardingData]
 * @param {object} [args.targets]
 * @param {string} [args.mealSlot]   'breakfast' | 'lunch' | 'dinner' | 'snack'
 * @param {number} [args.limit=30]
 */
async function retrieveFoods({ onboardingData = {}, mealSlot, limit = 30 } = {}) {
  const { foodMatcher, budgetMatcher } = buildExclusionMatchers(onboardingData);
  const isCheap = BUDGET_CHEAP_VALUES.some((b) =>
    String(onboardingData?.foodBudget || '').toLowerCase().includes(b)
  );

  // Pull a generous candidate set; we filter in JS for combined keyword logic.
  const [webteb, items] = await Promise.all([
    prisma.webtebFood.findMany({
      take: 400,
      orderBy: { protein: 'desc' },
      select: {
        id: true,
        webtebId: true,
        nameEn: true,
        nameAr: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        categorySlug: true,
      },
    }),
    prisma.foodItem.findMany({
      where: { isPublic: true },
      take: 200,
      orderBy: { protein: 'desc' },
      select: {
        id: true,
        webtebId: true,
        name: true,
        category: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
      },
    }),
  ]);

  const candidates = [
    ...webteb.map((r) =>
      normaliseRow(
        {
          id: r.id,
          webtebId: r.webtebId,
          name: r.nameEn || r.nameAr,
          nameAr: r.nameAr,
          category: r.categorySlug,
          calories: r.calories,
          protein: r.protein,
          carbs: r.carbs,
          fat: r.fat,
        },
        'webteb'
      )
    ),
    ...items.map((r) => normaliseRow(r, 'foodItem')),
  ];

  const dietFilter = dietTypeCategoryFilter(onboardingData);

  const filtered = candidates.filter((f) => {
    if (!f.name) return false;
    if (!isFiniteNum(f.protein) || f.protein < 0) return false;
    if (foodMatcher(f.name) || foodMatcher(f.nameAr || '')) return false;
    if (isCheap && budgetMatcher && (budgetMatcher(f.name) || budgetMatcher(f.nameAr || ''))) {
      return false;
    }
    return dietFilter(f);
  });

  let ranked = dedupeByName(filtered).sort(pickSortComparator(onboardingData));

  // Mild slot bias — boost obvious matches without filtering out the rest.
  if (mealSlot === 'breakfast') {
    ranked = [
      ...ranked.filter((f) => /oat|egg|yogurt|fruit|bread|smoothie|cereal|بيض|شوفان|زبادي/i.test(f.name)),
      ...ranked.filter(
        (f) => !/oat|egg|yogurt|fruit|bread|smoothie|cereal|بيض|شوفان|زبادي/i.test(f.name)
      ),
    ];
  } else if (mealSlot === 'snack') {
    ranked = [
      ...ranked.filter((f) => f.calories > 0 && f.calories < 300),
      ...ranked.filter((f) => !(f.calories > 0 && f.calories < 300)),
    ];
  }

  return ranked.slice(0, limit);
}

function formatFoodLineForPrompt(f) {
  const idHint = f.source === 'foodItem' ? `foodItemId:${f.id}` : `webtebId:${f.webtebId}`;
  return `- ${f.name} | ${idHint} | ${Math.round(f.calories)} kcal/100g | P${Math.round(
    f.protein
  )}g C${Math.round(f.carbs)}g F${Math.round(f.fat)}g`;
}

module.exports = {
  retrieveFoods,
  formatFoodLineForPrompt,
};
