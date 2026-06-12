/**

 * Food catalog SQL pool + constraint filters (shared by ragRetrieve catalog mode).

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



function normaliseFoodRow(row, source) {

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



function filterFoodCandidates(candidates, onboardingData = {}) {

  const { foodMatcher, budgetMatcher } = buildExclusionMatchers(onboardingData);

  const isCheap = BUDGET_CHEAP_VALUES.some((b) =>

    String(onboardingData?.foodBudget || '').toLowerCase().includes(b)

  );

  const dietFilter = dietTypeCategoryFilter(onboardingData);



  return candidates.filter((f) => {

    if (!f.name) return false;

    if (!isFiniteNum(f.protein) || f.protein < 0) return false;

    if (foodMatcher(f.name) || foodMatcher(f.nameAr || '')) return false;

    if (isCheap && budgetMatcher && (budgetMatcher(f.name) || budgetMatcher(f.nameAr || ''))) {

      return false;

    }

    return dietFilter(f);

  });

}



function applyFoodRanking(rows, { onboardingData = {}, mealSlot, limit = 30 } = {}) {

  let ranked = dedupeByName(rows).sort(pickSortComparator(onboardingData));



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



async function retrieveFoodsSql({ onboardingData = {}, mealSlot, limit = 30 } = {}) {

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

      normaliseFoodRow(

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

    ...items.map((r) => normaliseFoodRow(r, 'foodItem')),

  ];



  const filtered = filterFoodCandidates(candidates, onboardingData);

  return applyFoodRanking(filtered, { onboardingData, mealSlot, limit });

}



module.exports = {

  retrieveFoodsSql,

  filterFoodCandidates,

  applyFoodRanking,

  normaliseFoodRow,

};

