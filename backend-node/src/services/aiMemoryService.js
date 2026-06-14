/**
 * Block E4 — long-term AI memory (Postgres AiMemory).
 *
 * Production policy: only SEMANTIC_MEMORY_KEYS are persisted; all writes go through
 * the summarize pipeline (memoryPipeline → ai-service LLM). Direct tool fast-paths
 * are removed — see memoryEvents.js for enqueue-only triggers.
 */
const { prisma } = require('../db');
const { invalidateContextBundle } = require('../lib/contextBundle');
const { isSemanticMemoryKey } = require('../lib/ai/aiMemoryKeys');
const { sanitizeCagString } = require('../lib/cag/sanitizeCag');

const MAX_KEY_LEN = 64;
const MAX_SUMMARY_LEN = 4000;
const CONTRADICTION_CONFIDENCE_PENALTY = 0.15;

function normalizeSummary(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function summaryWordOverlap(prev, next) {
  const words = (text) =>
    new Set(
      String(text || '')
        .split(/\s+/)
        .map((w) => w.replace(/[^a-z0-9\u0600-\u06ff]/gi, ''))
        .filter((w) => w.length > 2)
    );
  const a = words(prev);
  const b = words(next);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const w of a) {
    if (b.has(w)) overlap += 1;
  }
  return overlap / Math.max(a.size, b.size);
}

/**
 * Detect likely contradiction when replacing an existing memory for the same key.
 * Newer summary always wins; confidence is reduced when content diverges sharply.
 */
function applyConflictPolicy({ existing, incomingSummary, incomingConfidence }) {
  let confidence = Math.min(1, Math.max(0, Number(incomingConfidence) || 0.8));
  if (!existing?.summary) return confidence;

  const prev = normalizeSummary(existing.summary);
  const next = normalizeSummary(incomingSummary);
  if (!prev || !next || prev === next) return confidence;
  if (prev.includes(next) || next.includes(prev)) return confidence;
  if (summaryWordOverlap(prev, next) >= 0.5) return confidence;

  return Math.max(0.3, confidence - CONTRADICTION_CONFIDENCE_PENALTY);
}

/**
 * @param {{ userId: string, key: string, summary: string, confidence?: number, source?: string }} args
 */
async function upsertAiMemory({ userId, key, summary, confidence = 0.8, source = 'chat' }) {
  const safeKey = String(key || '').trim().slice(0, MAX_KEY_LEN);
  const safeSummary = String(
    sanitizeCagString(String(summary || '').trim(), 'memorySummary') || ''
  ).slice(0, MAX_SUMMARY_LEN);
  if (!userId || !safeKey || !safeSummary) {
    throw new Error('userId, key, and summary are required');
  }
  if (!isSemanticMemoryKey(safeKey)) {
    throw new Error(`key must be a semantic memory key, got: ${safeKey}`);
  }

  const existing = await prisma.aiMemory.findUnique({
    where: { userId_key: { userId, key: safeKey } },
    select: { summary: true, confidence: true },
  });

  const resolvedConfidence = applyConflictPolicy({
    existing,
    incomingSummary: safeSummary,
    incomingConfidence: confidence,
  });

  const row = await prisma.aiMemory.upsert({
    where: { userId_key: { userId, key: safeKey } },
    create: {
      userId,
      key: safeKey,
      summary: safeSummary,
      confidence: resolvedConfidence,
      source: String(source || 'chat').slice(0, 64),
    },
    update: {
      summary: safeSummary,
      confidence: resolvedConfidence,
      source: String(source || 'chat').slice(0, 64),
    },
  });
  void invalidateContextBundle(userId).catch(() => null);
  return row;
}

/**
 * @param {{ userId: string, keys?: string[] }} args
 */
async function readAiMemories({ userId, keys }) {
  const where = { userId };
  if (Array.isArray(keys) && keys.length) {
    where.key = {
      in: keys.map((k) => String(k).slice(0, MAX_KEY_LEN)).filter(isSemanticMemoryKey),
    };
  }
  return prisma.aiMemory.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
}

module.exports = { upsertAiMemory, readAiMemories, applyConflictPolicy };
