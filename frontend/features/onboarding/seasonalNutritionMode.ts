/** Derived flag for agent seasonal plan generators (e.g. Ramadan without re-onboarding). */

export const RAMADAN_SEASONAL_MODE = 'ramadan';

function asReligiousDietList(religiousDiet: unknown): string[] {
  if (Array.isArray(religiousDiet)) {
    return religiousDiet.map(String).filter(Boolean);
  }
  if (religiousDiet != null && String(religiousDiet).trim()) {
    return [String(religiousDiet).trim()];
  }
  return [];
}

export function hasRamadanReligiousDiet(religiousDiet: unknown): boolean {
  return asReligiousDietList(religiousDiet).some((r) => r.toLowerCase() === 'ramadan');
}

export function applySeasonalNutritionMode(
  onboardingData: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...onboardingData };
  if (hasRamadanReligiousDiet(next.religiousDiet)) {
    next.seasonalNutritionMode = RAMADAN_SEASONAL_MODE;
  } else {
    delete next.seasonalNutritionMode;
  }
  return next;
}
