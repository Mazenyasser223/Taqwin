import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  ragRetrieve,
  COACH_PURPOSES,
  resolvePurposeDefaults,
  buildTrace,
} = requireFromHere('../src/lib/rag/ragRetrieve');

describe('ragRetrieve Tier 3 purposes', () => {
  it('exports coach purpose constants', () => {
    expect(COACH_PURPOSES.has('coach_catalog')).toBe(true);
    expect(COACH_PURPOSES.has('coach_philosophy')).toBe(true);
    expect(COACH_PURPOSES.has('coach_platform')).toBe(true);
  });

  it('resolvePurposeDefaults returns hybrid for catalog', () => {
    const d = resolvePurposeDefaults('coach_catalog');
    expect(d.hybrid).toBe(true);
    expect(d.expandParents).toBe(false);
  });

  it('resolvePurposeDefaults enables parent expand for philosophy', () => {
    const d = resolvePurposeDefaults('coach_philosophy');
    expect(d.hybrid).toBe(false);
    expect(d.expandParents).toBe(true);
  });

  it('buildTrace includes latency and avgScore', () => {
    const t = buildTrace({
      purpose: 'coach_catalog',
      path: 'hybrid_rrf',
      query: 'chicken',
      levels: ['L3_NUTRITION'],
      hitCount: 3,
      latencyMs: 120,
      avgScore: 0.42,
    });
    expect(t.latencyMs).toBe(120);
    expect(t.avgScore).toBe(0.42);
    expect(t.purpose).toBe('coach_catalog');
  });

  it('requires levels for coach purposes', async () => {
    await expect(ragRetrieve({ purpose: 'coach_catalog', query: 'x' })).rejects.toThrow(/levels/);
  });
});
