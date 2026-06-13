/**
 * Tier 3 — shadow embedding eval before switching providers (OpenAI ↔ Voyage).
 *
 * Samples stale chunks, embeds with SHADOW provider env, compares cosine vs stored vector.
 * Does NOT write to DB unless --apply is passed (then uses normal EMBED_PROVIDER).
 *
 * Usage:
 *   EMBED_PROVIDER=openai SHADOW_EMBED_PROVIDER=voyage node scripts/rag/shadow-embed-eval.js
 *   node scripts/rag/shadow-embed-eval.js --sample=20
 */
const { getPrisma, toVectorLiteral, padVector, EMBED_DIMS } = require('../lib/pgvectorIngest');

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embedWithProvider(text, provider) {
  const prev = process.env.EMBED_PROVIDER;
  process.env.EMBED_PROVIDER = provider;
  delete require.cache[require.resolve('../../src/services/embeddingsProvider')];
  const { embed, providerInfo } = require('../../src/services/embeddingsProvider');
  const vec = await embed(text);
  process.env.EMBED_PROVIDER = prev;
  delete require.cache[require.resolve('../../src/services/embeddingsProvider')];
  return { vec, info: providerInfo() };
}

async function main() {
  const args = process.argv.slice(2);
  const sampleArg = args.find((a) => a.startsWith('--sample='));
  const sampleSize = sampleArg ? Number(sampleArg.split('=')[1]) : 15;
  const shadow = process.env.SHADOW_EMBED_PROVIDER || process.env.EMBED_PROVIDER;
  const primary = process.env.EMBED_PROVIDER || 'openai';

  if (!shadow || shadow === primary) {
    console.error('Set SHADOW_EMBED_PROVIDER to a different provider than EMBED_PROVIDER.');
    process.exit(1);
  }

  const prisma = getPrisma();
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT k.id, k.content, k.embedding::text AS embedding_text, k.embedding_model, d.level
      FROM knowledge_chunks k
      INNER JOIN knowledge_documents d ON d.id = k.document_id
      WHERE k.embedding IS NOT NULL
        AND k.chunk_role IN ('child', 'standalone')
      ORDER BY RANDOM()
      LIMIT ${Math.max(1, Math.min(sampleSize, 50))}
    `);

    if (!rows.length) {
      console.log('No embedded chunks to sample.');
      return;
    }

    const sims = [];
    for (const row of rows) {
      const { vec, info } = await embedWithProvider(row.content, shadow);
      if (!vec) continue;
      const padded = padVector(vec);
      const lit = row.embedding_text;
      if (!lit) continue;
      const stored = lit
        .replace(/[\[\]]/g, '')
        .split(',')
        .map(Number)
        .filter((n) => Number.isFinite(n));
      const sim = cosine(padded.slice(0, stored.length), stored);
      sims.push(sim);
      console.log(
        `  ${row.id.slice(0, 8)}… ${row.level} stored=${row.embedding_model || '?'} shadow=${info.model} sim=${sim.toFixed(4)}`
      );
    }

    const avg = sims.length ? sims.reduce((a, b) => a + b, 0) / sims.length : 0;
    const min = sims.length ? Math.min(...sims) : 0;
    console.log(`\nShadow eval (${primary} → ${shadow}): n=${sims.length} avg_cosine=${avg.toFixed(4)} min=${min.toFixed(4)}`);
    if (avg < 0.75) {
      console.warn('WARN: low shadow similarity — review before switching providers.');
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
