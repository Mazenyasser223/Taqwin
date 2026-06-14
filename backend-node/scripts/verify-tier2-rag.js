/* eslint-disable no-console */
/**
 * Tier 2 RAG verification — hybrid search + metadata filters + keyword match.
 *
 *   node scripts/verify-tier2-rag.js
 */
require('dotenv').config();
const { searchKnowledge } = require('../src/lib/rag/pgvectorSearch');
const { buildChatMetadataFilters } = require('../src/lib/rag/metadataFilters');
const { isEmbeddingsConfigured, providerInfo } = require('../src/services/embeddingsProvider');
const { getPrisma } = require('./lib/pgvectorIngest');

async function main() {
  console.log('Tier 2 — hybrid RAG verification\n');

  if (!isEmbeddingsConfigured()) {
    console.error('✗ Embeddings not configured');
    process.exit(1);
  }

  const prisma = getPrisma();
  const { provider, model } = providerInfo();
  console.log(`✓ Embed: ${provider} (${model})`);

  const cols = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM knowledge_chunks WHERE search_vector IS NOT NULL) AS sv,
      (SELECT COUNT(*)::int FROM knowledge_chunks WHERE chunk_role IS NOT NULL) AS roles,
      (SELECT COUNT(*)::int FROM knowledge_chunks WHERE embedding IS NOT NULL) AS embedded
  `;
  const { sv, roles, embedded } = cols[0];
  console.log(`✓ Chunks: ${embedded} embedded, ${sv} with search_vector, ${roles} with chunk_role\n`);

  let failed = false;

  // Hybrid vector + keyword (semantic)
  const hybrid = await searchKnowledge({
    query: 'high protein breakfast',
    levels: ['L3_NUTRITION'],
    limit: 5,
    hybrid: true,
  });
  if (hybrid.retrievalMode !== 'hybrid_rrf') {
    console.error(`✗ Expected hybrid_rrf, got ${hybrid.retrievalMode}`);
    failed = true;
  } else if (!hybrid.results.length) {
    console.error('✗ Hybrid nutrition search returned no results');
    failed = true;
  } else {
    console.log(`✓ Hybrid search: ${hybrid.results.length} hit(s), mode=${hybrid.retrievalMode}, top score=${hybrid.results[0].score.toFixed(3)}`);
  }

  // Metadata-aware exercise filter
  const meta = buildChatMetadataFilters({
    intent: 'exercise_alternative',
    contextBundle: {
      profile: { fitnessLevel: 'beginner' },
      workoutToday: { exercises: [{ name: 'Bench Press', primaryMuscles: ['chest'] }] },
    },
  });
  const filtered = await searchKnowledge({
    query: 'bench press alternative',
    levels: ['L2_EXERCISE'],
    limit: 5,
    metadataFilters: meta,
    hybrid: true,
  });
  if (!filtered.results.length) {
    console.error('✗ Metadata-filtered exercise search returned no results');
    failed = true;
  } else {
    console.log(`✓ Metadata filters: ${filtered.results.length} exercise hit(s)`);
  }

  // Exact Arabic / name keyword path (trigram/FTS)
  const keyword = await searchKnowledge({
    query: 'bench press',
    levels: ['L2_EXERCISE'],
    limit: 3,
    hybrid: true,
  });
  const hasBench = keyword.results.some((r) => /bench/i.test(r.title || r.content));
  if (!hasBench) {
    console.error('✗ Keyword path: expected bench press in results');
    failed = true;
  } else {
    console.log('✓ Keyword/trigram path: bench press found');
  }

  await prisma.$disconnect();
  console.log(failed ? '\n✗ Tier 2 verification FAILED' : '\n✓ Tier 2 verification PASSED');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
