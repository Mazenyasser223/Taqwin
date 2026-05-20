/**
 * WebTeb per-food serving units (الكمية + الوزن) from the calculator form.
 * Grams per unit are derived via ?amount=1&weightId=… using calorie ratios vs per-100g baseline.
 */
const cheerio = require('cheerio');
const { fetchHtml, sleep } = require('./webtebScraper');
const { parseWebtebFoodPage } = require('./webtebParsePage');

function parseServingUnitsFromSelect($) {
  const units = [];
  const seen = new Set();

  $('select[name="weightId"] option').each((_, el) => {
    const label = $(el).text().replace(/\s+/g, ' ').trim();
    if (!label) return;
    const weightId = String($(el).attr('value') ?? '').trim();
    const key = `${weightId}|${label}`;
    if (seen.has(key)) return;
    seen.add(key);

    if (!weightId) {
      units.push({
        label,
        weightId: null,
        weightText: '1 غرام',
        weightGrams: 1,
      });
      return;
    }

    units.push({
      label,
      weightId,
      weightText: null,
      weightGrams: null,
    });
  });

  return units;
}

function gramsFromCalories(servingCalories, caloriesPer100) {
  if (!caloriesPer100 || caloriesPer100 <= 0 || !servingCalories) return null;
  return Math.max(1, Math.round((servingCalories / caloriesPer100) * 100));
}

/**
 * Fetch WebTeb once per unit option to resolve weight in grams.
 */
async function enrichServingUnits(pageUrl, units, caloriesPer100, opts = {}) {
  const delayMs = opts.delayMs ?? (Number(process.env.WEBTEB_UNIT_DELAY_MS) || 350);
  const baseUrl = String(pageUrl || '').split('?')[0];
  if (!baseUrl) return units;

  const out = [];
  for (const u of units) {
    if (!u.weightId) {
      out.push({
        label: u.label || 'غرام',
        weightId: null,
        weightText: '1 غرام',
        weightGrams: 1,
      });
      continue;
    }

    if (u.weightGrams != null && u.weightGrams > 0) {
      out.push(u);
      continue;
    }

    try {
      const q = `?amount=1&weightId=${encodeURIComponent(u.weightId)}`;
      const html = await fetchHtml(baseUrl + q);
      const $ = cheerio.load(html);
      const parsed = parseWebtebFoodPage($, baseUrl);
      const grams = gramsFromCalories(parsed.calories, caloriesPer100);
      out.push({
        label: u.label,
        weightId: u.weightId,
        weightGrams: grams,
        weightText: grams ? `${grams} غرام` : null,
      });
    } catch {
      out.push({ ...u });
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  return out.filter((u) => u.label);
}

function needsServingUnitEnrichment(units) {
  if (!Array.isArray(units) || units.length === 0) return true;
  return units.some((u) => !u.weightGrams || u.weightGrams <= 0);
}

/**
 * Ensure food.servingUnits is populated (parse live page if DB empty, then enrich grams).
 */
async function ensureFoodServingUnits(food) {
  let units = Array.isArray(food.servingUnits) ? food.servingUnits : [];
  const caloriesPer100 = food.calories ?? 0;

  if (units.length === 0 && food.url) {
    const html = await fetchHtml(food.url);
    const $ = cheerio.load(html);
    units = parseServingUnitsFromSelect($);
  }

  if (needsServingUnitEnrichment(units) && food.url && caloriesPer100 > 0) {
    units = await enrichServingUnits(food.url, units, caloriesPer100);
  }

  return units;
}

module.exports = {
  parseServingUnitsFromSelect,
  enrichServingUnits,
  ensureFoodServingUnits,
  needsServingUnitEnrichment,
  gramsFromCalories,
};
