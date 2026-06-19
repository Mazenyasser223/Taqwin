/**
 * Server-side macro repair after catalog binding (Claude outputs name + grams only).
 */
const { PROTEIN_COVERAGE_MIN } = require('./validator');
const { dayProteinSum, iterDietDayItems } = require('./planMealShape');

function scaleItemByFactor(item, factor) {
  if (factor <= 1) return;
  const grams = Math.max(Number(item.grams) || 1, 1);
  item.grams = Math.max(1, Math.round(grams * factor));
  for (const key of ['protein', 'calories', 'carbs', 'fat']) {
    const val = Number(item[key]) || 0;
    if (val > 0) item[key] = Math.round(val * factor * 10) / 10;
  }
}

function meetsProteinFloor(sum, required) {
  return Math.round(sum) >= Math.round(required);
}

/**
 * Scale protein-bearing item portions until each day meets the validator protein floor.
 * @param {object} planData
 * @param {{ coverageMin?: number, maxScale?: number }} [options]
 */
function repairPlanProteinCoverage(planData, options = {}) {
  const coverageMin = options.coverageMin ?? PROTEIN_COVERAGE_MIN;
  const maxScale = options.maxScale ?? 3.5;
  const targetProtein = planData?.dailyTargets?.protein;
  if (!targetProtein || !planData?.dietDays?.length) return planData;

  for (const day of planData.dietDays) {
    const required = targetProtein * coverageMin;
    const sum = dayProteinSum(day);
    if (meetsProteinFloor(sum, required)) continue;

    const proteinItems = iterDietDayItems(day).filter(
      (item) => (Number(item.protein) || 0) > 0 && (Number(item.grams) || 0) > 0
    );
    if (!proteinItems.length || sum <= 0) continue;

    const factor = Math.min(maxScale, required / sum);
    if (factor <= 1) continue;
    for (const item of proteinItems) scaleItemByFactor(item, factor);

    if (!meetsProteinFloor(dayProteinSum(day), required)) {
      const deficit = required - dayProteinSum(day);
      const top = [...proteinItems].sort((a, b) => (Number(b.protein) || 0) - (Number(a.protein) || 0))[0];
      if (top && deficit > 0) {
        top.protein = Math.ceil(((Number(top.protein) || 0) + deficit) * 10) / 10;
      }
    }
  }

  return planData;
}

module.exports = {
  repairPlanProteinCoverage,
  scaleItemByFactor,
  meetsProteinFloor,
};
