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
  eggs: ['egg', 'omelette', 'omelet', 'frittata', 'بيض', 'عجة'],
};

/**
 * Injury keys (questionnaire `injuries` multi) → regex of exercise names
 * that should be excluded. Conservative: better to skip a great exercise
 * than to aggravate an injury.
 */
const INJURY_BLOCKED_PATTERNS = {
  back: /deadlift|good\s*morning|bent[-\s]*over|barbell row|jefferson|stiff[-\s]*leg|hyperextension/i,
  lower_back: /deadlift|good\s*morning|bent[-\s]*over|barbell row|stiff[-\s]*leg|hyperextension/i,
  upper_back: /shrug|barbell row|behind\s*neck/i,
  knees: /jump|jumping|sprint|deep\s*squat|pistol\s*squat|bulgarian\s*split|burpee|box\s*jump/i,
  hips: /deep\s*squat|sumo\s*deadlift|wide\s*stance|hip\s*thrust/i,
  shoulders:
    /overhead press|military press|behind\s*neck|upright row|snatch|jerk|handstand|push\s*press/i,
  neck: /shrug|behind\s*neck|wrestler|neck\s*curl/i,
  chest: /bench\s*press|fly|dips|push[-\s]*up/i,
  arms: /heavy\s*curl|preacher\s*curl|skull\s*crusher/i,
  elbows: /skull\s*crusher|close[-\s]*grip\s*bench|dips?|french\s*press/i,
  wrists: /handstand|planche|wrist\s*curl|reverse\s*curl|barbell\s*press/i,
  ankles: /jump|sprint|box\s*jump|calf\s*raise/i,
  legs: /squat|lunge|deadlift|leg\s*press|jump/i,
};

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
  vegan: [
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

/**
 * Build `foodMatcher(text) -> matchedKeyword | null` from onboardingData.
 * Combines allergies, explicit exclusions, and religious-diet restrictions.
 */
function buildExclusionMatchers(onboardingData = {}) {
  const keywords = [];

  for (const allergy of asLowerArray(onboardingData.foodAllergies)) {
    const list = ALLERGY_KEYWORDS[allergy];
    if (list) keywords.push(...list);
  }

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

  const rel = String(onboardingData.religiousDiet || '').toLowerCase();
  for (const [key, list] of Object.entries(RELIGIOUS_DIET_BLOCKLIST)) {
    if (rel === key) keywords.push(...list);
  }

  const budget = String(onboardingData.foodBudget || '').toLowerCase();
  const isCheap = BUDGET_CHEAP_VALUES.some((b) => budget.includes(b));

  return {
    foodMatcher: makeKeywordMatcher(keywords),
    budgetMatcher: isCheap ? makeKeywordMatcher(BUDGET_EXPENSIVE_TAGS) : null,
  };
}

/**
 * Returns the injury key that blocks `exerciseName`, or null.
 */
function isExerciseBlocked(exerciseName, injuries) {
  const list = asLowerArray(injuries).filter((i) => i && i !== 'none');
  if (!list.length || !exerciseName) return null;
  const text = String(exerciseName);
  for (const inj of list) {
    const pattern = INJURY_BLOCKED_PATTERNS[inj];
    if (pattern && pattern.test(text)) return inj;
  }
  return null;
}

module.exports = {
  ALLERGY_KEYWORDS,
  INJURY_BLOCKED_PATTERNS,
  RELIGIOUS_DIET_BLOCKLIST,
  BUDGET_EXPENSIVE_TAGS,
  BUDGET_CHEAP_VALUES,
  buildExclusionMatchers,
  isExerciseBlocked,
  makeKeywordMatcher,
};
