/**
 * Unified RAG retrieval — single public entry for chat (semantic) and plan (catalog).
 *
 *   ragRetrieve({ purpose: 'chat' | 'coach_catalog' | 'coach_philosophy' | 'coach_platform', ... })
 *   ragRetrieve({ purpose: 'plan_catalog', kind: 'food'|'exercise'|'book', ... })
 *
 * Low-level vector search: pgvectorSearch.searchKnowledge
 * HTTP: POST /api/internal/ai/rag/search → ragRetrieve({ purpose: 'chat', ... })
 */
const { prisma } = require('../../db');
const crypto = require('crypto');
const { logger } = require('../logger');
const { redisGetJson, redisSetJson } = require('../redis');
const { searchKnowledge } = require('./pgvectorSearch');
const { isEmbeddingsConfigured } = require('../../services/embeddingsProvider');
const { isSqlFallbackEnabled } = require('./ragConfig');
const { synthesizePlanQuery } = require('./ragQuery');
const {
  formatFoodLineForPrompt,
  formatExerciseLineForPrompt,
  formatBookChunkForPrompt,
} = require('./ragFormat');
const {
  retrieveFoodsSql,
  applyFoodRanking,
  filterFoodCandidates,
  normaliseFoodRow,
} = require('./catalogFood');
const {
  retrieveExercisesSql,
  scoreExerciseRow,
  filterExerciseCandidates,
} = require('./catalogExercise');

const LEVEL_BY_KIND = {
  food: ['L3_NUTRITION'],
  exercise: ['L2_EXERCISE'],
  book: ['L5_BOOKS'],
};

const COACH_PURPOSES = new Set(['chat', 'coach_catalog', 'coach_philosophy', 'coach_platform']);

/** Tier 3 — domain retrieval mode defaults. */
const PURPOSE_DEFAULTS = {
  chat: { hybrid: true, expandParents: true, localeBoost: false },
  coach_catalog: { hybrid: true, expandParents: false, localeBoost: false },
  coach_philosophy: { hybrid: false, expandParents: true, localeBoost: false },
  coach_platform: { hybrid: true, expandParents: false, localeBoost: true },
};

const RAG_CACHE_TTL_MS = Number(process.env.RAG_CACHE_TTL_MS || 5 * 60 * 1000);

function ragCacheKey({ userId, query, levels, limit, locale, minScore, metadataFilters }) {
  const raw = JSON.stringify({
    userId: userId || '',
    query,
    levels,
    limit,
    locale,
    minScore,
    metadataFilters: metadataFilters || null,
  });
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
  return `rag:hit:${hash}`;
}

/**
 * @typedef {object} RagTrace
 * @property {'chat'|'plan_catalog'|'coach_catalog'|'coach_philosophy'|'coach_platform'} purpose
 * @property {'semantic'|'catalog'} mode
 * @property {string|null} kind
 * @property {string|null} path vector|sql|vector+sql|empty|error|hybrid_rrf|cache_hit
 * @property {string|null} query
 * @property {string[]} levels
 * @property {number} hitCount
 * @property {number} [latencyMs]
 * @property {number} [avgScore]
 * @property {string|null} fallback sql_only|embeddings_not_configured|vector_error|...
 * @property {string|null} [traceId]
 */

function resolvePurposeDefaults(purpose) {
  return PURPOSE_DEFAULTS[purpose] || PURPOSE_DEFAULTS.chat;
}

function buildTrace(base) {
  const purpose = base.purpose || (base.mode === 'catalog' ? 'plan_catalog' : 'chat');
  const mode = purpose === 'plan_catalog' ? 'catalog' : 'semantic';
  return {
    traceId: base.traceId || null,
    purpose,
    mode,
    kind: base.kind ?? null,
    path: base.path ?? null,
    query: base.query ?? null,
    levels: base.levels || [],
    hitCount: Number(base.hitCount) || 0,
    latencyMs: Number(base.latencyMs) || 0,
    avgScore: Number(base.avgScore) || 0,
    fallback: base.fallback ?? null,
  };
}

function logRagTrace(trace, context = {}) {
  if (!trace) return;
  const level = trace.fallback && trace.path !== 'vector' ? 'warn' : 'debug';
  logger[level]({ rag: trace, ...context }, 'rag retrieve');
}

/**
 * @param {object} opts
 * @returns {Promise<{ query: string, levels: string[], limit: number, embedding: object, results: object[], trace: RagTrace }>}
 */
