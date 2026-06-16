#!/usr/bin/env node
/**
 * Smoke-test exercise search (keyword + pg_trgm).
 * Usage: node scripts/test-exercise-search.js
 */
require('dotenv').config();
const { prisma } = require('../src/db');
const { searchExercises, normalizeText, expandToken } = require('../src/lib/exerciseSearchCore');

const CASES = [
  { q: 'bench press', expectIncludes: ['bench', 'press'] },
  { q: 'dumbell curl', expectIncludes: ['dumbbell', 'curl'] },
  { q: 'push up', expectIncludes: ['push'] },
  { q: 'lat pulldown', expectIncludes: ['lat', 'pull'] },
  { q: 'صدر', expectMin: 1 },
  { q: 'chest fly', expectMin: 1 },
  { q: 'squat', expectMin: 3 },
];

async function runCase({ q, expectIncludes, expectMin = 1 }) {
  const result = await searchExercises(prisma, {
    query: q,
    filters: {},
    pageSize: 10,
    offset: 0,
  });
  const names = (result?.rows || []).map((r) => String(r.name || '').toLowerCase());
  const okCount = (result?.total ?? 0) >= expectMin;
  let okMatch = true;
  if (expectIncludes?.length) {
    okMatch = names.some((name) => expectIncludes.every((part) => name.includes(part)));
  }
  return {
    q,
    total: result?.total ?? 0,
    top: names.slice(0, 3),
    ok: okCount && (expectIncludes ? okMatch : true),
  };
}

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  console.log('expandToken(bench):', expandToken('bench').slice(0, 6));
  console.log('normalizeText(dumbell):', normalizeText('dumbell'));

  const results = [];
  for (const c of CASES) {
    results.push(await runCase(c));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ results, failed: failed.length }, null, 2));
  await prisma.$disconnect();
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
