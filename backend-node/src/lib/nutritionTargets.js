/**
 * Daily macro targets from profile (shared by dashboard + AI coach).
 */
function estimateTargets(profile) {
  const weight = profile?.weight ?? 70;
  const goal = (profile?.fitnessGoal || '').toLowerCase();
  let calorieTarget = Math.round(weight * 24);
  let proteinTarget = Math.round(weight * 1.6);
  if (goal.includes('lose') || goal.includes('weight')) {
    calorieTarget = Math.round(weight * 22);
    proteinTarget = Math.round(weight * 2);
  } else if (goal.includes('muscle') || goal.includes('build')) {
    calorieTarget = Math.round(weight * 26);
    proteinTarget = Math.round(weight * 2.2);
  }
  const proteinCals = proteinTarget * 4;
  const remaining = Math.max(0, calorieTarget - proteinCals);
  return {
    calorieTarget,
    proteinTarget,
    carbTarget: Math.round((remaining * 0.45) / 4),
    fatTarget: Math.round((remaining * 0.25) / 9),
  };
}

function ageFromDateOfBirth(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age > 0 && age < 120 ? age : null;
}

module.exports = { estimateTargets, ageFromDateOfBirth };