async function ragRetrieveSemantic({
  query,
  levels,
  limit,
  locale,
  minScore,
  metadataFilters,
  traceId,
  purpose = 'chat',
  userId,
  hybrid,
  expandParents,
  localeBoost,
} = {}) {
  const started = Date.now();
  const defaults = resolvePurposeDefaults(purpose);
  const useHybrid = hybrid !== undefined ? hybrid : defaults.hybrid;
  const useExpandParents = expandParents !== undefined ? expandParents : defaults.expandParents;
  const useLocaleBoost = localeBoost !== undefined ? localeBoost : defaults.localeBoost;

  const cacheKey = ragCacheKey({ userId, query, levels, limit, locale, minScore, metadataFilters });
  const cached = await redisGetJson(cacheKey);
  if (cached?.results && cached.query === query) {
    const avgScore =
      (cached.results || []).reduce((s, r) => s + (Number(r.score) || 0), 0) /
      Math.max(1, (cached.results || []).length);
    const trace = buildTrace({
      traceId,
      purpose,
      kind: null,
      path: cached.retrievalMode || 'vector',
      query: cached.query,
      levels: cached.levels || levels,
      hitCount: (cached.results || []).length,
      fallback: 'cache_hit',
      latencyMs: Date.now() - started,
      avgScore,
    });
    logRagTrace(trace, { userId });
    return { ...cached, items: cached.results || [], trace };
  }

  const payload = await searchKnowledge({
    query,
    levels,
    limit,
    locale,
    minScore,
    metadataFilters,
    hybrid: useHybrid,
    expandParents: useExpandParents,
    localeBoost: useLocaleBoost,
    purpose,
  });
  const results = payload.results || [];
  const avgScore =
    results.reduce((s, r) => s + (Number(r.score) || 0), 0) / Math.max(1, results.length);
  const trace = buildTrace({
    traceId,
    purpose,
    kind: null,
    path: payload.retrievalMode || 'vector',
    query: payload.query,
    levels: payload.levels,
    hitCount: results.length,
    fallback: results.length ? null : 'empty',
    latencyMs: Date.now() - started,
    avgScore,
  });
  logRagTrace(trace, { userId });
  const out = { ...payload, items: results, trace };
  await redisSetJson(cacheKey, payload, RAG_CACHE_TTL_MS).catch(() => null);
  return out;
}

