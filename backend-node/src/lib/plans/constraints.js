/**
 * Hard safety guardrails for AI-generated plans.
 *
 * These are intentionally hardcoded (not in the DB) because:
 *   1. They are stable medical / dietary rules that should not be editable
 *      by content authors.
 *   2. They protect the user from LLM hallucination ("you can do squats
 *      with a torn ACL because…").
 *
 * Used by `lib/plans/validator.js` and the prompt builder.
 */

const ALLERGY_KEYWORDS = {
  nuts: [
    'almond',
    'cashew',
    'peanut',
    'walnut',
    'pecan',
    'pistachio',
    'hazelnut',
    'macadamia',
    'brazil nut',
    'tree nut',
    'mixed nut',
    'nut butter',
    'nuts',
    'لوز',
    'كاجو',
    'فول سوداني',
    'جوز',
    'فستق',
    'بندق',
    'مكسرات',
  ],
  gluten: [
    'wheat',
    'bread',
    'pasta',
    'cereal',
    'barley',
    'rye',
    'gluten',
    'crouton',
    'pita',
    'naan',
    'tortilla',
    'couscous',
    'bulgur',
    'flour',
    'قمح',
    'خبز',
    'معكرونة',
    'شعير',
    'برغل',
  ],
  lactose: [
    'milk',
    'cheese',
    'yogurt',
    'cream',
    'butter',
    'dairy',
    'lactose',
    'kefir',
    'ice cream',
    'ghee',
    'حليب',
    'لبن',
    'جبن',
    'زبادي',
    'قشدة',
    'زبدة',
  ],
  shellfish: [
    'shrimp',
    'crab',
    'lobster',
    'oyster',
    'mussel',
    'clam',
    'prawn',
    'shellfish',
    'crayfish',
    'جمبري',
    'سرطان البحر',
    'محار',
  ],
  fish: [
    'salmon',
    'tuna',
    'cod',
    'sardine',
    'mackerel',
    'trout',
    'haddock',
    'halibut',
    'anchovy',
    'bass',
    'tilapia',
    'herring',
    'catfish',
    'سمك',
    'سلمون',
    'تونة',
    'بلطي',
    'سردين',
  ],
  eggs: ['egg', 'omelette', 'omelet', 'frittata', 'بيض', 'عجة'],
  soy: [
    'soy',
    'soya',
    'tofu',
    'tempeh',
    'edamame',
    'miso',
    'soy sauce',
    'soybean',
    'soy milk',
    'صويا',
    'توفو',
  ],
  sesame: ['sesame', 'tahini', 'halva', 'سمسم', 'طحينة'],
};

const {
  INJURY_BLOCKED_PATTERNS,
  isExerciseBlockedBySafety,
  buildExerciseSafetyFilters,
} = require('./exerciseSafetyFilters');

const RELIGIOUS_DIET_BLOCKLIST = {
  halal: [
    'pork',
    'bacon',
    'ham',
    'prosciutto',
    'sausage',
    'lard',
    'gelatin',
    'wine',
    'beer',
    'alcohol',
    'rum',
    'vodka',
    'خنزير',
    'لحم خنزير',
    'نبيذ',
    'كحول',
  ],
  kosher: ['pork', 'bacon', 'ham', 'shellfish', 'shrimp', 'crab', 'lobster', 'catfish'],
  vegetarian: [
    'beef',
    'chicken',
    'turkey',
    'pork',
    'lamb',
    'goat',
    'fish',
    'salmon',
    'tuna',
    'shrimp',
    'bacon',
    'ham',
    'prosciutto',
    'sausage',
  ],
  vegan_strict: [
    'beef',
    'chicken',
    'turkey',
    'pork',
    'lamb',
    'goat',
    'fish',
    'salmon',
    'tuna',
    'shrimp',
    'bacon',
    'ham',
    'milk',
    'cheese',
    'yogurt',
    'cream',
    'butter',
    'egg',
    'honey',
    'gelatin',
  ],
};

const BUDGET_EXPENSIVE_TAGS = [
  'salmon',
  'tuna steak',
  'wagyu',
  'prime',
  'filet mignon',
  'ribeye',
  'sirloin',
  'lobster',
  'crab',
  'macadamia',
  'quinoa',
  'avocado',
];

const BUDGET_CHEAP_VALUES = ['cheap', 'low', 'budget', 'tight'];

function asLowerArray(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase()).filter(Boolean);
  if (typeof v === 'string' && v) return [v.toLowerCase()];
  return [];
}

