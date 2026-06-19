/**
 * Resolve Diet / Workout PDF manifest names to WebTeb food and exercise catalog rows.
 */
const fs = require('fs');
const path = require('path');

const FOOD_BINDINGS_PATH = path.join(
  __dirname,
  '../../../data/diet-workout-catalog/food.bindings.json'
);

let foodBindingsCache = null;

function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** PDF Arabic is often stored as presentation-form glyphs; reverse Arabic tokens for matching. */
function fixPdfArabic(text) {
  return String(text || '')
    .split(/\s+/)
    .map((token) => {
      if (/[\u0600-\u06FF]/.test(token)) return [...token].reverse().join('');
      return token;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function foodQueryVariants(nameAr) {
  const raw = String(nameAr || '').trim();
  if (!raw) return [];
  const fixed = fixPdfArabic(raw);
  const variants = [raw];
  if (fixed && fixed !== raw) variants.push(fixed);
  return variants;
}

function exerciseNameKey(name) {
  return normalizeForMatch(name);
}

function loadFoodBindings() {
  if (foodBindingsCache) return foodBindingsCache;
  if (!fs.existsSync(FOOD_BINDINGS_PATH)) {
    foodBindingsCache = {};
    return foodBindingsCache;
  }
  const parsed = JSON.parse(fs.readFileSync(FOOD_BINDINGS_PATH, 'utf8'));
  foodBindingsCache = parsed.bindings || {};
  return foodBindingsCache;
}

/** PDF exercise nameKey → DB exercise name when fuzzy score is low. */
const EXERCISE_NAME_OVERRIDES = {
  'hammer strength row': 'Machine Plate Loaded Row',
  'wide stance angeled leg press': 'Machine Horizontal Leg Press',
};

const FOOD_MATCH_MIN_SCORE = 50;
const EXERCISE_MATCH_MIN_SCORE = 24;

function resolveFoodFromPool(nameAr, pool) {
  const bindings = loadFoodBindings();
  const boundId = bindings[nameAr];
  if (boundId != null) {
    const hit = pool.find((row) => row.webtebId === boundId);
    if (hit) {
      return { row: hit, score: 100, method: 'binding' };
    }
  }

  const { scoreNameMatch } = require('./planDietPdfCatalog');
  let best = null;
  let bestScore = 0;
  for (const query of foodQueryVariants(nameAr)) {
    for (const row of pool) {
      const score = scoreNameMatch(query, row);
      if (score > bestScore) {
        bestScore = score;
        best = row;
      }
    }
  }

  if (!best || bestScore < FOOD_MATCH_MIN_SCORE) {
    return { row: null, score: bestScore, method: 'unmatched' };
  }
  return { row: best, score: bestScore, method: 'fuzzy' };
}

function resolveExerciseFromPool(name, pool) {
  const { scoreExerciseNameMatch } = require('./planWorkoutPdfCatalog');
  const key = exerciseNameKey(name);
  const overrideName = EXERCISE_NAME_OVERRIDES[key];
  if (overrideName) {
    const hit = pool.find((row) => normalizeForMatch(row.name) === normalizeForMatch(overrideName));
    if (hit) {
      return { row: hit, score: 100, method: 'binding' };
    }
  }

  let best = null;
  let bestScore = 0;
  for (const row of pool) {
    const score = scoreExerciseNameMatch(name, row);
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }

  if (!best || bestScore < EXERCISE_MATCH_MIN_SCORE) {
    return { row: null, score: bestScore, method: 'unmatched' };
  }
  return { row: best, score: bestScore, method: 'fuzzy' };
}

module.exports = {
  FOOD_BINDINGS_PATH,
  fixPdfArabic,
  normalizeForMatch,
  foodQueryVariants,
  exerciseNameKey,
  EXERCISE_NAME_OVERRIDES,
  FOOD_MATCH_MIN_SCORE,
  EXERCISE_MATCH_MIN_SCORE,
  loadFoodBindings,
  resolveFoodFromPool,
  resolveExerciseFromPool,
};
