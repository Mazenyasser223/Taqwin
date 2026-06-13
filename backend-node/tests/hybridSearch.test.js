import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { reciprocalRankFusion, fusedToResults } = requireFromHere('../src/lib/rag/rrf');
const { buildMetadataFilterSql, buildChatMetadataFilters } = requireFromHere(
  '../src/lib/rag/metadataFilters'
);
const { buildParentChildChunks, splitWithOverlap } = requireFromHere('../scripts/lib/markdownIngest');

describe('rrf', () => {
  it('fuses vector and keyword lists with RRF', () => {
    const vector = [
      { chunkId: 'a', score: 0.9 },
      { chunkId: 'b', score: 0.8 },
      { chunkId: 'c', score: 0.7 },
    ];
    const keyword = [
      { chunkId: 'b', score: 1.0 },
      { chunkId: 'd', score: 0.9 },
      { chunkId: 'a', score: 0.85 },
    ];
    const fused = reciprocalRankFusion([vector, keyword], { k: 60 });
    expect(fused[0].chunkId).toBe('b');
    expect(fused.some((f) => f.chunkId === 'd')).toBe(true);
    const results = fusedToResults(fused);
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].retrievalSources).toContain('vector');
  });
});

describe('metadataFilters', () => {
  it('builds exercise filters from CAG', () => {
    const filters = buildChatMetadataFilters({
      intent: 'exercise_alternative',
      contextBundle: {
        profile: { fitnessLevel: 'beginner' },
        constraints: { injuries: ['shoulder'] },
        workoutToday: { exercises: [{ name: 'Bench Press', primaryMuscles: ['chest'] }] },
      },
    });
    expect(filters.difficulty).toEqual(['beginner']);
    expect(filters.primaryMuscles).toContain('chest');
  });

  it('builds nutrition filters from CAG', () => {
    const filters = buildChatMetadataFilters({
      intent: 'nutrition',
      contextBundle: {
        constraints: { dietType: 'high_protein', religiousDiet: 'halal', allergies: ['peanut'] },
      },
    });
    expect(filters.dietType).toBe('high_protein');
    expect(filters.religiousDiet).toBe('halal');
    expect(filters.excludeAllergens).toContain('peanut');
  });

  it('builds platform_help docType filter and excludes catalog', () => {
    const filters = buildChatMetadataFilters({
      intent: 'platform_help',
      locale: 'ar',
    });
    expect(filters.docType).toBe('platform');
    expect(filters.excludeTags).toEqual(['catalog', 'books']);
    const sql = buildMetadataFilterSql(filters);
    expect(sql).toContain("d.level = 'L1_INTERNAL'");
    expect(sql).toContain("docType");
    expect(sql).toContain("'catalog'");
    expect(sql).toContain("d.locale = 'ar'");
  });

  it('builds unclear intent like platform_help', () => {
    const filters = buildChatMetadataFilters({ intent: 'unclear', locale: 'en' });
    expect(filters.docType).toBe('platform');
    expect(filters.excludeTags).toEqual(['catalog', 'books']);
  });

  it('generates chunk role SQL by default', () => {
    const sql = buildMetadataFilterSql({});
    expect(sql).toContain("chunk_role IN ('child', 'standalone')");
  });
});

describe('parentChildChunks', () => {
  it('creates parent + overlapping children for long sections', () => {
    const longText = 'word '.repeat(900).trim();
    const specs = buildParentChildChunks([{ title: 'Section', text: longText }]);
    expect(specs.some((s) => s.role === 'parent')).toBe(true);
    expect(specs.filter((s) => s.role === 'child').length).toBeGreaterThan(1);
  });

  it('splitWithOverlap produces overlapping windows', () => {
    const text = 'a'.repeat(2000);
    const windows = splitWithOverlap(text, { targetChars: 600, overlapChars: 200 });
    expect(windows.length).toBeGreaterThan(2);
  });
});
