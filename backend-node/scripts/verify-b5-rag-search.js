/* eslint-disable no-console */
/**
 * Block B5 verification — pgvector RAG search (internal API service layer).
 *
 *   node scripts/verify-b5-rag-search.js
 */
require('dotenv').config();
const { searchKnowledge } = require('../src/lib/rag/pgvectorSearch');
const { isEmbeddingsConfigured, providerInfo } = require('../src/services/embeddingsProvider');
const { getPrisma } = require('./lib/pgvectorIngest');

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

const CASES = [
  {
    name: 'L2 exercise',
    query: 'bench press chest alternative',
    levels: ['L2_EXERCISE'],
    expectLevel: 'L2_EXERCISE',
  },
  {
    name: 'L3 nutrition',
    query: 'high protein chicken breast',
    levels: ['L3_NUTRITION'],
    expectLevel: 'L3_NUTRITION',
  },
  {
    name: 'L1 platform',
    query: 'Taqwin onboarding and diet plan',
    levels: ['L1_INTERNAL'],
    expectLevel: 'L1_INTERNAL',
  },
  {
    name: 'L5 books',
    query: 'three laws of muscle growth progressive overload',
    levels: ['L5_BOOKS'],
    expectLevel: 'L5_BOOKS',
  },
];

async function main() {
  console.log('Block B5 — pgvector RAG search verification');
  console.log(`DB: ${dbUrl.replace(/:[^:@/]+@/, ':***@').replace(/\?(.*)$/, '')}\n`);

  let failed = false;
  const prisma = getPrisma();

  const embedded = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM knowledge_chunks WHERE embedding IS NOT NULL
  `;
  const embedCount = embedded[0]?.n ?? 0;
  if (!embedCount) {
    console.error('✗ No embedded chunks — run rag:ingest:l1/l2/l3 first');
    process.exit(1);
  }
  console.log(`✓ ${embedCount} embedded chunk(s) in Postgres`);

  if (!isEmbeddingsConfigured()) {
    console.error('✗ Embeddings provider not configured (OPENAI_API_KEY / VOYAGE / Ollama)');
    process.exit(1);
  }
  const { provider, model } = providerInfo();
  console.log(`✓ Embed provider: ${provider} (${model})\n`);

  for (const testCase of CASES) {
    try {
      const { results } = await searchKnowledge({
        query: testCase.query,
        levels: testCase.levels,
        limit: 5,
      });

      if (!results.length) {
        console.error(`✗ ${testCase.name}: no results for "${testCase.query}"`);
        failed = true;
        continue;
      }

      const top = results[0];
      if (top.level !== testCase.expectLevel) {
        console.error(
          `✗ ${testCase.name}: expected level ${testCase.expectLevel}, got ${top.level}`
        );
        failed = true;
        continue;
      }

      if (!Number.isFinite(top.score) || top.score <= 0) {
        console.error(`✗ ${testCase.name}: invalid score ${top.score}`);
        failed = true;
        continue;
      }

      console.log(`✓ ${testCase.name}: ${results.length} hit(s), top="${top.title}" score=${top.score.toFixed(3)}`);
    } catch (err) {
      console.error(`✗ ${testCase.name}: ${err.message}`);
      failed = true;
    }
  }

  await prisma.$disconnect();
  console.log(failed ? '\nFAILED' : '\nBlock B5 verification passed.');
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
