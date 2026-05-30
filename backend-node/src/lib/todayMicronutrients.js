/**
 * Aggregate vitamins, minerals, and other nutrients from today's food logs (WebTeb DB).
 */
const { toFoodDetailsFromWebteb } = require('./webtebFoodDetails');

function nutrientKey(name, unit) {
  return `${String(name).trim().toLowerCase()}|${String(unit || '').trim().toLowerCase()}`;
}

function addToMap(map, row) {
  if (!row || row.amount == null || !Number.isFinite(row.amount)) return;
  const key = nutrientKey(row.name, row.unit);
  const prev = map.get(key);
  if (prev) {
    prev.amount += row.amount;
    prev.display = `${Math.round(prev.amount * 100) / 100} ${prev.unit}`.trim();
  } else {
    map.set(key, {
      name: row.name,
      amount: row.amount,
      unit: row.unit || '',
      display: row.display || `${Math.round(row.amount * 100) / 100}`,
    });
  }
}

function mapToSortedList(map) {
  return [...map.values()]
    .filter((r) => r.amount > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {Array<{ grams: number, foodItem: { webtebId?: number|null, name?: string } }>} todayFoodLogs
 */
async function aggregateTodayMicronutrients(prisma, todayFoodLogs) {
  const webtebIds = [
    ...new Set(
      todayFoodLogs
        .map((l) => l.foodItem?.webtebId)
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ];

  const vitaminMap = new Map();
  const mineralMap = new Map();
  const nutrientMap = new Map();
  let trackedLogs = 0;

  if (!webtebIds.length) {
    return {
      vitamins: [],
      minerals: [],
      nutrients: [],
      totals: {
        vitaminCount: 0,
        mineralCount: 0,
        nutrientCount: 0,
        trackedFoods: 0,
        logCount: todayFoodLogs.length,
      },
    };
  }

  const webtebRows = await prisma.webtebFood.findMany({
    where: { webtebId: { in: webtebIds } },
    include: { category: { select: { nameAr: true } } },
  });
  const byWebtebId = new Map(webtebRows.map((r) => [r.webtebId, r]));

  for (const log of todayFoodLogs) {
    const wid = log.foodItem?.webtebId;
    if (!wid || !byWebtebId.has(wid)) continue;
    const food = byWebtebId.get(wid);
    const factor = Math.max(0, Number(log.grams) || 0) / 100;
    if (factor <= 0) continue;

    trackedLogs += 1;
    const details = toFoodDetailsFromWebteb(food, food.category?.nameAr);

    for (const row of details.vitamins) {
      addToMap(vitaminMap, {
        ...row,
        amount: row.amount * factor,
        display: `${Math.round(row.amount * factor * 100) / 100} ${row.unit}`.trim(),
      });
    }
    for (const row of details.minerals) {
      addToMap(mineralMap, {
        ...row,
        amount: row.amount * factor,
        display: `${Math.round(row.amount * factor * 100) / 100} ${row.unit}`.trim(),
      });
    }
    for (const row of details.nutrients) {
      addToMap(nutrientMap, {
        ...row,
        amount: row.amount * factor,
        display: `${Math.round(row.amount * factor * 100) / 100} ${row.unit}`.trim(),
      });
    }
  }

  const vitamins = mapToSortedList(vitaminMap);
  const minerals = mapToSortedList(mineralMap);
  const nutrients = mapToSortedList(nutrientMap);

  return {
    vitamins,
    minerals,
    nutrients,
    totals: {
      vitaminCount: vitamins.length,
      mineralCount: minerals.length,
      nutrientCount: nutrients.length,
      trackedFoods: trackedLogs,
      logCount: todayFoodLogs.length,
    },
  };
}

module.exports = { aggregateTodayMicronutrients };
