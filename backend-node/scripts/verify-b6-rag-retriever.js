/* eslint-disable no-console */
/**
 * Block B6 verification (Node) — mirrors ai-service verify_b6.py without Python.
 *
 *   node scripts/verify-b6-rag-retriever.js
 */
require('dotenv').config();
const { ragRetrieve } = require('../src/lib/rag/ragRetrieve');

const CASES = [
  { intent: 'workout', query: 'bench press chest exercise', level: 'L2_EXERCISE' },
  { intent: 'nutrition', query: 'high protein chicken meal', level: 'L3_NUTRITION' },
  { intent: 'platform_help', query: 'Taqwin onboarding how it works', level: 'L1_INTERNAL' },
  { intent: 'scientific', query: 'three laws of muscle growth progressive overload', level: 'L5_BOOKS' },
];

async function main() {
  console.log('Block B6 — RAG retriever verification (Node)\n');
  let failed = false;

  try {
    const ping = await ragRetrieve({
      purpose: 'chat',
      query: 'test',
      levels: ['L1_INTERNAL'],
      limit: 1,
    });
    console.log(`OK: ragRetrieve reachable (${(ping.results || []).length} hit(s))\n`);
  } catch (err) {
    console.error(`FAIL: ragRetrieve: ${err.message}`);
    process.exit(1);
  }

  for (const { intent, query, level } of CASES) {
    try {
      const out = await ragRetrieve({
        purpose: intent === 'scientific' ? 'coach_philosophy' : 'chat',
        query,
        levels: [level],
        limit: 6,
      });
      const results = out.results || [];
      if (!results.length) {
        console.error(`FAIL [${intent}]: no hits for ${JSON.stringify(query)}`);
        failed = true;
        continue;
      }
      const best = results.reduce((a, b) => ((a.score || 0) >= (b.score || 0) ? a : b));
      console.log(
        `OK [${intent}]: ${results.length} hit(s), ${level}=${JSON.stringify(best.title)} score=${(best.score || 0).toFixed(3)}`
      );
    } catch (err) {
      console.error(`FAIL [${intent}]: ${err.message}`);
      failed = true;
    }
  }

  if (failed) {
    console.error('\nFAILED');
    process.exit(1);
  }
  console.log('\nBlock B6 verification passed.');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
