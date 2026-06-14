/**
 * Nutrition questionnaire → RAG filters, validation, prompts, meal tools.
 * Rule: Allergy > Preference (lactose allergy blocks dairy even if user likes dairy).
 */

const {
  buildAllergyFilters,
  buildExclusionMatchers,
} = require('./constraints');

const ANIMAL_PROTEIN_CATS = new Set([
  'poultry',
  'chicken',
  'beef',
  'lamb',
  'lamb-veal',
  'seafood',
  'fish',
  'processed-meats',
  'meat',
]);

const PLANT_PROTEIN_CATS = new Set(['legumes', 'legume', 'nuts-seeds', 'nuts', 'soy']);

const BUDGET_BOOST_TERMS = [
  'egg',
  'eggs',
  'bean',
  'beans',
  'lentil',
  'lentils',
  'chickpea',
  'rice',
  'chicken',
  'tuna',
  'oat',
  'oats',
  'potato',
  'potatoes',
  'بيض',
  'عدس',
  'فاصوليا',
  'أرز',
  'دجاج',
  'تونة',
  'شوفان',
  'بطاط',
];

const SIMPLE_PREP_TERMS = [
  'sandwich',
  'yogurt',
  'yoghurt',
  'canned',
  'tuna',
  'egg',
  'bowl',
  'wrap',
  'toast',
  'سلطة',
  'زبادي',
  'بيض',
  'تونة',
  'ساندwich',
];

function arr(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function asLowerArray(v) {
  return arr(v).map((x) => x.toLowerCase());
}

function hasAllergy(od, code) {
  return asLowerArray(od.foodAllergies).filter((a) => a !== 'none').includes(code);
}

function isVegetarianStyle(od) {
  const diet = String(od.dietType || '').toLowerCase();
  const rel = asLowerArray(od.religiousDiet);
  return diet === 'vegetarian' || diet === 'vegan_strict' || rel.includes('vegan_strict');
}

function isVeganStrict(od) {
  const rel = asLowerArray(od.religiousDiet);
  return rel.includes('vegan_strict');
}

function religiousFlags(od) {
  const rel = asLowerArray(od.religiousDiet);
  return {
    halal: rel.includes('halal'),
    ramadan: rel.includes('ramadan'),
    christianFasting: rel.includes('christian_fasting'),
    veganStrict: rel.includes('vegan_strict'),
  };
}

function parseMealsCount(raw) {
  const m = String(raw ?? '').match(/(\d+)/);
  const n = m ? Number(m[1]) : 4;
  return Math.min(5, Math.max(2, n));
}

function parseSnacksCount(raw) {
  if (raw === undefined || raw === null || raw === '') return 0;
  const m = String(raw).match(/(\d+)/);
  const n = m ? Number(m[1]) : 0;
  return Math.min(4, Math.max(0, n));
}

/**
 * Unified nutrition constraint view for RAG / tools / prompts.
 */
function resolveNutritionConstraints(onboardingData = {}) {
  const od = onboardingData && typeof onboardingData === 'object' ? onboardingData : {};
  return {
    allergyFilters: buildAllergyFilters(od),
    exclusion: buildExclusionMatchers(od),
    isVegetarian: isVegetarianStyle(od),
    isVeganStrict: isVeganStrict(od),
    religious: religiousFlags(od),
    lactoseAllergy: hasAllergy(od, 'lactose'),
    mealPlanStyle: String(od.mealPlanStyle || ''),
    foodBudget: String(od.foodBudget || '').toLowerCase(),
    mealPrepTime: String(od.mealPrepTime || ''),
    cookOrReady: String(od.cookOrReady || ''),
    preferSimpleMeals: String(od.preferSimpleMeals || ''),
    mealsPerDay: parseMealsCount(od.mealsPerDay),
    snacksPerDay: parseSnacksCount(od.snacksPerDay),
  };
}

/**
 * Meal calorie distribution hints for plan builders.
 */
function getMealDistributionHints(onboardingData = {}) {
  const meals = parseMealsCount(onboardingData.mealsPerDay);
  const snacks = parseSnacksCount(onboardingData.snacksPerDay);
  const totalSlots = meals + snacks;
  const warnings = [];

  let minCaloriesPerMainMeal = null;
  let suggestFewerSlots = false;

  if (meals === 2 && snacks === 0) {
    minCaloriesPerMainMeal = 550;
    warnings.push('2 meals + 0 snacks: distribute ~45–55% calories per main meal');
  } else if (totalSlots >= 7) {
    suggestFewerSlots = true;
    warnings.push(`${meals} meals + ${snacks} snacks may be overcomplicated — simplify slots if adherence drops`);
  }

  return { meals, snacks, totalSlots, minCaloriesPerMainMeal, suggestFewerSlots, warnings };
}

/**
 * Coach / plan prompt lines from onboarding nutrition answers.
 */
function buildNutritionAdaptationNotes(onboardingData = {}) {
  const od = onboardingData && typeof onboardingData === 'object' ? onboardingData : {};
  const notes = [];
  const filters = buildAllergyFilters(od);

  if (filters.active) {
    notes.push(
      `Allergy filters ACTIVE [${filters.codes.join(', ')}]: Allergy > Preference — never include allergens even if preferred`
    );
    if (hasAllergy(od, 'lactose')) {
      notes.push(
        'Lactose allergy: dairyPrefs = lactose-free dairy ONLY; block milk/soft cheese/yogurt with lactose'
      );
    }
  }

  if (isVegetarianStyle(od)) {
    notes.push(
      'Vegetarian/vegan: hide animal protein categories; prioritize legumes, nuts, soy, plant proteins'
    );
  }

  const mps = String(od.mealPlanStyle || '');
  if (mps === 'fixed_weekly') {
    notes.push('Meal plan style: fixed_weekly — simple repeating weekly template, same core meals');
  } else if (mps === 'rotating_daily') {
    notes.push(
      'Meal plan style: rotating_daily — vary meals daily; allow higher complexity/cost vs fixed weekly'
    );
  }

  const dist = getMealDistributionHints(od);
  dist.warnings.forEach((w) => notes.push(`Meals/snacks: ${w}`));

  const budget = String(od.foodBudget || '').toLowerCase();
  if (budget === 'low') {
    notes.push(
      'Low food budget: boost eggs, beans, lentils, rice, chicken, tuna, oats, potatoes; limit salmon, excess nuts, premium cuts'
    );
  }

  const prep = String(od.mealPrepTime || '');
  if (prep === '0_15' || String(od.preferSimpleMeals || '') === 'yes') {
    notes.push(
      'Simple meals: sandwiches, yogurt bowls, canned tuna, eggs, ready components — avoid long recipes'
    );
  } else if (prep === '60_plus') {
    notes.push('Meal prep time 60+ min: batch-cook / meal-prep recipes allowed');
  }

  const cook = String(od.cookOrReady || '').toLowerCase();
  if (cook === 'ready') {
    notes.push(
      'Mostly ready/delivery: restaurant-friendly options, delivery-safe swaps, explicit portion guidance'
    );
  }

  const rel = religiousFlags(od);
  if (rel.ramadan) {
    notes.push(
      'Ramadan: fasting mode — suhoor + iftar meal timing; shift workouts away from peak fast; hydration at night'
    );
  }
  if (rel.christianFasting) {
    notes.push('Christian fasting days: plant-based fasting alternatives; lighter oil/dairy on fast days');
  }

  return notes;
}

function foodMatchesTerms(name, terms) {
  const t = String(name || '').toLowerCase();
  if (!t) return false;
  return terms.some((term) => t.includes(term.toLowerCase()));
}

function categoryMatches(row, catSet) {
  const cat = String(row.category || row.categorySlug || '').toLowerCase();
  for (const c of catSet) {
    if (cat.includes(c)) return true;
  }
  return false;
}

/**
 * Extra diet-type filter (vegetarian hides animal proteins).
 */
function dietTypeRowFilter(onboardingData = {}) {
  if (!isVegetarianStyle(onboardingData)) return () => true;
  return (row) => {
    if (categoryMatches(row, ANIMAL_PROTEIN_CATS)) return false;
    const name = String(row.name || row.nameEn || '').toLowerCase();
    const animalTerms = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'ham', 'steak', 'salmon', 'tuna', 'shrimp'];
    return !animalTerms.some((term) => name.includes(term));
  };
}

