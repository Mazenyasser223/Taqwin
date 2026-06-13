/* eslint-disable no-console */
/**
 * Smoke test Cohere Rerank API — run from ai-service:
 *   node scripts/run-cohere-smoke.js
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) throw new Error('ai-service/.env not found');
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

async function main() {
  loadEnv();
  const key = process.env.COHERE_API_KEY;
  const model = process.env.COHERE_RERANK_MODEL || 'rerank-v3.5';
  if (!key) {
    console.error('FAIL: COHERE_API_KEY not set in ai-service/.env');
    process.exit(1);
  }

  const query = 'bench press chest alternative';
  const documents = [
    'Barbell squat legs compound exercise',
    'Barbell bench press chest exercise alternative',
    'Dumbbell biceps curl arms',
  ];

  console.log('Cohere Rerank smoke test');
  console.log(`  model=${model}`);
  console.log(`  query="${query}"`);

  const res = await fetch('https://api.cohere.com/v2/rerank', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, query, documents, top_n: 2 }),
  });

  const body = await res.json();
  if (!res.ok) {
    console.error('FAIL:', res.status, JSON.stringify(body).slice(0, 400));
    process.exit(1);
  }

  const results = body.results || [];
  if (!results.length) {
    console.error('FAIL: empty results');
    process.exit(1);
  }

  for (const r of results) {
    const idx = r.index;
    console.log(
      `  rank ${results.indexOf(r) + 1}: doc[${idx}] score=${Number(r.relevance_score).toFixed(4)} — ${documents[idx].slice(0, 50)}…`
    );
  }

  const topIdx = results[0].index;
  if (topIdx !== 1) {
    console.warn('WARN: expected bench press doc (index 1) first, got', topIdx);
  } else {
    console.log('PASS: bench press ranked first');
  }
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
