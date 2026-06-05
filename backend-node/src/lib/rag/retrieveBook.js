/**
 * Coaching-book retrieval — Phase 7 (keyword + tag overlap).
 *
 * Reads the MongoDB `book_chunks` collection populated by
 * `scripts/ingest-coaching-book.js`. Scoring is intentionally cheap:
 *   +3 per tag overlap with the user/onboarding flags
 *   +2 per topic word that appears in the chat message
 *   +1 per body keyword hit
 *
 * Phase 8 swaps this for vector-similarity reranking while keeping the same
 * function signature.
 *
 * Returns plain objects: `{ topic, tags, text, score }`.
 */
const { isMongoConfigured, connectMongo } = require('../../db/mongo/client');
const { logger } = require('../logger');
const vectorSearch = require('./vectorSearch');

function uniqueLower(arr) {
  return Array.from(new Set((arr || []).map((s) => String(s).toLowerCase()))).filter(Boolean);
}

function tokenize(text) {
  if (!text) return [];
  return uniqueLower(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && w.length < 24)
  );
}

function buildContextTags({ onboardingData, profile }) {
  const od = onboardingData || profile?.onboardingData || {};
  const tags = [];
  if (od.religiousDiet && od.religiousDiet !== 'none') tags.push(od.religiousDiet);
  if (od.dietType) tags.push(od.dietType);
  if (Array.isArray(od.injuries)) {
    for (const i of od.injuries) if (i && i !== 'none') tags.push(i);
  }
  if (od.fitnessLevel) tags.push(od.fitnessLevel);
  if (profile?.fitnessLevel) tags.push(profile.fitnessLevel);
  if (od.foodBudget) tags.push(od.foodBudget);
  if (od.workoutLocation) tags.push(od.workoutLocation);
  const goal = String(profile?.fitnessGoal || od.primaryGoal || '').toLowerCase();
  if (goal.includes('lose') || goal.includes('fat')) tags.push('fat-loss', 'lose-weight', 'deficit');
  if (goal.includes('muscle') || goal.includes('build')) tags.push('hypertrophy', 'muscle');
  if (goal.includes('endurance')) tags.push('endurance', 'cardio');
  return uniqueLower(tags);
}

function scoreChunk(chunk, contextTags, messageTokens) {
  let score = 0;
  const chunkTags = uniqueLower(chunk.tags || []);
  for (const t of contextTags) if (chunkTags.includes(t)) score += 3;

  if (messageTokens.length) {
    const topicLower = String(chunk.topic || '').toLowerCase();
    const textLower = String(chunk.text || '').toLowerCase().slice(0, 1200);
    for (const tok of messageTokens) {
      if (topicLower.includes(tok)) score += 2;
      else if (textLower.includes(tok)) score += 1;
    }
  }
  return score;
}

async function loadModel() {
  if (!isMongoConfigured()) return null;
  try {
    await connectMongo();
  } catch (err) {
    logger.warn({ err: err.message }, 'mongo connect failed for retrieveBook');
    return null;
  }
  return require('../../db/mongo/models/bookChunk');
}

/**
 * @param {object} args
 * @param {object} [args.onboardingData]
 * @param {object} [args.profile]
 * @param {string} [args.message]    free-text query (e.g. last user chat message)
 * @param {number} [args.limit=4]
 * @returns {Promise<Array<{ topic:string, tags:string[], text:string, score:number }>>}
 */
async function retrieveBookChunks({
  onboardingData,
  profile,
  message = '',
  limit = 4,
} = {}) {
  const BookChunk = await loadModel();
  if (!BookChunk) return [];

  const contextTags = buildContextTags({ onboardingData, profile });
  const messageTokens = tokenize(message);

  // Vector reranking path (Atlas + embeddings provider). When enabled and the
  // user has a meaningful query, this gives semantic matches that keyword
  // search would miss. Falls back transparently.
  if (vectorSearch.isEnabled() && (message?.length > 12 || contextTags.length)) {
    try {
      const query = [message || '', ...contextTags].filter(Boolean).join(' ').trim();
      const vec = await vectorSearch.rerankBookChunks({ message: query, limit });
      if (vec && vec.length) {
        return vec.map((c) => ({
          topic: c.topic,
          tags: c.tags || [],
          text: c.text,
          score: typeof c.score === 'number' ? c.score : 0,
        }));
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'book vector rerank failed');
    }
  }

  // Pull a generous candidate set keyed on tag overlap; if nothing, fall back to
  // a broad fetch and rank in-memory.
  let candidates = [];
  if (contextTags.length) {
    candidates = await BookChunk.find({ tags: { $in: contextTags } })
      .limit(40)
      .lean();
  }
  if (candidates.length < limit * 2) {
    const more = await BookChunk.find({}).limit(50).lean();
    const seen = new Set(candidates.map((c) => String(c._id)));
    for (const m of more) if (!seen.has(String(m._id))) candidates.push(m);
  }

  const ranked = candidates
    .map((c) => ({
      _id: c._id,
      topic: c.topic,
      tags: c.tags || [],
      text: c.text,
      score: scoreChunk(c, contextTags, messageTokens),
    }))
    .filter((c) => c.score > 0 || !contextTags.length) // keep all when we have no context tags
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked;
}

function formatBookChunkForPrompt(c) {
  return `[${c.topic}] ${c.text}`;
}

module.exports = {
  retrieveBookChunks,
  formatBookChunkForPrompt,
  buildContextTags,
};
