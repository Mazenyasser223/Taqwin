/**
 * Block E4 — strict semantic AiMemory key schema for CAG (production pipeline).
 *
 * Only these keys may be written or loaded into context bundles. Ephemeral
 * last_* tool shortcuts are no longer persisted.
 */
const SEMANTIC_MEMORY_KEYS = new Set([
  'diet_preferences',
  'training_constraints',
  'injury_notes',
  'goals_mentioned',
  'chat_context_summary',
]);

const SEMANTIC_MEMORY_KEY_LIST = [...SEMANTIC_MEMORY_KEYS];

function isSemanticMemoryKey(key) {
  return SEMANTIC_MEMORY_KEYS.has(String(key || '').trim());
}

/**
 * Rank semantic memories for CAG — higher confidence first within same key tier.
 * @param {Array<{ key?: string, summary?: string, confidence?: number }>} memories
 * @param {number} [limit]
 */
function prioritizeAiMemories(memories, limit = 10) {
  if (!Array.isArray(memories) || !memories.length) return [];
  return [...memories]
    .filter((m) => m && m.summary && isSemanticMemoryKey(m.key))
    .sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0))
    .slice(0, limit);
}

module.exports = {
  SEMANTIC_MEMORY_KEYS,
  SEMANTIC_MEMORY_KEY_LIST,
  isSemanticMemoryKey,
  prioritizeAiMemories,
};
