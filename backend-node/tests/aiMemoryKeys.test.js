import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  prioritizeAiMemories,
  SEMANTIC_MEMORY_KEYS,
  isSemanticMemoryKey,
} = requireFromHere('../src/lib/ai/aiMemoryKeys');

describe('aiMemoryKeys', () => {
  it('prioritizeAiMemories keeps only semantic keys', () => {
    const memories = [
      { key: 'last_log_food', summary: 'Last meal: rice', confidence: 0.9 },
      { key: 'diet_preferences', summary: 'Avoids dairy', confidence: 0.8 },
      { key: 'last_set_life_mode', summary: 'Life mode: travel', confidence: 0.85 },
      { key: 'injury_notes', summary: 'Shoulder pain when pressing', confidence: 0.7 },
    ];
    const ordered = prioritizeAiMemories(memories, 10);
    expect(ordered).toHaveLength(2);
    expect(ordered[0].key).toBe('diet_preferences');
    expect(ordered[1].key).toBe('injury_notes');
  });

  it('prioritizeAiMemories ranks by confidence within semantic keys', () => {
    const memories = [
      { key: 'goals_mentioned', summary: 'Build muscle', confidence: 0.6 },
      { key: 'diet_preferences', summary: 'Avoids dairy', confidence: 0.9 },
    ];
    const ordered = prioritizeAiMemories(memories, 10);
    expect(ordered[0].key).toBe('diet_preferences');
    expect(ordered[1].key).toBe('goals_mentioned');
  });

  it('SEMANTIC_MEMORY_KEYS includes chat_context_summary', () => {
    expect(SEMANTIC_MEMORY_KEYS.has('chat_context_summary')).toBe(true);
  });

  it('isSemanticMemoryKey rejects ephemeral last_* keys', () => {
    expect(isSemanticMemoryKey('diet_preferences')).toBe(true);
    expect(isSemanticMemoryKey('last_log_food')).toBe(false);
  });
});
