/**
 * Localize diet plan meal item names for dashboard / plan APIs (user language).
 */
const { prisma } = require('../../db');
const { resolveFoodDisplayName } = require('../foodDisplayName');

/**
 * @param {Array<{ name?: string, foodItemId?: string|null, webtebId?: number|null }>} meals
 * @param {'ar'|'en'} locale
 */
async function localizePlanDietMeals(meals, locale = 'ar') {
  if (!Array.isArray(meals) || !meals.length) return meals;

  const foodItemIds = [...new Set(meals.map((m) => m.foodItemId).filter(Boolean))];
  const foodById = new Map();
  if (foodItemIds.length) {
    const rows = await prisma.foodItem.findMany({
      where: { id: { in: foodItemIds } },
      select: { id: true, name: true, webtebId: true },
    });
    for (const row of rows) foodById.set(row.id, row);
  }

  return Promise.all(
    meals.map(async (meal) => {
      const linked = meal.foodItemId ? foodById.get(meal.foodItemId) : null;
      const webtebId = meal.webtebId ?? linked?.webtebId ?? null;
      const baseName = String(meal.name || linked?.name || '').trim();
      if (!baseName) return meal;

      const displayName = await resolveFoodDisplayName(
        { name: baseName, webtebId },
        locale,
        prisma
      );
      return { ...meal, name: displayName, webtebId };
    })
  );
}

async function localizeDietDayMeals(day, locale) {
  if (!day?.meals?.length) return day;
  const meals = await localizePlanDietMeals(day.meals, locale);
  return { ...day, meals };
}

/**
 * @param {ReturnType<import('./planApiFormat').formatWeekPlanResponse>} weekPayload
 * @param {'ar'|'en'} locale
 */
async function enrichWeekPlanDietMeals(weekPayload, locale = 'ar') {
  if (!weekPayload) return weekPayload;

  const diet = weekPayload.diet
    ? {
        ...weekPayload.diet,
        days: await Promise.all((weekPayload.diet.days || []).map((d) => localizeDietDayMeals(d, locale))),
      }
    : weekPayload.diet;

  const dailyPlans = weekPayload.dailyPlans
    ? await Promise.all(
        weekPayload.dailyPlans.map(async (row) => ({
          ...row,
          diet: row.diet ? await localizeDietDayMeals(row.diet, locale) : row.diet,
        }))
      )
    : weekPayload.dailyPlans;

  return { ...weekPayload, diet, dailyPlans };
}

module.exports = {
  localizePlanDietMeals,
  localizeDietDayMeals,
  enrichWeekPlanDietMeals,
};
