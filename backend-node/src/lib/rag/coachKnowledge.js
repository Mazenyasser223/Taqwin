/**
 * Unified coach RAG for Node path — philosophy (L5) + intent levels via pgvector.
 */
const { searchKnowledge } = require('./pgvectorSearch');
const { isEmbeddingsConfigured } = require('../../services/embeddingsProvider');
const { logger } = require('../logger');

const L5 = 'L5_BOOKS';
const L1 = 'L1_INTERNAL';
const L2 = 'L2_EXERCISE';
const L3 = 'L3_NUTRITION';

const DISPLAY_ORDER = { L5_BOOKS: 0, L1_INTERNAL: 1, L2_EXERCISE: 2, L3_NUTRITION: 3, L4_SCIENTIFIC: 4 };

const FOOD_RE =
  /\b(diet|meal|nutrition|macro|calorie|food|protein|carb|خطة|دايت|أكل|اكل|وجبات|غذاء|سعرات|بروتين|فطار|غدا|عشا|تغذية)\b/i;
const WORKOUT_RE =
  /\b(workout|exercise|training|bench|squat|deadlift|rep|set|gym|تمرين|تمارين|برنامج|بديل|كتف|صدر|ظهر|رجل)\b/i;
const PLATFORM_RE =
  /\b(taqwin|تكوين|onboarding|app|dashboard|log food|تسجيل|المنصة|التطبيق|كيف\s*أستخدم)\b/i;

function inferLevels(message) {
  const m = String(message || '');
  const levels = [L5];
  if (PLATFORM_RE.test(m)) levels.push(L1);
  if (WORKOUT_RE.test(m)) levels.push(L2);
  if (FOOD_RE.test(m)) levels.push(L3);
  if (levels.length === 1) levels.push(L1);
  return [...new Set(levels)];
}

function sortHits(hits) {
  return [...hits].sort((a, b) => {
    const oa = DISPLAY_ORDER[a.level] ?? 9;
    const ob = DISPLAY_ORDER[b.level] ?? 9;
    if (oa !== ob) return oa - ob;
    return (b.score || 0) - (a.score || 0);
  });
}

function formatHit(hit, locale) {
  const title = hit.title || 'Knowledge';
  const score = hit.score != null ? ` (relevance ${Number(hit.score).toFixed(2)})` : '';
  let body = String(hit.content || '').trim();
  if (body.length > 1400) body = `${body.slice(0, 1400)}…`;
  const cite =
    hit.level === L5
      ? locale === 'ar'
        ? `[مرجع كتاب: ${title}]`
        : `[Book: ${title}]`
      : '';
  return [cite, body].filter(Boolean).join('\n');
}

/**
 * @param {{ query: string, locale?: 'en'|'ar', levels?: string[], philosophyLimit?: number, perLevelLimit?: number }}
 */
async function retrieveCoachKnowledge({
  query,
  locale = 'ar',
  levels,
  philosophyLimit = 5,
  perLevelLimit = 6,
}) {
  if (!isEmbeddingsConfigured() || !String(query || '').trim()) {
    return { bookContext: '', domainContext: '', hits: [] };
  }

  const levelList = levels && levels.length ? levels : inferLevels(query);
  const hits = [];

  try {
    const phil = await searchKnowledge({
      query,
      levels: [L5],
      limit: philosophyLimit,
    });
    hits.push(...(phil.results || []));
  } catch (err) {
    logger.warn({ err }, 'coach L5 search failed');
  }

  for (const level of levelList) {
    if (level === L5) continue;
    try {
      const res = await searchKnowledge({ query, levels: [level], limit: perLevelLimit });
      hits.push(...(res.results || []));
    } catch (err) {
      logger.warn({ err, level }, 'coach level search failed');
    }
  }

  const seen = new Set();
  const unique = [];
  for (const h of sortHits(hits)) {
    const key = h.chunkId || `${h.level}:${h.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(h);
  }

  const bookParts = [];
  const domainParts = [];
  for (const h of unique) {
    const block = formatHit(h, locale);
    if (h.level === L5) bookParts.push(block);
    else domainParts.push(`### ${h.level} — ${h.title}\n${block}`);
  }

  return {
    bookContext: bookParts.join('\n\n'),
    domainContext: domainParts.join('\n\n'),
    hits: unique,
  };
}

module.exports = { retrieveCoachKnowledge, inferLevels, L5, L1, L2, L3 };
