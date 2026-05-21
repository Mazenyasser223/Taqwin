/**
 * Parse WebTeb nutrition facts HTML into structured sections (per 100g baseline).
 */

const SECTION_KEYS = {
  'القيمة الغذائية': 'summary',
  'السعرات الحرارية': 'calories',
  'كمية الفيتامينات': 'vitamins',
  'كمية المعادن': 'minerals',
  'البروتينات والاحماض الامينية': 'aminoAcids',
  'البروتينات و الأحماض الامينية': 'aminoAcids',
  'الكربوهيدرات': 'carbohydrates',
  'الاحماض الدهنية والدهون': 'fats',
  'الاحماض الدهنية و الدهون': 'fats',
};

function parseAmount(raw) {
  const s = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!s || s === '—' || s === '-') return null;
  const m = s.match(/^([\d.,]+)\s*(.*)$/);
  if (!m) return { value: null, unit: '', display: s };
  const num = Number(m[1].replace(/,/g, ''));
  const unit = (m[2] || '').trim();
  return {
    value: Number.isFinite(num) ? num : null,
    unit,
    display: unit ? `${num} ${unit}` : String(num),
  };
}

function normalizeSectionTitle(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sectionKeyForTitle(titleText) {
  const t = normalizeSectionTitle(titleText);
  if (!t) return null;
  if (SECTION_KEYS[t]) return SECTION_KEYS[t];
  for (const [label, key] of Object.entries(SECTION_KEYS)) {
    if (t.includes(label) || label.includes(t)) return key;
  }
  if (/القيمة الغذائية/i.test(t)) return 'summary';
  if (/السعرات الحرارية/i.test(t)) return 'calories';
  if (/الفيتامينات/i.test(t)) return 'vitamins';
  if (/المعادن/i.test(t)) return 'minerals';
  if (/الأحماض الامينية|الاحماض الامينية/i.test(t)) return 'aminoAcids';
  if (/الكربوهيدرات/i.test(t)) return 'carbohydrates';
  if (/الدهون|الدهنية/i.test(t)) return 'fats';
  return null;
}

function tableAfterHeading($, heading) {
  const $h = $(heading);
  let table = $h.parent().next().find('table').first();
  if (!table.length) table = $h.nextAll('table').first();
  if (!table.length) table = $h.parent().siblings().find('table').first();
  return table;
}

function parseTableRows($, table) {
  const rows = [];
  $(table)
    .find('tr')
    .each((_, tr) => {
      const cells = $(tr)
        .find('th, td')
        .map((__, el) => $(el).text().replace(/\s+/g, ' ').trim())
        .get();
      if (cells.length >= 2) {
        const nutrient = cells[0];
        const amount = cells[1];
        if (nutrient && amount && !/^المغذيات$/i.test(nutrient) && !/^الكمية$/i.test(nutrient)) {
          const parsed = parseAmount(amount);
          if (parsed?.value != null) {
            rows.push({
              name: nutrient,
              amount: parsed.value,
              unit: parsed.unit,
              display: parsed.display,
            });
          }
        }
      }
    });
  return rows;
}

function findMacro(rows, patterns) {
  for (const row of rows) {
    const n = row.name.toLowerCase();
    if (patterns.some((p) => n.includes(p))) return row;
  }
  return null;
}

function extractMacros(summaryRows, calorieRows) {
  const energy = findMacro(summaryRows, ['طاقة', 'energy']);
  const protein = findMacro(summaryRows, ['بروتين', 'protein']);
  const fat = findMacro(summaryRows, ['دهون', 'fat']);
  const carbs = findMacro(summaryRows, ['كربوهيدرات', 'carb']);

  let calories = energy?.amount ?? 0;
  const fromCarbsRow = findMacro(calorieRows, ['السعرات الحرارية من الكربوهيدرات', 'من الكربوهيدرات']);
  const fromProteinRow = findMacro(calorieRows, ['من البروتين', 'البروتين']);
  const fromFatRow = findMacro(calorieRows, ['من الدهون', 'الدهون']);
  const totalCalRow = findMacro(calorieRows, ['مجمل', 'total']);

  if (totalCalRow?.amount != null) calories = totalCalRow.amount;

  return {
    calories: Math.round(calories) || 0,
    protein: protein?.amount ?? 0,
    carbs: carbs?.amount ?? 0,
    fat: fat?.amount ?? 0,
    calorieBreakdown: {
      total: Math.round(totalCalRow?.amount ?? calories) || 0,
      fromCarbs: Math.round(fromCarbsRow?.amount ?? 0) || 0,
      fromProtein: Math.round(fromProteinRow?.amount ?? 0) || 0,
      fromFat: Math.round(fromFatRow?.amount ?? 0) || 0,
    },
  };
}

function parseServingUnits($) {
  const { parseServingUnitsFromSelect } = require('./webtebServingUnits');
  const fromSelect = parseServingUnitsFromSelect($);
  if (fromSelect.length > 0) return fromSelect;

  const units = [];
  const qtyHeading = $('h2, h3')
    .filter((_, el) => /اختر الكمية|الكمية لحساب/i.test($(el).text()))
    .first();
  const scope = qtyHeading.length ? qtyHeading.parent().next() : $('body');
  scope
    .find('table')
    .first()
    .find('tr')
    .each((_, tr) => {
      const cells = $(tr)
        .find('td, th')
        .map((__, el) => $(el).text().replace(/\s+/g, ' ').trim())
        .get();
      if (cells.length >= 2 && cells[0] && cells[1] && !/الكمية|الوزن/i.test(cells[0])) {
        const weightMatch = cells[1].match(/([\d.,]+)\s*g/i);
        units.push({
          label: cells[0],
          weightText: cells[1],
          weightGrams: weightMatch ? Number(weightMatch[1].replace(/,/g, '')) : null,
        });
      }
    });
  return units;
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} html
 */
function parseWebtebFoodPage($, pageUrl) {
  let title =
    $('h1')
      .first()
      .text()
      .replace(/اكتشفوا السعرات الحرارية والقيم الغذائية\s*:?\s*/gi, '')
      .replace(/^لل\s+/i, '')
      .trim() || '';
  if (!title) {
    title = normalizeSectionTitle($('.food-title, .page-title').first().text());
  }
  title = title.replace(/^لل\s+/i, '').trim();
  if (!title) title = 'غير معروف';

  const sections = {};
  $('h2.s-title, h2, h3, h4').each((_, heading) => {
    const titleText = normalizeSectionTitle($(heading).text());
    const key = sectionKeyForTitle(titleText);
    if (!key || sections[key]) return;
    const table = tableAfterHeading($, heading);
    if (!table.length) return;
    sections[key] = parseTableRows($, table);
  });

  const summaryRows = sections.summary || [];
  const calorieRows = sections.calories || [];
  const macros = extractMacros(summaryRows, calorieRows);

  const m = String(pageUrl).match(/_(\d+)\/?$/);
  const webtebId = m ? Number(m[1]) : null;
  const slugMatch = String(pageUrl).match(/\/nutritionfacts\/[^/]+\/([^/]+)_\d+/i);
  const slug = slugMatch ? slugMatch[1] : '';

  return {
    webtebId,
    slug,
    nameAr: title,
    url: pageUrl,
    servingUnits: parseServingUnits($),
    sections,
    ...macros,
  };
}

module.exports = { parseWebtebFoodPage, parseTableRows, parseAmount };