function makeKeywordMatcher(keywords) {
  const lower = Array.from(new Set((keywords || []).map((k) => String(k).toLowerCase()))).filter(Boolean);
  if (!lower.length) return () => null;
  return (text) => {
    if (!text) return null;
    const t = String(text).toLowerCase();
    for (const k of lower) {
      if (t.includes(k)) return k;
    }
    return null;
  };
}

function buildAllergyFilters(onboardingData = {}) {
  const codes = asLowerArray(onboardingData.foodAllergies).filter(
    (a) => a && a !== 'none' && a !== 'other',
  );
  const keywords = [];

  for (const allergy of codes) {
    const list = ALLERGY_KEYWORDS[allergy];
    if (list) keywords.push(...list);
  }

  if (
    asLowerArray(onboardingData.foodAllergies).includes('other') &&
    typeof onboardingData.foodAllergiesOther === 'string'
  ) {
    onboardingData.foodAllergiesOther
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => keywords.push(s));
  }

  const unique = Array.from(new Set(keywords.map((k) => String(k).toLowerCase()))).filter(Boolean);

  return {
    active: unique.length > 0,
    codes,
    keywords: unique,
    foodMatcher: makeKeywordMatcher(unique),
  };
}

function applyReligiousDietKeywords(onboardingData, keywords) {
  const raw = onboardingData.religiousDiet;
  const list = asLowerArray(Array.isArray(raw) ? raw : raw ? [raw] : []);
  for (const rel of list) {
    if (!rel || rel === 'none' || rel === 'ramadan' || rel === 'christian_fasting') continue;
    const key = rel === 'vegan_strict' ? 'vegan_strict' : rel;
    const block = RELIGIOUS_DIET_BLOCKLIST[key];
    if (block) keywords.push(...block);
  }
}

/**
 * Build `foodMatcher(text) -> matchedKeyword | null` from onboardingData.
 * Combines allergies, explicit exclusions, and religious-diet restrictions.
 */
function buildExclusionMatchers(onboardingData = {}) {
  const keywords = [];

  const allergyFilters = buildAllergyFilters(onboardingData);
  keywords.push(...allergyFilters.keywords);

  const explicit = onboardingData.foodsExcluded;
  if (Array.isArray(explicit)) {
    for (const item of explicit) {
      if (typeof item === 'string') keywords.push(item);
      else if (item && typeof item === 'object' && item.name) keywords.push(String(item.name));
    }
  }
  if (typeof onboardingData.foodsExcludedCustom === 'string') {
    onboardingData.foodsExcludedCustom
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => keywords.push(s));
  }

  applyReligiousDietKeywords(onboardingData, keywords);

  const dietType = String(onboardingData.dietType || '').toLowerCase();
  if (dietType === 'vegetarian') {
    keywords.push(...RELIGIOUS_DIET_BLOCKLIST.vegetarian);
  } else if (dietType === 'vegan_strict') {
    keywords.push(...RELIGIOUS_DIET_BLOCKLIST.vegan_strict);
  }

  const budget = String(onboardingData.foodBudget || '').toLowerCase();
  const isCheap = BUDGET_CHEAP_VALUES.some((b) => budget.includes(b));

  return {
    foodMatcher: makeKeywordMatcher(keywords),
    budgetMatcher: isCheap ? makeKeywordMatcher(BUDGET_EXPENSIVE_TAGS) : null,
    allergyFilters,
  };
}

/**
 * Returns the injury key that blocks `exerciseName`, or null.
 */
function isExerciseBlocked(exerciseName, injuries, onboardingData = null) {
  if (onboardingData && typeof onboardingData === 'object' && !Array.isArray(onboardingData)) {
    return isExerciseBlockedBySafety(exerciseName, onboardingData);
  }
  const list = asLowerArray(injuries).filter((i) => i && i !== 'none');
  if (!list.length || !exerciseName) return null;
  return isExerciseBlockedBySafety(exerciseName, buildExerciseSafetyFilters({ injuries: list }));
}

module.exports = {
  ALLERGY_KEYWORDS,
  INJURY_BLOCKED_PATTERNS,
  RELIGIOUS_DIET_BLOCKLIST,
  BUDGET_EXPENSIVE_TAGS,
  BUDGET_CHEAP_VALUES,
  buildAllergyFilters,
  buildExclusionMatchers,
  isExerciseBlocked,
  makeKeywordMatcher,
};
