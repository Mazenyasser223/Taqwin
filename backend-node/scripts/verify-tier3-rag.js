/* eslint-disable no-console */
/**
 * Tier 3 verification — coach purposes, embedding lifecycle, observability API.
 *
 *   node scripts/verify-tier3-rag.js
 */
require('dotenv').config();
const http = require('http');
const { getPrisma } = require('./lib/pgvectorIngest');
const { ragRetrieve, COACH_PURPOSES } = require('../src/lib/rag/ragRetrieve');
const { aggregateRagMetrics } = require('../src/services/ragObservabilityService');
const { embeddingIdentity } = require('../src/services/embeddingsProvider');

const INTERNAL_KEY = process.env.AI_INTERNAL_KEY || '';

function requestJson({ method, path, body }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: Number(process.env.PORT || 4000),
        path,
        method,
        headers: {
          'X-Internal-Key': INTERNAL_KEY,
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
          } catch (e) {
            reject(new Error(`Invalid JSON (${res.statusCode}): ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('Tier 3 — RAG verification\n');
  let failed = false;

  console.log('1) Coach purpose constants');
  for (const p of ['coach_catalog', 'coach_philosophy', 'coach_platform']) {
    if (!COACH_PURPOSES.has(p)) {
      console.error(`  ✗ missing purpose ${p}`);
      failed = true;
    }
  }
  if (!failed) console.log('  ✓ coach purposes exported');

  console.log('\n2) Semantic retrieval by purpose');
  const cases = [
    { purpose: 'coach_catalog', query: 'chicken breast protein', levels: ['L3_NUTRITION'], minHits: 1 },
    { purpose: 'coach_platform', query: 'Taqwin onboarding features', levels: ['L1_INTERNAL'], minHits: 0 },
    { purpose: 'coach_philosophy', query: 'progressive overload', levels: ['L5_BOOKS'], minHits: 0 },
  ];
  for (const c of cases) {
    try {
      const out = await ragRetrieve({
        purpose: c.purpose,
        query: c.query,
        levels: c.levels,
        limit: 5,
      });
      const n = (out.results || out.items || []).length;
      const trace = out.trace || {};
      console.log(
        `  ${c.purpose}: hits=${n} path=${trace.path} latencyMs=${trace.latencyMs || 0} avgScore=${(trace.avgScore || 0).toFixed(3)}`
      );
      if (n < c.minHits) {
        console.error(`  ✗ expected >= ${c.minHits} hits`);
        failed = true;
      }
    } catch (err) {
      console.error(`  ✗ ${c.purpose}: ${err.message}`);
      failed = true;
    }
  }

  console.log('\n3) Embedding lifecycle columns');
  const prisma = getPrisma();
  try {
    const cols = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'knowledge_chunks'
        AND column_name IN ('embedding_model', 'embedding_version')
    `;
    const names = cols.map((r) => r.column_name);
    if (!names.includes('embedding_model') || !names.includes('embedding_version')) {
      console.error('  ✗ missing embedding_model/version columns');
      failed = true;
    } else {
      const identity = embeddingIdentity();
      const sample = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS total,
               COUNT(embedding_model)::int AS with_model
        FROM knowledge_chunks WHERE embedding IS NOT NULL
      `;
      console.log(
        `  ✓ columns present; embedded=${sample[0].total} with_model=${sample[0].with_model} current=${identity.model}@${identity.version}`
      );
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n4) HTTP metrics + dashboard routes');
  try {
    const health = await requestJson({ method: 'GET', path: '/health' });
    if (health.status !== 200) throw new Error(`health ${health.status}`);
    console.log('  ✓ backend health OK');

    const metrics = await requestJson({ method: 'GET', path: '/api/internal/ai/rag/metrics?hours=24' });
    if (metrics.status !== 200) throw new Error(`metrics ${metrics.status}`);
    const m = metrics.body || {};
    console.log(`  ✓ metrics API: configured=${m.configured} traces=${m.traceCount ?? 0}`);
    if (!m.configured && !m.message) throw new Error('metrics missing message when not configured');

    const dash = await new Promise((resolve, reject) => {
      http
        .get(
          {
            hostname: '127.0.0.1',
            port: Number(process.env.PORT || 4000),
            path: '/api/internal/ai/rag/dashboard',
            headers: { 'X-Internal-Key': INTERNAL_KEY },
          },
          (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => resolve({ status: res.statusCode, html: data }));
          }
        )
        .on('error', reject);
    });
    if (dash.status !== 200 || !dash.html.includes('RAG Retrieval Observability')) {
      throw new Error(`dashboard ${dash.status}`);
    }
    console.log('  ✓ dashboard HTML served');
  } catch (err) {
    console.error(`  ✗ HTTP checks: ${err.message}`);
    failed = true;
  }

  console.log('\n5) Observability aggregation (Mongo optional)');
  const agg = await aggregateRagMetrics({ hours: 24 });
  console.log(`  configured=${agg.configured} traces=${agg.traceCount ?? 0}`);

  if (failed) {
    console.error('\nFAILED — Tier 3 verification');
    process.exit(1);
  }
  console.log('\nOK — Tier 3 verification passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
