/**
 * Shared query synthesis for plan/catalog RAG when no user message exists.
 */

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
    if (od.dietType) parts.push(od.dietType);
    if (goal) parts.push(String(goal));
    if (od.religiousDiet && od.religiousDiet !== 'none') parts.push(od.religiousDiet);
    parts.push('meal plan foods high protein nutrition');
  } else if (kind === 'exercise') {
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

module.exports = {
  buildContextTags,
  synthesizePlanQuery,
  uniqueLower,
};