/**
 * Score boost for RAG food ranking (after safety filters).
 */
function nutritionFoodScoreBoost(row, onboardingData = {}) {
  let score = 0;
  const name = row.name || '';
  const budget = String(onboardingData.foodBudget || '').toLowerCase();
  const prep = String(onboardingData.mealPrepTime || '');
  const preferSimple = String(onboardingData.preferSimpleMeals || '') === 'yes';

  if (budget === 'low' && foodMatchesTerms(name, BUDGET_BOOST_TERMS)) score += 3;
  if ((prep === '0_15' || preferSimple) && foodMatchesTerms(name, SIMPLE_PREP_TERMS)) score += 2;
  if (isVegetarianStyle(onboardingData)) {
    if (categoryMatches(row, PLANT_PROTEIN_CATS)) score += 3;
    if (foodMatchesTerms(name, ['tofu', 'tempeh', 'lentil', 'chickpea', 'bean', 'nut'])) score += 2;
  }
  return score;
}

/**
 * Sort foods with nutrition adaptation boosts (stable tie-break on protein).
 */
function rankFoodsWithNutritionAdaptation(rows, onboardingData = {}) {
  return [...rows].sort((a, b) => {
    const sb = nutritionFoodScoreBoost(b, onboardingData) - nutritionFoodScoreBoost(a, onboardingData);
    if (sb !== 0) return sb;
    return (b.protein || 0) - (a.protein || 0);
  });
}

/**
 * Validate a food name against allergy/exclusion/budget rules (meal swap tools).
 */
function validateFoodForUser(foodName, onboardingData = {}, nameAr = '') {
  const { foodMatcher, budgetMatcher } = buildExclusionMatchers(onboardingData);
  const hit = foodMatcher(foodName) || foodMatcher(nameAr);
  if (hit) {
    return { ok: false, reason: `blocked by allergy/exclusion keyword "${hit}" (Allergy > Preference)` };
  }
  if (budgetMatcher && (budgetMatcher(foodName) || budgetMatcher(nameAr))) {
    return { ok: false, reason: 'not budget-friendly for low food budget' };
  }
  const vegFilter = dietTypeRowFilter(onboardingData);
  if (!vegFilter({ name: foodName, nameEn: foodName, nameAr })) {
    return { ok: false, reason: 'animal protein not allowed for vegetarian/vegan diet' };
  }
  return { ok: true };
}

module.exports = {
  ANIMAL_PROTEIN_CATS,
  PLANT_PROTEIN_CATS,
  BUDGET_BOOST_TERMS,
  SIMPLE_PREP_TERMS,
  resolveNutritionConstraints,
  buildNutritionAdaptationNotes,
  getMealDistributionHints,
  buildAllergyFilters,
  dietTypeRowFilter,
  nutritionFoodScoreBoost,
  rankFoodsWithNutritionAdaptation,
  validateFoodForUser,
  isVegetarianStyle,
  hasAllergy,
};
