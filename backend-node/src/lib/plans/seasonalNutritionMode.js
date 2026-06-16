/**
 * Derive seasonalNutritionMode from onboarding (e.g. religiousDiet → ramadan).
 * Lets the agent run Ramadan Plan Generator without re-onboarding.
 */

const RAMADAN_MODE = 'ramadan';

function asReligiousDietList(religiousDiet) {
  if (Array.isArray(religiousDiet)) {
    return religiousDiet.map(String).filter(Boolean);
  }
  if (religiousDiet != null && String(religiousDiet).trim()) {
    return [String(religiousDiet).trim()];
  }
  return [];
}

function hasRamadanReligiousDiet(religiousDiet) {
  return asReligiousDietList(religiousDiet).some((r) => r.toLowerCase() === 'ramadan');
}

/**
 * Apply or clear seasonalNutritionMode on onboardingData from religiousDiet.
 * @param {Record<string, unknown>|null|undefined} onboardingData
 * @returns {Record<string, unknown>}
 */
function applySeasonalNutritionMode(onboardingData) {
  const base =
    onboardingData && typeof onboardingData === 'object' ? { ...onboardingData } : {};
  if (hasRamadanReligiousDiet(base.religiousDiet)) {
    base.seasonalNutritionMode = RAMADAN_MODE;
  } else {
    delete base.seasonalNutritionMode;
  }
  return base;
}

module.exports = {
  RAMADAN_MODE,
  asReligiousDietList,
  hasRamadanReligiousDiet,
  applySeasonalNutritionMode,
};
