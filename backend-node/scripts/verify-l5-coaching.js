/* eslint-disable no-console */
/**
 * Verify L5 coaching-book supplements + Arabic summaries retrieval.
 *
 *   node scripts/verify-l5-coaching.js
 */
require('dotenv').config();
const { ragRetrieve } = require('../src/lib/rag/ragRetrieve');

const CASES = [
  {
    label: 'AR progressive overload (scientific)',
    query: 'إيه هو progressive overload وقوانين نمو العضلات',
    locale: 'ar',
    purpose: 'coach_philosophy',
    levels: ['L5_BOOKS'],
    expectSource: 'coaching-book/bls',
    minScore: 0.35,
  },
  {
    label: 'AR Ramadan training (life_mode)',
    query: 'تمرين بعد الإفطار في رمضان إزاي',
    locale: 'ar',
    purpose: 'coach_philosophy',
    levels: ['L5_BOOKS'],
    expectSource: 'ramadan-training-ar',
    minScore: 0.30,
  },
  {
    label: 'AR travel training (life_mode)',
    query: 'كيف أعدل التمرين وأنا مسافر',
    locale: 'ar',
    purpose: 'coach_philosophy',
    levels: ['L5_BOOKS'],
    expectSource: 'travel-training-ar',
    minScore: 0.30,
  },
  {
    label: 'AR injury-safe (L5 philosophy)',
    query: 'تمرين بأمان مع ألم في الكتف وإصابة',
    locale: 'ar',
    purpose: 'coach_philosophy',
    levels: ['L5_BOOKS'],
    expectSource: 'injury-safe-training-ar',
    minScore: 0.35,
  },
  {
    label: 'EN travel training',
    query: 'Training adjustments while traveling hotel gym',
    locale: 'en',
    purpose: 'coach_philosophy',
    levels: ['L5_BOOKS'],
    expectSource: 'travel-training-en',
    minScore: 0.30,
  },
  {
    label: 'EN scientific BLS (baseline)',
    query: 'three laws of muscle growth progressive overload',
    locale: 'en',
    purpose: 'coach_philosophy',
    levels: ['L5_BOOKS'],
    expectSource: 'books/bigger-leaner-stronger',
    minScore: 0.55,
  },
  {
    label: 'AR deload rest days',
    query: 'كم يوم راحة في الأسبوع ومتى deload',
    locale: 'ar',
    purpose: 'coach_philosophy',
    levels: ['L5_BOOKS'],
    expectSource: 'deload-recovery-ar',
    minScore: 0.28,
  },
];

function hitSource(hit) {
  const meta = hit.metadata || {};
  return String(meta.sourceFile || hit.source || '').toLowerCase();
}

async function main() {
  console.log('L5 coaching-book + Arabic summary retrieval verification\n');
  let failed = 0;

  for (const c of CASES) {
    const out = await ragRetrieve({
      query: c.query,
      levels: c.levels,
      purpose: c.purpose,
      locale: c.locale,
      limit: 8,
    });
    const hits = out.results || [];
    const top = hits[0];
    const match = hits.find((h) => hitSource(h).includes(c.expectSource.toLowerCase()));
    const topScore = top ? Number(top.score || 0) : 0;
    const matchScore = match ? Number(match.score || 0) : 0;

    const ok =
      hits.length > 0 &&
      topScore >= c.minScore &&
      match != null;

    if (!ok) failed += 1;

    const icon = ok ? 'OK' : 'FAIL';
    console.log(
      `${icon} [${c.label}] hits=${hits.length} top=${topScore.toFixed(3)}` +
        (top ? ` "${(top.title || '').slice(0, 50)}"` : '') +
        (match ? ` | matched=${hitSource(match)} @${matchScore.toFixed(3)}` : ' | no source match')
    );
  }

  console.log(failed ? `\nFAILED (${failed}/${CASES.length})` : `\nAll ${CASES.length} L5 coaching checks passed.`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
