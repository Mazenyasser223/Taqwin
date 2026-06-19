/**
 * Shared query synthesis for plan/catalog RAG when no user message exists.
 */

const {
  extractOnboardingFoodPicks,
  extractOnboardingExercisePicks,
} = require('./planOnboardingCatalog');
const { getDietPdfFoodNameList } = require('./planDietPdfCatalog');
const { getWorkoutPdfExerciseNameList } = require('./planWorkoutPdfCatalog');

function uniqueLower(arr) {
  return Array.from(new Set((arr || []).map((s) => String(s).toLowerCase()))).filter(Boolean);
}

function buildContextTags({ onboardingData, profile } = {}) {
  const od = onboardingData || profile?.onboardingData || {};
  const tags = [];
  if (od.religiousDiet && od.religiousDiet !== 'none') tags.push(od.religiousDiet);
  if (od.dietType) tags.push(od.dietType);
  if (Array.isArray(od.injuries)) {
    for (const i of od.injuries) if (i && i !== 'none') tags.push(i);
  }
  if (od.fitnessLevel) tags.push(od.fitnessLevel);
  if (profile?.fitnessLevel) tags.push(profile.fitnessLevel);
  if (od.foodBudget) tags.push(od.foodBudget);
  if (od.eatingOutFrequency) tags.push(od.eatingOutFrequency);
  if (od.weekendEating) tags.push(od.weekendEating);
  if (od.preferSimpleMeals) tags.push(od.preferSimpleMeals);
  if (od.workoutLocation) tags.push(od.workoutLocation);
  const goal = String(profile?.fitnessGoal || od.primaryGoal || '').toLowerCase();
  if (goal.includes('lose') || goal.includes('fat')) tags.push('fat-loss', 'lose-weight', 'deficit');
  if (goal.includes('muscle') || goal.includes('build')) tags.push('hypertrophy', 'muscle');
  if (goal.includes('endurance')) tags.push('endurance', 'cardio');
  return uniqueLower(tags);
}

/**
 * @param {'food'|'exercise'|'book'} kind
 * @param {object} [opts.onboardingData]
 * @param {object} [opts.profile]
 * @param {string} [opts.message] optional user/plan message
 */
function synthesizePlanQuery({ kind, onboardingData = {}, profile, message = '' } = {}) {
  const trimmed = String(message || '').trim();
  if (trimmed) return trimmed;

  const od = onboardingData || profile?.onboardingData || {};
  const tags = buildContextTags({ onboardingData, profile });
  const goal = profile?.fitnessGoal || od.primaryGoal || '';
  const parts = [];

  if (kind === 'food') {
    const pdfNames = getDietPdfFoodNameList().slice(0, 12);
    if (pdfNames.length) parts.push(...pdfNames);
    const prefNames = extractOnboardingFoodPicks(od)
      .map((p) => p.name)
      .filter(Boolean)
      .slice(0, 8);
    if (prefNames.length) parts.push(...prefNames);
    if (od.dietType) parts.push(od.dietType);
    if (goal) parts.push(String(goal));
    if (od.religiousDiet && od.religiousDiet !== 'none') parts.push(od.religiousDiet);
    parts.push('meal plan foods high protein nutrition');
  } else if (kind === 'exercise') {
    const pdfNames = getWorkoutPdfExerciseNameList().slice(0, 12);
    if (pdfNames.length) parts.push(...pdfNames);
    const prefNames = extractOnboardingExercisePicks(od)
      .map((p) => p.name)
      .filter(Boolean)
      .slice(0, 8);
    if (prefNames.length) parts.push(...prefNames);
    if (od.fitnessLevel || profile?.fitnessLevel) {
      parts.push(od.fitnessLevel || profile.fitnessLevel);
    }
    if (od.workoutLocation) parts.push(od.workoutLocation);
    if (goal) parts.push(String(goal));
    if (Array.isArray(od.injuries) && od.injuries.length) {
      parts.push('safe exercises avoiding', ...od.injuries.filter((i) => i && i !== 'none'));
    }
    parts.push('workout training program');
  } else if (kind === 'book') {
    if (goal) parts.push(String(goal));
    parts.push(...tags.slice(0, 6));
    parts.push('coaching philosophy training nutrition habits');
  }

  return parts.filter(Boolean).join(' ').trim() || 'fitness coaching nutrition training';
}

/**
 * CAG-informed query synthesis for coach chat retrieval (extends plan synthesis).
 * @param {object} opts
 * @param {string} [opts.message] user message (preferred when present)
 * @param {string} [opts.intent] routed intent
 * @param {object} [opts.contextBundle] full CAG bundle
 */
function synthesizeChatQuery({ message = '', intent = 'general', contextBundle } = {}) {
  const trimmed = String(message || '').trim();
  if (trimmed) return trimmed;

  const bundle = contextBundle || {};
  const profile = bundle.profile || {};
  const constraints = bundle.constraints || {};
  const parts = [];

  const goal = profile.fitnessGoal || bundle.onboardingSummary?.primaryGoal || '';
  if (goal) parts.push(String(goal));

  if (intent === 'nutrition') {
    if (constraints.dietType) parts.push(constraints.dietType);
    if (constraints.religiousDiet && constraints.religiousDiet !== 'none') {
      parts.push(constraints.religiousDiet);
    }
    const today = bundle.nutritionToday || {};
    if (today.recentFoods?.length) {
      parts.push('logged foods', ...today.recentFoods.slice(0, 3).map((f) => f.name || f));
    }
    parts.push('nutrition meal macros');
  } else if (intent === 'exercise_alternative' || intent === 'workout') {
    const wt = bundle.workoutToday || {};
    const ex = wt.exercises?.[0] || wt.loggedExercises?.[0];
    if (ex?.name) parts.push(`alternative for ${ex.name}`);
    const injuries = Array.isArray(constraints.injuries)
      ? constraints.injuries.filter((i) => i && i !== 'none')
      : [];
    if (injuries.length) parts.push('avoid', ...injuries);
    parts.push('workout exercise training');
  } else if (intent === 'platform_help') {
    parts.push('Taqwin platform app features help');
  } else {
    parts.push(...buildContextTags({ profile, onboardingData: bundle.onboardingSummary }).slice(0, 4));
    parts.push('fitness coaching');
  }

  return parts.filter(Boolean).join(' ').trim() || 'fitness coaching nutrition training';
}

module.exports = {
  buildContextTags,
  synthesizePlanQuery,
  synthesizeChatQuery,
  uniqueLower,
};
