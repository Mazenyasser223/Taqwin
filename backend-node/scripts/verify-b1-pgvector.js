/* eslint-disable no-console */
/**
 * Block B1 verification — pgvector extension, embedding column, HNSW index.
 *
 *   node scripts/verify-b1-pgvector.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const EMBED_DIMS = 1536;
const INDEX_NAME = 'knowledge_chunks_embedding_hnsw_idx';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Set DIRECT_URL or DATABASE_URL in backend-node/.env');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

function zeroVectorLiteral() {
  return `[${Array(EMBED_DIMS).fill(0).join(',')}]`;
}

async function main() {
  console.log('Block B1 — pgvector verification');
  console.log(`DB: ${dbUrl.replace(/:[^:@/]+@/, ':***@').replace(/\?(.*)$/, '')}\n`);

  let failed = false;

  const ext = await prisma.$queryRaw`
    SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'
  `;
  if (!ext.length) {
    console.error('✗ pgvector extension not enabled');
    console.error('  Supabase → Database → Extensions → enable "vector", then re-run migrate');
    failed = true;
  } else {
    console.log(`✓ pgvector extension (v${ext[0].extversion})`);
  }

  const col = await prisma.$queryRaw`
    SELECT udt_name, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_chunks'
      AND column_name = 'embedding'
  `;
  if (!col.length) {
    console.error('✗ knowledge_chunks.embedding column missing');
    failed = true;
  } else {
    console.log(`✓ knowledge_chunks.embedding (${col[0].udt_name})`);
  }

  const idx = await prisma.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'knowledge_chunks'
      AND indexname = ${INDEX_NAME}
  `;
  if (!idx.length) {
    console.error(`✗ HNSW index "${INDEX_NAME}" missing — run: npm run db:migrate`);
    failed = true;
  } else {
    console.log(`✓ index ${INDEX_NAME}`);
    if (!String(idx[0].indexdef).includes('hnsw')) {
      console.warn('  (index exists but may not be HNSW — check migration)');
    }
  }

  if (!failed && ext.length && col.length) {
    const vecLit = `'${zeroVectorLiteral()}'`;
    const dist = await prisma.$queryRawUnsafe(
      `SELECT (${vecLit}::vector <=> ${vecLit}::vector)::float8 AS cosine_distance`
    );
    const d = Number(dist[0]?.cosine_distance);
    if (!Number.isFinite(d) || d > 0.001) {
      console.error(`✗ cosine distance smoke test failed (got ${d})`);
      failed = true;
    } else {
      console.log('✓ cosine distance operator (<=>) works');
    }
  }

  const counts = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM knowledge_documents) AS documents,
      (SELECT COUNT(*)::int FROM knowledge_chunks) AS chunks,
      (SELECT COUNT(*)::int FROM knowledge_chunks WHERE embedding IS NOT NULL) AS embedded
  `;
  const { documents, chunks, embedded } = counts[0];
  console.log(`\nRows: ${documents} documents, ${chunks} chunks (${embedded} with embeddings)`);
  if (chunks === 0) {
    console.log('  (empty is OK for B1 — ingest starts at Block B2)');
  }

  console.log(failed ? '\nFAILED' : '\nBlock B1 verification passed.');
  if (failed) process.exit(1);
}

main()
  .catch((err) => {
    console.error('FAIL:', err.message);
    if (/type "vector" does not exist/i.test(err.message)) {
      console.error('\nEnable pgvector in Supabase Dashboard, then: npm run db:migrate');
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
