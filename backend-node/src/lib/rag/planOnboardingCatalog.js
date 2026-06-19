/**
 * Diet & workout questionnaire catalog picks → plan-generation whitelist (first retrieve).
 * Maps onboarding CatalogPickItem rows to WebTeb / foodItem / exercise library rows.
 */
const { prisma } = require('../../db');
const { normaliseFoodRow, filterFoodCandidates } = require('./catalogFood');
const {
  normaliseExerciseRow,
  filterExerciseCandidates,
  scoreExerciseRow,
} = require('./catalogExercise');

/** Diet questionnaire steps that store preferred foods (catalogPicker). */
const DIET_FOOD_PREF_FIELDS = [
  'proteinPrefs',
  'carbPrefs',
  'fatPrefs',
  'fruitPrefs',
  'dairyPrefs',
];

/** Workout questionnaire steps that store preferred exercises. */
const WORKOUT_EXERCISE_PREF_FIELDS = ['exercisesLove'];

function asPickArray(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean);
}

function pickLabel(item) {
  if (typeof item === 'string') return item.trim() || null;
  if (!item || typeof item !== 'object') return null;
  return (
    item.nameEn ||
    item.displayName ||
    item.name ||
    item.nameAr ||
    item.label ||
    null
  );
}

function pickCatalogKind(item) {
  if (typeof item === 'object' && item && typeof item.catalog === 'string') {
    return item.catalog;
  }
  return null;
}

/** Collect unique food picks from all diet questionnaire catalog steps. */
function extractOnboardingFoodPicks(onboardingData = {}) {
  const od = onboardingData && typeof onboardingData === 'object' ? onboardingData : {};
  const seen = new Set();
  const out = [];

  for (const field of DIET_FOOD_PREF_FIELDS) {
    for (const item of asPickArray(od[field])) {
      if (pickCatalogKind(item) === 'exercise') continue;
      const name = pickLabel(item);
      const webtebId = Number(typeof item === 'object' ? item?.id ?? item?.webtebId : NaN);
      const key =
        Number.isFinite(webtebId) && webtebId > 0
          ? `w:${Math.floor(webtebId)}`
          : name
            ? `n:${String(name).toLowerCase()}`
            : null;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        field,
        name: name || null,
        webtebId: Number.isFinite(webtebId) && webtebId > 0 ? Math.floor(webtebId) : null,
      });
    }
  }

  return out;
}

/** Collect unique exercise picks from workout questionnaire catalog steps. */
function extractOnboardingExercisePicks(onboardingData = {}) {
  const od = onboardingData && typeof onboardingData === 'object' ? onboardingData : {};
  const seen = new Set();
  const out = [];

  for (const field of WORKOUT_EXERCISE_PREF_FIELDS) {
    for (const item of asPickArray(od[field])) {
      if (pickCatalogKind(item) === 'food') continue;
      const name = pickLabel(item);
      const id = typeof item === 'object' && item?.id ? String(item.id).trim() : null;
      const key = id && id.length >= 8 ? `id:${id}` : name ? `n:${String(name).toLowerCase()}` : null;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        field,
        id: id && id.length >= 8 ? id : null,
        name: name || null,
      });
    }
  }

  return out;
}

