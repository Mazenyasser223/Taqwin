/**
 * Build the FOOD CONTEXT block for the AI coach.
 *
 * Primary path (Phase 4): RAG-lite against the local Postgres food tables —
 * allergy/budget-safe foods are pulled with `lib/rag/retrieveFoods.js`.
 * Secondary path: FatSecret/FDC search for English-only queries when the
 * local DB returns nothing (rare; only on first-day deployments).
 */
const fdc = require('../services/fdcService');
const translate = require('../services/translateService');
const { logger } = require('./logger');
const { retrieveFoods } = require('./rag/retrieveFoods');

const GOAL_QUERIES = {
  lose: ['chicken breast', 'lentils', 'egg white', 'cucumber', 'fish'],
  muscle: ['chicken breast', 'rice cooked', 'eggs', 'beef lean', 'oats'],
  maintain: ['chicken', 'rice', 'eggs', 'lentils', 'yogurt'],
  default: ['chicken', 'rice', 'eggs', 'lentils', 'beans'],
};

const GOAL_PRESET = {
  lose: { macroPreset: 'highProtein', sort: 'protein' },
  muscle: { macroPreset: 'highProtein', sort: 'protein' },
  maintain: { macroPreset: 'none', sort: 'name' },
  default: { macroPreset: 'none', sort: 'name' },
};

function goalBucket(profile, onboarding) {
  const g = `${profile?.fitnessGoal || ''} ${onboarding?.primaryGoal || ''}`.toLowerCase();
  if (g.includes('lose') || g.includes('weight') || g.includes('fat')) return 'lose';
  if (g.includes('muscle') || g.includes('build')) return 'muscle';
  return 'maintain';
}

function formatDbFoodLine(f) {
  const idHint = f.source === 'foodItem' ? `foodItemId:${f.id}` : `webtebId:${f.webtebId}`;
  const display = f.nameAr ? `${f.name} (${f.nameAr})` : f.name;
  return (
    `- ${display} | ${idHint} | ${Math.round(f.calories)} kcal/100g | ` +
    `P${Math.round(f.protein)}g C${Math.round(f.carbs)}g F${Math.round(f.fat)}g`
  );
}

function formatFoodLine(f) {
  return (
    `- ${f.name}` +
    (f.fdcId ? ` | fdcId:${f.fdcId}` : '') +
    ` | ${Math.round(f.calories)} kcal/100g` +
    ` | P${Math.round(f.protein)}g C${Math.round(f.carbs)}g F${Math.round(f.fat)}g`
  );
}

function dedupeFoods(foods) {
  const seen = new Set();
  const out = [];
  for (const f of foods) {
    const key = f.fdcId || f.name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/**
 * @param {{ profile: object|null, onboarding: object, messages: Array<{role:string,content:string}>, lang: 'en'|'ar', force?: boolean }}
 */
async function buildCoachFoodContext({ profile, onboarding, messages, lang, force = false }) {
  const { needsFoodContext } = require('./coachContext');
  if (!force && !needsFoodContext(messages)) {
    return '';
  }

  // Primary path: filtered foods from our own DB. Honors allergies + budget.
  let dbFoods = [];
  try {
    dbFoods = await retrieveFoods({
      onboardingData: onboarding || profile?.onboardingData || {},
      limit: 24,
    });
  } catch (err) {
    logger.warn({ err }, 'coach food DB retrieval failed');
  }

  if (dbFoods.length) {
    return dbFoods.map(formatDbFoodLine).join('\n');
  }

  // Fallback: FDC search (only when local DB is empty — typically first deploy)
  if (!fdc.isConfigured()) {
    return '(Food database not configured on server — suggest generic Egyptian foods without fdcId.)';
  }

  const bucket = goalBucket(profile, onboarding);
  const queries = GOAL_QUERIES[bucket] || GOAL_QUERIES.default;
  const preset = GOAL_PRESET[bucket] || GOAL_PRESET.default;

  const collected = [];

  try {
    const searches = await Promise.all(
      queries.slice(0, 4).map((q) =>
        fdc.searchFoods({ query: q, pageSize: 8, pageNumber: 1 }).catch(() => ({ foods: [] }))
      )
    );
    for (const r of searches) collected.push(...(r.foods || []));

    const filtered = await fdc
      .searchFoodsFiltered({
        query: 'chicken egg rice lentil',
        pageSize: 12,
        filterQuery: { macroPreset: preset.macroPreset, sort: preset.sort },
        usdaStartPage: 1,
      })
      .catch(() => ({ foods: [] }));
    collected.push(...(filtered.foods || []));
  } catch (err) {
    logger.warn({ err }, 'coach food FDC fetch failed');
    return '(Food search temporarily unavailable — use foods from user logs or common local staples.)';
  }

  let foods = dedupeFoods(collected).slice(0, 24);

  if (lang === 'ar' && foods.length) {
    try {
      foods = await translate.localizeFoodPreviews(foods, 'ar');
    } catch {
      /* keep English names */
    }
  }

  if (!foods.length) {
    return '(No foods returned from database — use common Egyptian staples: فول، بيض، فراخ، أرز، زبادي.)';
  }

  return foods.map(formatFoodLine).join('\n');
}

module.exports = { buildCoachFoodContext, goalBucket };
