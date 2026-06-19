/**

 * Plan food whitelist from diets & workouts/Diet 1.pdf … Diet 8.pdf manifest.

 * Resolves extracted Arabic names to WebTeb / foodItem rows in the catalog DB.

 */

const fs = require('fs');

const path = require('path');

const { prisma } = require('../../db');

const { normaliseFoodRow, filterFoodCandidates } = require('./catalogFood');

const { resolveFoodFromPool } = require('./planDietWorkoutMatch');



const MANIFEST_PATH = path.join(__dirname, '../../../data/diet-workout-catalog/foods.manifest.json');



let manifestCache = null;

let webtebPoolCache = null;

let webtebPoolLoadedAt = 0;

const POOL_TTL_MS = 10 * 60 * 1000;



function loadManifest() {

  if (manifestCache) return manifestCache;

  if (!fs.existsSync(MANIFEST_PATH)) {

    manifestCache = { foods: [] };

    return manifestCache;

  }

  manifestCache = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  return manifestCache;

}



function normalizeForMatch(value) {

  return String(value || '')

    .toLowerCase()

    .normalize('NFKC')

    .replace(/[^\p{L}\p{N}\s]/gu, ' ')

    .replace(/\s+/g, ' ')

    .trim();

}



function tokenizeForMatch(value) {
  return normalizeForMatch(value)
    .split(' ')
    .filter((token) => token.length >= 2);
}

function includesWholeToken(haystack, needle) {
  if (!needle) return false;
  return tokenizeForMatch(haystack).some((token) => token === needle);
}

function scoreNameMatch(query, row) {
  const q = normalizeForMatch(query);
  if (!q) return 0;
  const ar = normalizeForMatch(row.nameAr);
  const en = normalizeForMatch(row.nameEn);
  if (ar === q || en === q) return 100;

  const qTokens = tokenizeForMatch(q);
  if (qTokens.length === 1 && qTokens[0].length <= 4) {
    const token = qTokens[0];
    if (includesWholeToken(ar, token)) return 95;
    if (includesWholeToken(en, token)) return 90;
    return 0;
  }

  if (ar.includes(q) || q.includes(ar)) return 85;
  if (en && (en.includes(q) || q.includes(en))) return 80;

  let score = 0;
  for (const token of qTokens) {
    if (includesWholeToken(ar, token)) score += 14;
    else if (ar.includes(token) && token.length >= 5) score += 10;
    if (includesWholeToken(en, token)) score += 12;
    else if (en.includes(token) && token.length >= 5) score += 8;
  }
  return score;
}



async function loadWebtebPool() {

  const now = Date.now();

  if (webtebPoolCache && now - webtebPoolLoadedAt < POOL_TTL_MS) {

    return webtebPoolCache;

  }

  webtebPoolCache = await prisma.webtebFood.findMany({

    take: 4000,

    orderBy: { protein: 'desc' },

    select: {

      id: true,

      webtebId: true,

      nameEn: true,

      nameAr: true,

      calories: true,

      protein: true,

      carbs: true,

      fat: true,

      categorySlug: true,

    },

  });

  webtebPoolLoadedAt = now;

  return webtebPoolCache;

}



function rowToCatalogItem(row, locale, extra = {}) {

  return {

    ...normaliseFoodRow(

      {

        id: row.id,

        webtebId: row.webtebId,

        name: locale === 'ar' ? row.nameAr || row.nameEn : row.nameEn || row.nameAr,

        nameAr: row.nameAr,

        category: row.categorySlug,

        calories: row.calories,

        protein: row.protein,

        carbs: row.carbs,

        fat: row.fat,

      },

      'webteb',

    ),

    ...extra,

  };

}



async function loadRowsByWebtebIds(webtebIds) {

  const ids = [...new Set(webtebIds.filter((id) => id != null))];

  if (!ids.length) return new Map();

  const rows = await prisma.webtebFood.findMany({

    where: { webtebId: { in: ids } },

    select: {

      id: true,

      webtebId: true,

      nameEn: true,

      nameAr: true,

      calories: true,

      protein: true,

      carbs: true,

      fat: true,

      categorySlug: true,

    },

  });

  return new Map(rows.map((row) => [row.webtebId, row]));

}



/**

 * @param {object} [opts]

 * @param {object} [opts.onboardingData] allergy/diet filters

 * @param {string} [opts.locale]

 * @param {number} [opts.limit]

 * @returns {Promise<object[]>}

 */

async function loadDietPdfFoodCatalog({ onboardingData = {}, locale = 'ar', limit = 60 } = {}) {

  const manifest = loadManifest();

  const entries = manifest.foods || [];

  if (!entries.length) return [];



  const boundIds = entries.map((entry) => entry.webtebId).filter((id) => id != null);

  const boundRows = await loadRowsByWebtebIds(boundIds);

  const pool = boundRows.size < entries.length ? await loadWebtebPool() : [];



  const resolved = [];

  const seen = new Set();



  for (const entry of entries) {

    let row = entry.webtebId != null ? boundRows.get(entry.webtebId) : null;

    if (!row) {

      const match = resolveFoodFromPool(entry.nameAr, pool);

      row = match.row;

    }

    if (!row) continue;



    const key = row.webtebId ? `w${row.webtebId}` : `fi:${row.id}`;

    if (seen.has(key)) continue;

    seen.add(key);

    resolved.push(

      rowToCatalogItem(row, locale, {

        _dietPdf: true,

        _pdfNameAr: entry.nameAr,

        gramsExample: entry.gramsExample ?? null,

        score: 110,

      }),

    );

  }



  const filtered = filterFoodCandidates(resolved, onboardingData);

  return filtered.slice(0, limit);

}



function getDietPdfFoodNameList() {

  return (loadManifest().foods || []).map((f) => f.nameAr).filter(Boolean);

}



module.exports = {

  MANIFEST_PATH,

  loadManifest,

  loadDietPdfFoodCatalog,

  getDietPdfFoodNameList,

  normalizeForMatch,

  scoreNameMatch,

};


