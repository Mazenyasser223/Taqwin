/**
 * Post-process meal vision JSON: numeric confidence, hidden-calorie totals, validation gates.
 */

const CONF_NUMERIC = { high: 0.9, medium: 0.75, low: 0.55 };

function confToNumeric(conf) {
  const c = String(conf || 'medium').toLowerCase();
  return CONF_NUMERIC[c] ?? 0.75;
}

function itemConfWorst(conf) {
  if (conf && typeof conf === 'object') {
    const vals = [
      conf.identification || 'medium',
      conf.portion_estimation || 'medium',
      conf.nutrition_estimation || 'medium',
    ].map((v) => String(v).toLowerCase());
    if (vals.includes('low')) return 'low';
    if (vals.includes('medium')) return 'medium';
    return 'high';
  }
  return String(conf || 'medium').toLowerCase();
}

function itemConfNumeric(conf) {
  if (conf && typeof conf === 'object') {
    const vals = [
      confToNumeric(conf.identification),
      confToNumeric(conf.portion_estimation),
      confToNumeric(conf.nutrition_estimation),
    ];
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }
  return confToNumeric(conf);
}

function sumHiddenCalories(items) {
  return (items || []).reduce((sum, item) => {
    const sources = item.hidden_calorie_sources;
    if (Array.isArray(sources) && sources.length > 0) {
      return sum + (Number(item.estimated_calories) || 0);
    }
    return sum;
  }, 0);
}

function normalizeSameMealValidation(raw) {
  if (!raw || typeof raw !== 'object') {
    return { passed: true, confidence: 0.85, issues: [] };
  }
  const passed = raw.passed !== false;
  const confidence =
    typeof raw.confidence === 'number'
      ? Math.min(1, Math.max(0, raw.confidence))
      : confToNumeric(raw.confidence);
  const issues = Array.isArray(raw.issues) ? raw.issues.map(String) : [];
  return { passed, confidence, issues };
}

/**
 * @param {object} result
 * @returns {object}
 */
function enrichMealCaptureResult(result) {
  if (!result || typeof result !== 'object' || result.error) return result;

  const foodItems = (result.food_items || []).map((item) => ({
    ...item,
    confidence_score:
      typeof item.confidence_score === 'number'
        ? item.confidence_score
        : itemConfNumeric(item.confidence),
  }));

  const ms = { ...(result.meal_summary || {}) };
  ms.overall_confidence =
    typeof ms.overall_confidence === 'number'
      ? ms.overall_confidence
      : confToNumeric(ms.confidence);
  ms.possible_hidden_calories =
    typeof ms.possible_hidden_calories === 'number'
      ? ms.possible_hidden_calories
      : sumHiddenCalories(foodItems);

  const sameMeal = normalizeSameMealValidation(result.same_meal_validation);

  return {
    ...result,
    food_items: foodItems,
    meal_summary: ms,
    same_meal_validation: sameMeal,
  };
}

/**
 * Block analysis when images clearly belong to different meals.
 * @param {object} result
 * @returns {{ error?: string, message?: string } | null}
 */
function sameMealGate(result) {
  const v = result?.same_meal_validation;
  if (!v || v.passed !== false) return null;
  const issues = Array.isArray(v.issues) && v.issues.length ? v.issues : ['Images may show different meals'];
  const confidence = typeof v.confidence === 'number' ? v.confidence : 0;
  if (confidence >= 0.65) return null;
  return {
    error: 'SAME_MEAL_MISMATCH',
    message: `Photos do not appear to be the same meal: ${issues.join('; ')}`,
    same_meal_validation: v,
  };
}

module.exports = {
  CONF_NUMERIC,
  confToNumeric,
  itemConfWorst,
  itemConfNumeric,
  sumHiddenCalories,
  enrichMealCaptureResult,
  sameMealGate,
  normalizeSameMealValidation,
};