async function loadFoodRowsByVectorHits(results) {
  const foodItemIds = [];
  const webtebIds = [];
  const scoreByKey = new Map();

  for (const row of results || []) {
    const meta = row.metadata || {};
    const score = typeof row.score === 'number' ? row.score : 0;
    if (meta.foodItemId) {
      foodItemIds.push(meta.foodItemId);
      scoreByKey.set(`fi:${meta.foodItemId}`, score);
    } else if (meta.foodSource === 'webteb' && meta.webtebFoodId) {
      webtebIds.push(meta.webtebFoodId);
      scoreByKey.set(`wb:${meta.webtebFoodId}`, score);
    } else if (meta.webtebId && meta.foodSource === 'webteb') {
      webtebIds.push(meta.webtebFoodId || meta.webtebId);
    }
  }

  const [items, webteb] = await Promise.all([
    foodItemIds.length
      ? prisma.foodItem.findMany({
          where: { id: { in: [...new Set(foodItemIds)] }, isPublic: true },
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
    webtebIds.length
      ? prisma.webtebFood.findMany({
          where: { id: { in: [...new Set(webtebIds)] } },
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
  ]);

  const rows = [
    ...items.map((r) => ({
      ...normaliseFoodRow(r, 'foodItem'),
      _vectorScore: scoreByKey.get(`fi:${r.id}`) ?? 0,
    })),
    ...webteb.map((r) =>
      normaliseFoodRow(
        {
          id: r.id,
          webtebId: r.webtebId,
          name: r.nameEn || r.nameAr,
          nameAr: r.nameAr,
          category: r.categorySlug,
          calories: r.calories,
          protein: r.protein,
          carbs: r.carbs,
          fat: r.fat,
        },
        'webteb'
      )
    ).map((r) => ({ ...r, _vectorScore: scoreByKey.get(`wb:${r.id}`) ?? 0 })),
  ];

  rows.sort((a, b) => (b._vectorScore || 0) - (a._vectorScore || 0));
  return rows;
}

async function loadExerciseRowsByVectorHits(results) {
  const ids = [];
  const scoreById = new Map();
  for (const row of results || []) {
    const id = row.metadata?.exerciseId;
    if (!id) continue;
    ids.push(id);
    scoreById.set(id, typeof row.score === 'number' ? row.score : 0);
  }
  if (!ids.length) return [];

  const rows = await prisma.exercise.findMany({
    where: { id: { in: [...new Set(ids)] }, isPublic: true },
    select: {
      id: true,
      name: true,
      nameAr: true,
      category: true,
      difficulty: true,
      primaryMuscles: true,
    },
  });

  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      nameAr: r.nameAr || null,
      category: r.category || '',
      difficulty: (r.difficulty || '').toLowerCase(),
      primaryMuscles: Array.isArray(r.primaryMuscles)
        ? r.primaryMuscles
        : typeof r.primaryMuscles === 'string'
          ? [r.primaryMuscles]
          : [],
      _vectorScore: scoreById.get(r.id) ?? 0,
    }))
    .sort((a, b) => (b._vectorScore || 0) - (a._vectorScore || 0));
}

function mapBookHits(results) {
  return (results || []).map((r) => ({
    topic: r.metadata?.topic || r.title,
    tags: Array.isArray(r.metadata?.tags) ? r.metadata.tags : [],
    text: r.content,
    score: typeof r.score === 'number' ? r.score : 0,
  }));
}

function dedupeFoods(a, b) {
  const seen = new Set();
  const out = [];
  for (const row of [...a, ...b]) {
    const key = row.webtebId ? `w${row.webtebId}` : `fi:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { _vectorScore, ...rest } = row;
    out.push(rest);
  }
  return out;
}

function dedupeExercises(a, b) {
  const seen = new Set();
  const out = [];
  for (const row of [...a, ...b]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const { _vectorScore, score, ...rest } = row;
    out.push({ ...rest, score: score ?? _vectorScore ?? 0 });
  }
  return out;
}

/**
 * Catalog retrieval for plan whitelist (foods, exercises, books).
 *
 * @param {object} opts
 * @param {'food'|'exercise'|'book'} opts.kind
 */
async function ragRetrieveCatalog({
  kind,
  query,
  onboardingData = {},
  profile,
  message,
  mealSlot,
  muscleGroup,
  limit = 30,
  locale,
  minScore,
  traceId,
} = {}) {
  if (!kind || !LEVEL_BY_KIND[kind]) {
    throw new Error(`catalog kind must be food, exercise, or book`);
  }

  const levels = LEVEL_BY_KIND[kind];
  const resolvedQuery =
    String(query || '').trim() ||
    synthesizePlanQuery({ kind, onboardingData, profile, message: message || '' });

  let trace = buildTrace({
    traceId,
    purpose: 'plan_catalog',
    kind,
    path: null,
    query: resolvedQuery,
    levels,
    hitCount: 0,
    fallback: null,
  });

  if (kind === 'book') {
    if (!isEmbeddingsConfigured()) {
      trace = buildTrace({
        ...trace,
        path: 'empty',
        fallback: 'embeddings_not_configured',
      });
      logRagTrace(trace, { kind });
      return { items: [], hits: [], trace };
    }
    try {
      const { results } = await searchKnowledge({
        query: resolvedQuery,
        levels,
        limit,
        locale,
        minScore,
      });
      const items = mapBookHits(results);
      trace = buildTrace({
        ...trace,
        path: 'vector',
        hitCount: items.length,
      });
      logRagTrace(trace, { kind });
      return { items, hits: results || [], trace };
    } catch (err) {
      trace = buildTrace({
        ...trace,
        path: 'empty',
        fallback: err.message || 'vector_error',
      });
      logRagTrace(trace, { kind, err: err.message });
      return { items: [], hits: [], trace };
    }
  }

  const vectorLimit = Math.min(Math.max(limit * 4, limit), 50);
  const sqlAllowed = isSqlFallbackEnabled();
  let vectorRows = [];
  let vectorHits = [];
  let vectorError = null;

  if (isEmbeddingsConfigured()) {
    try {
      const payload = await searchKnowledge({
        query: resolvedQuery,
        levels,
        limit: vectorLimit,
        locale,
        minScore,
      });
      vectorHits = payload.results || [];
      if (kind === 'food') {
        vectorRows = await loadFoodRowsByVectorHits(vectorHits);
        vectorRows = filterFoodCandidates(vectorRows, onboardingData);
      } else {
        vectorRows = await loadExerciseRowsByVectorHits(vectorHits);
        vectorRows = filterExerciseCandidates(vectorRows, { onboardingData, profile });
        vectorRows = vectorRows.map((ex) =>
          scoreExerciseRow(ex, { onboardingData, profile, muscleGroup })
        );
        vectorRows.sort(
          (a, b) =>
            (b.score || 0) - (a.score || 0) || (b._vectorScore || 0) - (a._vectorScore || 0)
        );
      }
    } catch (err) {
      vectorError = err.message || 'vector_error';
      logRagTrace(
        buildTrace({ ...trace, path: 'empty', fallback: vectorError }),
        { kind, degraded: sqlAllowed }
      );
    }
  } else {
    vectorError = 'embeddings_not_configured';
  }

  let sqlRows = [];
  if (sqlAllowed) {
    if (kind === 'food') {
      sqlRows = await retrieveFoodsSql({ onboardingData, mealSlot, limit: vectorLimit });
    } else {
      sqlRows = await retrieveExercisesSql({
        onboardingData,
        profile,
        muscleGroup,
        limit: vectorLimit,
      });
    }
  }

  let items;
  if (vectorRows.length >= limit) {
    items =
      kind === 'food'
        ? applyFoodRanking(vectorRows, { onboardingData, mealSlot, limit })
        : vectorRows.slice(0, limit).map(({ _vectorScore, ...rest }) => rest);
    trace = buildTrace({
      ...trace,
      path: 'vector',
      hitCount: items.length,
      fallback: vectorError,
    });
  } else if (vectorRows.length > 0 && sqlAllowed && sqlRows.length) {
    const merged =
      kind === 'food'
        ? dedupeFoods(
            applyFoodRanking(vectorRows, { onboardingData, mealSlot, limit: vectorLimit }),
            sqlRows
          )
        : dedupeExercises(vectorRows, sqlRows);
    items =
      kind === 'food'
        ? applyFoodRanking(merged, { onboardingData, mealSlot, limit })
        : merged.slice(0, limit);
    trace = buildTrace({
      ...trace,
      path: 'vector+sql',
      hitCount: items.length,
      fallback: vectorError,
    });
  } else if (sqlAllowed && sqlRows.length) {
    items =
      kind === 'food'
        ? applyFoodRanking(sqlRows, { onboardingData, mealSlot, limit })
        : sqlRows.slice(0, limit);
    trace = buildTrace({
      ...trace,
      path: 'sql',
      hitCount: items.length,
      fallback: 'sql_only',
    });
  } else {
    items = [];
    trace = buildTrace({
      ...trace,
      path: 'empty',
      hitCount: 0,
      fallback: vectorError || (sqlAllowed ? 'no_catalog_hits' : 'sql_fallback_disabled'),
    });
  }

  logRagTrace(trace, { kind });
  return { items, hits: vectorHits, trace };
}

/**
 * Single public RAG entry — callers use purpose, not internal mode.
 *
 * @param {object} opts
 * @param {'chat'|'plan_catalog'|'coach_catalog'|'coach_philosophy'|'coach_platform'} opts.purpose
 * @param {'food'|'exercise'|'book'|null} [opts.kind] required for plan_catalog
 */
async function ragRetrieve(opts = {}) {
  let purpose = opts.purpose;
  if (!purpose && opts.mode) {
    purpose = opts.mode === 'catalog' ? 'plan_catalog' : 'chat';
  }
  purpose = purpose || 'chat';

  if (purpose === 'plan_catalog') {
    if (!opts.kind) {
      throw new Error('ragRetrieve plan_catalog requires kind: food, exercise, or book');
    }
    return ragRetrieveCatalog({ ...opts, purpose: 'plan_catalog' });
  }

  if (!opts.levels?.length) {
    throw new Error('ragRetrieve chat/coach purposes require levels (e.g. L1_INTERNAL, L5_BOOKS)');
  }

  const coachPurpose = COACH_PURPOSES.has(purpose) ? purpose : 'chat';
  return ragRetrieveSemantic({ ...opts, purpose: coachPurpose });
}

module.exports = {
  ragRetrieve,
  ragRetrieveSemantic,
  ragRetrieveCatalog,
  buildTrace,
  logRagTrace,
  LEVEL_BY_KIND,
  COACH_PURPOSES,
  PURPOSE_DEFAULTS,
  resolvePurposeDefaults,
  formatFoodLineForPrompt,
  formatExerciseLineForPrompt,
  formatBookChunkForPrompt,
};
