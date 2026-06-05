/**
 * Map WebtebFood DB row → FdcFoodDetails-compatible API payload.
 */
const { formatAmount } = require('./fdcFoodDetails');

const VITAMIN_RE =
  /vitamin|فيتامين|folate|folic|biotin|choline|retinol|carotene|tocopherol|niacin|riboflavin|thiamin|pantothen|cobalamin|ascorbic|phylloquinone|pyridoxine|ثيامين|ريبوفلافين|نياسين|حمض الفوليك|الكولين|البيتين/i;
const MINERAL_RE =
  /calcium|iron|magnesium|phosphorus|potassium|sodium|zinc|copper|manganese|selenium|iodine|fluoride|كالسيوم|حديد|ماغنيسيوم|فسفور|بوتاسيوم|صوديوم|زنك|نحاس|منجنيز|سيلينيوم|فلوريد/i;

function rowToNutrient(row) {
  if (!row || row.amount == null) return null;
  return {
    id: null,
    name: row.name,
    amount: row.amount,
    unit: row.unit || '',
    display: row.display || formatAmount(row.amount, row.unit),
  };
}

function classifyExtra(row) {
  const n = row.name || '';
  if (VITAMIN_RE.test(n)) return 'vitamin';
  if (MINERAL_RE.test(n)) return 'mineral';
  return 'other';
}

function dedupeSort(rows) {
  const byName = new Map();
  for (const row of rows) {
    const key = row.name.toLowerCase();
    const prev = byName.get(key);
    if (!prev || row.amount > prev.amount) byName.set(key, row);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

function toFoodDetailsFromWebteb(food, categoryNameAr) {
  const sections = food.sections && typeof food.sections === 'object' ? food.sections : {};
  const vitamins = [];
  const minerals = [];
  const other = [];

  const pushRows = (list, sectionKey) => {
    const raw = sections[sectionKey] || [];
    for (const r of raw) {
      const row = rowToNutrient(r);
      if (!row) continue;
      const kind = classifyExtra(row);
      if (kind === 'vitamin') vitamins.push(row);
      else if (kind === 'mineral') minerals.push(row);
      else other.push(row);
    }
  };

  pushRows(vitamins, 'vitamins');
  pushRows(minerals, 'minerals');
  pushRows(other, 'aminoAcids');
  pushRows(other, 'carbohydrates');
  pushRows(other, 'fats');

  const cal = sections.calories || [];
  const findCal = (pat) => {
    const hit = cal.find((r) => pat.test(r.name));
    return hit?.amount != null ? Math.round(hit.amount) : null;
  };

  const fromCarbs = findCal(/كربوهيدرات/) ?? Math.round(food.carbs * 4);
  const fromProtein = findCal(/بروتين/) ?? Math.round(food.protein * 4);
  const fromFat = findCal(/دهون/) ?? Math.round(food.fat * 9);
  const total = findCal(/مجمل/) ?? food.calories;

  const servingUnits = Array.isArray(food.servingUnits) ? food.servingUnits : [];
  const defaultUnit = servingUnits.find((u) => /غرام|gram/i.test(u.label));

  return {
    source: 'webteb',
    webtebId: food.webtebId,
    fdcId: 0,
    name: food.nameAr,
    nameEn: food.nameEn || null,
    dataType: 'WebTeb',
    foodCategory: categoryNameAr || food.categorySlug,
    servingLabel: defaultUnit ? defaultUnit.label : '100 غرام',
    macros: {
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
    },
    calorieBreakdown: {
      total,
      fromCarbs,
      fromProtein,
      fromFat,
      computedTotal: fromCarbs + fromProtein + fromFat,
    },
    vitamins: dedupeSort(vitamins),
    minerals: dedupeSort(minerals),
    nutrients: dedupeSort(other),
    servingUnits,
  };
}

module.exports = { toFoodDetailsFromWebteb };
