/**
 * Top staple foods per macro group for plan generation (WebTeb library, real P/C/F).
 * Loads from shared/plan-staple-foods.json (built by scripts/build-plan-staple-foods.js)
 * or refreshes from Postgres when PLAN_STAPLE_FROM_DB=true.
 */
const fs = require('fs');
const path = require('path');
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { filterFoodCandidates, normaliseFoodRow } = require('../rag/catalogFood');
const { dbCategoryIdsForBrowseId } = require('../webtebCategories');

const GROUPS_PATH = path.resolve(__dirname, '../../../../shared/plan-food-groups.json');
const STAPLES_PATH = path.resolve(__dirname, '../../../../shared/plan-staple-foods.json');

const DEFAULT_PER_GROUP = Math.min(
  50,
  Math.max(10, Number(process.env.PLAN_STAPLE_PER_GROUP || 50)),
);

let stapleCache = null;
let stapleCacheAt = 0;
const CACHE_TTL_MS = 15 * 60 * 1000;

function loadGroupConfig() {
  return JSON.parse(fs.readFileSync(GROUPS_PATH, 'utf8'));
}

function nameMatchesPattern(name, pattern) {
  if (!pattern) return true;
  try {
    return new RegExp(pattern, 'i').test(String(name || ''));
  } catch {
    return true;
  }
}

function rowToCatalogItem(row, planGroup, locale) {
  const name =
    locale === 'ar'
      ? row.nameAr || row.nameEn || row.name || ''
      : row.nameEn || row.nameAr || row.name || '';
  return {
    source: 'webteb',
    id: row.id,
    webtebId: row.webtebId,
    name,
    nameAr: row.nameAr || null,
    nameEn: row.nameEn || null,
    category: row.categorySlug || row.category || '',
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    carbs: Number(row.carbs) || 0,
    fat: Number(row.fat) || 0,
    planGroup,
    _staple: true,
  };
}

async function loadWebtebPopularityRank() {
  try {
    const rows = await prisma.$queryRaw`
      SELECT w.webteb_id AS "webtebId", COUNT(fl.id)::int AS cnt
      FROM webteb_foods w
      LEFT JOIN food_items fi ON fi.webteb_id = w.webteb_id
      LEFT JOIN food_logs fl ON fl.food_item_id = fi.id
      GROUP BY w.webteb_id
    `;
    return new Map(rows.map((r) => [Number(r.webtebId), Number(r.cnt) || 0]));
  } catch (err) {
    logger.warn({ err: err.message }, 'plan staple popularity query failed');
    return new Map();
  }
}

function sortRowsForGroup(rows, groupDef, popularity) {
  const macroKey = groupDef.sortMacro || 'protein';
  return [...rows].sort((a, b) => {
    const popA = popularity.get(a.webtebId) || 0;
    const popB = popularity.get(b.webtebId) || 0;
    if (popB !== popA) return popB - popA;
    const ma = Number(a[macroKey]) || 0;
    const mb = Number(b[macroKey]) || 0;
    if (mb !== ma) return mb - ma;
    return String(a.nameEn || a.nameAr || '').localeCompare(String(b.nameEn || b.nameAr || ''));
  });
}

async function loadStaplesFromDb({ onboardingData = {}, locale = 'ar', perGroup = DEFAULT_PER_GROUP } = {}) {
  const config = loadGroupConfig();
  const popularity = await loadWebtebPopularityRank();
  const allCategoryIds = new Set();
  for (const def of Object.values(config.groups)) {
    for (const cid of def.categoryIds || []) {
      for (const id of dbCategoryIdsForBrowseId(cid)) allCategoryIds.add(id);
    }
  }

  const dbRows = await prisma.webtebFood.findMany({
    where: { categoryId: { in: [...allCategoryIds] } },
    select: {
      id: true,
      webtebId: true,
      nameEn: true,
      nameAr: true,
      categoryId: true,
      categorySlug: true,
      calories: true,
      protein: true,
      carbs: true,
      fat: true,
    },
  });

  const byGroup = {};
  for (const [groupKey, groupDef] of Object.entries(config.groups)) {
    const allowedCats = new Set();
    for (const cid of groupDef.categoryIds || []) {
      for (const id of dbCategoryIdsForBrowseId(cid)) allowedCats.add(id);
    }

    let candidates = dbRows.filter((row) => allowedCats.has(row.categoryId));
    candidates = candidates.filter((row) => {
      const label = `${row.nameEn || ''} ${row.nameAr || ''}`;
      if (groupDef.nameInclude && !nameMatchesPattern(label, groupDef.nameInclude)) return false;
      if (groupDef.nameExclude && nameMatchesPattern(label, groupDef.nameExclude)) return false;
      return true;
    });

    candidates = sortRowsForGroup(candidates, groupDef, popularity).slice(0, perGroup);
    const normalized = candidates.map((row) => rowToCatalogItem(row, groupKey, locale));
    byGroup[groupKey] = filterFoodCandidates(normalized, onboardingData);
  }

  return flattenGroupedFoods(byGroup);
}

function loadStaplesFromJson({ onboardingData = {}, locale = 'ar' } = {}) {
  if (!fs.existsSync(STAPLES_PATH)) return [];
  const payload = JSON.parse(fs.readFileSync(STAPLES_PATH, 'utf8'));
  const byGroup = payload.groups || {};
  const out = [];
  for (const [groupKey, items] of Object.entries(byGroup)) {
    for (const item of items || []) {
      out.push({
        ...item,
        planGroup: item.planGroup || groupKey,
        _staple: true,
        name:
          locale === 'ar'
            ? item.nameAr || item.nameEn || item.name
            : item.nameEn || item.nameAr || item.name,
      });
    }
  }
  return filterFoodCandidates(out, onboardingData);
}

function flattenGroupedFoods(byGroup) {
  const order = Object.keys(loadGroupConfig().groups);
  const out = [];
  for (const key of order) {
    for (const item of byGroup[key] || []) out.push(item);
  }
  return out;
}

async function loadPlanStapleFoodCatalog(opts = {}) {
  const fromDb = String(process.env.PLAN_STAPLE_FROM_DB || 'true').toLowerCase() !== 'false';
  const now = Date.now();
  if (stapleCache && now - stapleCacheAt < CACHE_TTL_MS && stapleCache.locale === opts.locale) {
    return filterFoodCandidates(stapleCache.items, opts.onboardingData || {});
  }

  let items = [];
  if (fromDb) {
    try {
      items = await loadStaplesFromDb(opts);
    } catch (err) {
      logger.warn({ err: err.message }, 'plan staples DB load failed — using JSON fallback');
      items = loadStaplesFromJson(opts);
    }
  } else {
    items = loadStaplesFromJson(opts);
  }

  if (!items.length) items = loadStaplesFromJson(opts);

  stapleCache = { items, locale: opts.locale || 'ar' };
  stapleCacheAt = now;
  return items;
}

function tagOnboardingPickGroup(item, field) {
  const config = loadGroupConfig();
  const group = config.onboardingFieldToGroup?.[field] || 'other';
  return { ...item, planGroup: item.planGroup || group, _userPref: true };
}

module.exports = {
  loadPlanStapleFoodCatalog,
  loadStaplesFromDb,
  loadStaplesFromJson,
  tagOnboardingPickGroup,
  loadGroupConfig,
  STAPLES_PATH,
  GROUPS_PATH,
};
