#!/usr/bin/env node
/**
 * Smoke-test workouts API + local video files (no browser).
 * Usage: node scripts/test-workouts-page.js [JWT]
 */
require('dotenv').config();
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { localAbsolutePath } = require('../src/lib/exerciseVideoCache');

const BASE = process.env.TEST_API_BASE || 'http://localhost:4000';
const token = process.argv[2] || process.env.TEST_JWT || '';

async function api(path, opts = {}) {
  const headers = { Accept: 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  return { status: res.status, body, headers: res.headers };
}

async function head(url) {
  const res = await fetch(url, { method: 'HEAD' });
  return res.status;
}

async function main() {
  const prisma = new PrismaClient();
  const report = { pass: [], fail: [], warn: [] };

  const health = await api('/health');
  if (health.status === 200) report.pass.push('GET /health');
  else report.fail.push(`GET /health → ${health.status}`);

  const list = await api('/api/exercises?limit=5');
  if (list.status === 200 && list.body?.results?.length) {
    report.pass.push(`GET /api/exercises (${list.body.results.length} rows)`);
  } else if (list.status === 401) {
    report.warn.push('GET /api/exercises → 401 (need login token: node scripts/test-workouts-page.js <JWT>)');
  } else {
    report.fail.push(`GET /api/exercises → ${list.status} ${JSON.stringify(list.body).slice(0, 120)}`);
  }

  const filters = await api('/api/exercises/meta/filters');
  if (filters.status === 200 && filters.body?.categories) report.pass.push('GET /api/exercises/meta/filters');
  else if (filters.status !== 401) report.fail.push(`GET filters → ${filters.status}`);

  const sample = await prisma.exercise.findFirst({
    where: { isPublic: true, videos: { path: ['localUrl'], not: null } },
    select: { id: true, name: true, muscleWikiId: true, videos: true },
  });

  if (sample) {
    const v = sample.videos.find((x) => x.localUrl);
    const fn = v.filename || v.url?.split('/').pop();
    const abs = localAbsolutePath(sample.muscleWikiId, fn);
    if (fs.existsSync(abs)) {
      const be = await head(`${BASE}${v.localUrl}`);
      if (be === 200) report.pass.push(`HEAD backend ${v.localUrl}`);
      else report.fail.push(`HEAD backend video → ${be}`);
      const fe = await head(`http://localhost:3000${v.localUrl}`);
      if (fe === 200) report.pass.push(`HEAD vite proxy ${v.localUrl}`);
      else report.fail.push(`HEAD vite proxy video → ${fe} (restart frontend?)`);
    } else {
      report.fail.push(`Disk missing ${sample.name} ${fn}`);
    }
    if (token) {
      const stream = await head(
        `${BASE}/api/exercises/${sample.id}/stream/video?url=${encodeURIComponent(v.url)}&token=${encodeURIComponent(token)}`,
      );
      if (stream === 200) report.pass.push('HEAD stream/video (auth)');
      else report.warn.push(`HEAD stream/video → ${stream}`);
    }
  }

  const total = await prisma.exercise.count({ where: { isPublic: true } });
  const rows = await prisma.exercise.findMany({ where: { isPublic: true }, select: { videos: true, muscleWikiId: true } });
  let playable = 0;
  for (const ex of rows) {
    const mp4s = (ex.videos || []).filter((x) => x.url?.includes('.mp4'));
    const ok = mp4s.some((x) => {
      const fn = x.filename || x.url.split('/').pop();
      const abs = localAbsolutePath(ex.muscleWikiId, fn);
      return (x.localUrl && fs.existsSync(abs)) || fs.existsSync(abs);
    });
    if (ok || (ex.videos || []).some((x) => x.type === 'gif')) playable++;
  }
  report.pass.push(`DB: ${total} exercises, ~${playable} with media (${Math.round((playable / total) * 100)}%)`);

  console.log('\n=== Workouts smoke test ===\n');
  for (const p of report.pass) console.log('  ✓', p);
  for (const w of report.warn) console.log('  ⚠', w);
  for (const f of report.fail) console.log('  ✗', f);
  const ok = report.fail.length === 0;
  console.log(ok ? '\nOK' : '\nFAILED');
  process.exit(ok ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const p = new PrismaClient();
    await p.$disconnect();
  });
