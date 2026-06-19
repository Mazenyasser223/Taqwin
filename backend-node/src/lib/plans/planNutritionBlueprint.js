/**
 * Rule-based nutrition meal structure (replaces coach diet templates).
 */

function buildNutritionStructureBlueprint(onboardingData = {}) {
  const mealsPerDay = Math.min(4, Math.max(2, Number(onboardingData.mealsPerDay) || 3));
  const snacks = Math.min(2, Math.max(0, Number(onboardingData.snacksPerDay) || 0));
  const preferSimple = String(onboardingData.preferSimpleMeals || '') === 'yes';

  const slots = ['breakfast'];
  if (mealsPerDay >= 2) slots.push('lunch');
  if (mealsPerDay >= 3) slots.push('dinner');
  if (snacks > 0 || mealsPerDay >= 4) slots.push('snack');

  const itemsPerSlot = preferSimple
    ? { breakfast: 3, lunch: 4, dinner: 4, snack: 2 }
    : { breakfast: 4, lunch: 5, dinner: 5, snack: 3 };

  const days = Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i + 1,
    label: `Day ${i + 1}`,
    meals: slots.map((slot) => ({
      slot,
      targetItemCount: itemsPerSlot[slot] || 4,
    })),
  }));

  return {
    mealsPerDay,
    snacksPerDay: snacks,
    preferSimpleMeals: preferSimple,
    dietSkeleton: days,
    coachFocus: [
      `Build ${mealsPerDay} main meals${snacks ? ` + ${snacks} snack(s)` : ''} per day using FOOD LIBRARY only.`,
      'Plan exactly 7 dietDays (dayIndex 1–7) with DIFFERENT foods each day — rotate proteins, carbs, and fats across the week.',
      'Do NOT repeat the same breakfast/lunch/dinner combo on every day; each dayIndex must feel like a distinct menu.',
      'Same daily macro targets every day; vary food choices and pairings only.',
    ],
  };
}

module.exports = {
  buildNutritionStructureBlueprint,
};