async function loadOnboardingFoodCatalog({ onboardingData = {}, locale } = {}) {
  const picks = extractOnboardingFoodPicks(onboardingData);
  if (!picks.length) return [];

  const webtebIds = picks.map((p) => p.webtebId).filter((id) => Number.isFinite(id) && id > 0);
  const names = picks.map((p) => p.name).filter(Boolean);

  const [webtebRows, foodItems] = await Promise.all([
    webtebIds.length
      ? prisma.webtebFood.findMany({
          where: { webtebId: { in: webtebIds } },
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
        })
      : [],
    names.length
      ? prisma.foodItem.findMany({
          where: {
            isPublic: true,
            OR: names.slice(0, 40).map((name) => ({
              name: { contains: String(name).slice(0, 80), mode: 'insensitive' },
            })),
          },
          take: 80,
          select: {
            id: true,
            webtebId: true,
            name: true,
            category: true,
            calories: true,
            protein: true,
            carbs: true,
            fat: true,
          },
        })
      : [],
  ]);

  const byWebtebId = new Map(webtebRows.map((r) => [r.webtebId, r]));
  const rows = [];
  const seen = new Set();

  for (const pick of picks) {
    let row = null;
    if (pick.webtebId && byWebtebId.has(pick.webtebId)) {
      const r = byWebtebId.get(pick.webtebId);
      row = normaliseFoodRow(
        {
          id: r.id,
          webtebId: r.webtebId,
          name:
            locale === 'ar'
              ? r.nameAr || r.nameEn
              : r.nameEn || r.nameAr,
          nameAr: r.nameAr,
          category: r.categorySlug,
          calories: r.calories,
          protein: r.protein,
          carbs: r.carbs,
          fat: r.fat,
        },
        'webteb',
      );
    } else if (pick.name) {
      const lower = String(pick.name).toLowerCase();
      const fi = foodItems.find((f) => String(f.name).toLowerCase().includes(lower));
      if (fi) row = normaliseFoodRow(fi, 'foodItem');
    }

    if (!row) continue;
    const key = row.webtebId ? `w${row.webtebId}` : `fi:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ ...row, _onboardingPick: true, score: 100 });
  }

  return filterFoodCandidates(rows, onboardingData);
}

async function loadOnboardingExerciseCatalog({ onboardingData = {}, profile } = {}) {
  const picks = extractOnboardingExercisePicks(onboardingData);
  if (!picks.length) return [];

  const ids = picks.map((p) => p.id).filter(Boolean);
  const names = picks.map((p) => p.name).filter(Boolean);

  const [byIdRows, nameRows] = await Promise.all([
    ids.length
      ? prisma.exercise.findMany({
          where: { id: { in: ids }, isPublic: true },
          select: {
            id: true,
            name: true,
            nameAr: true,
            category: true,
            difficulty: true,
            primaryMuscles: true,
          },
        })
      : [],
    names.length
      ? prisma.exercise.findMany({
          where: {
            isPublic: true,
            OR: names.slice(0, 24).map((name) => ({
              name: { contains: String(name).slice(0, 80), mode: 'insensitive' },
            })),
          },
          take: 80,
          select: {
            id: true,
            name: true,
            nameAr: true,
            category: true,
            difficulty: true,
            primaryMuscles: true,
          },
        })
      : [],
  ]);

  const byId = new Map(byIdRows.map((r) => [r.id, r]));
  const rows = [];
  const seen = new Set();

  for (const pick of picks) {
    let raw = pick.id ? byId.get(pick.id) : null;
    if (!raw && pick.name) {
      const lower = String(pick.name).toLowerCase();
      raw =
        nameRows.find((r) => String(r.name).toLowerCase().includes(lower)) ||
        nameRows.find((r) => lower.includes(String(r.name).toLowerCase()));
    }
    if (!raw) continue;
    if (seen.has(raw.id)) continue;
    seen.add(raw.id);
    const scored = scoreExerciseRow(normaliseExerciseRow(raw), { onboardingData, profile });
    rows.push({ ...scored, score: (scored.score || 0) + 100, _onboardingPick: true });
  }

  return filterExerciseCandidates(
    rows.map(({ _vectorScore, ...rest }) => rest),
    { onboardingData, profile },
  );
}

module.exports = {
  DIET_FOOD_PREF_FIELDS,
  WORKOUT_EXERCISE_PREF_FIELDS,
  extractOnboardingFoodPicks,
  extractOnboardingExercisePicks,
  loadOnboardingFoodCatalog,
  loadOnboardingExerciseCatalog,
};
