import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { parseMemoriesJson } = requireFromHere('../src/lib/ai/memoryPipeline');
const { isSemanticMemoryKey } = requireFromHere('../src/lib/ai/aiMemoryKeys');

describe('memoryPipeline', () => {
  it('parseMemoriesJson extracts memories array', () => {
    const raw = '{"memories":[{"key":"diet_preferences","summary":"Avoids dairy","confidence":0.9}]}';
    const items = parseMemoriesJson(raw);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('diet_preferences');
    expect(isSemanticMemoryKey('diet_preferences')).toBe(true);
  });

  it('parseMemoriesJson handles markdown wrapper', () => {
    const raw = 'Here is JSON:\n{"memories":[{"key":"goals_mentioned","summary":"Wants muscle","confidence":0.8}]}';
    const items = parseMemoriesJson(raw);
    expect(items[0].key).toBe('goals_mentioned');
  });
});
