#!/usr/bin/env node
/**
 * Fix + cache all MuscleWiki exercise videos (correct URLs + local MP4 files).
 *
 *   npm run sync:musclewiki-videos
 *   npm run sync:musclewiki-videos -- --limit=20
 *   npm run sync:musclewiki-videos -- --id=18
 *   npm run sync:musclewiki-videos -- --skip-cached
 *
 * Requires: npx playwright install chromium
 * Optional: MUSCLEWIKI_API_KEY — if set, also tries official API stream first per file.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { syncExerciseVideos, closePlaywright } = require('../src/lib/musclewikiVideoSync');
const { publicLocalUrl, localAbsolutePath } = require('../src/lib/exerciseVideoCache');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const opts = {
    limit: 0,
    muscleWikiId: null,
    delayMs: 400,
    skipCached: false,
    onlyIncomplete: false,
    slow: false,
    retries: 2,
    offset: 0,
  };
  for (const arg of argv) {
    if (arg.startsWith('--limit=')) opts.limit = Number(arg.split('=')[1]) || 0;
    else if (arg.startsWith('--id=')) opts.muscleWikiId = Number(arg.split('=')[1]);
    else if (arg.startsWith('--offset=')) opts.offset = Number(arg.split('=')[1]) || 0;
    else if (arg.startsWith('--delay-ms=')) opts.delayMs = Number(arg.split('=')[1]) || 400;
    else if (arg === '--skip-cached') opts.skipCached = true;
    else if (arg === '--only-incomplete') opts.onlyIncomplete = true;
    else if (arg.startsWith('--retries=')) opts.retries = Number(arg.split('=')[1]) || 2;
    else if (arg === '--slow') opts.slow = true;
  }
  return opts;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function alreadyCached(exercise) {
  const videos = exercise.videos || [];
  const mp4s = videos.filter((v) => v?.url?.includes('.mp4'));
  if (!mp4s.length) return false;
  return mp4s.every((v) => {
    const fn = v.filename || v.url?.split('/').pop();
    if (!fn) return false;
    const abs = localAbsolutePath(exercise.muscleWikiId, fn);
    return fs.existsSync(abs) && fs.statSync(abs).size > 10_000;
  });
}

async function tryApiDownload(filename) {
  const key = process.env.MUSCLEWIKI_API_KEY?.trim();
  if (!key) return null;
  try {
    const { fetchStream } = require('../src/lib/musclewikiApi');
    const res = await fetchStream(`/stream/videos/branded/${filename}`);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const where = opts.muscleWikiId ? { muscleWikiId: opts.muscleWikiId } : { isPublic: true };
  let exercises = await prisma.exercise.findMany({ where, orderBy: { muscleWikiId: 'asc' } });
  if (opts.onlyIncomplete) {
    exercises = exercises.filter((ex) => !alreadyCached(ex));
  }
  if (opts.offset > 0) exercises = exercises.slice(opts.offset);
  if (opts.limit > 0) exercises = exercises.slice(0, opts.limit);

  const syncOpts = opts.slow ? { waitMs: 6000, extraWaitMs: 14_000 } : { waitMs: 5000, extraWaitMs: 8000 };

  console.log(`[sync] ${exercises.length} exercises (Playwright + optional API)`);
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const ex of exercises) {
    if (opts.skipCached && alreadyCached(ex)) {
      skipped += 1;
      continue;
    }

    let lastErr = null;
    let result = null;
    for (let attempt = 0; attempt <= opts.retries; attempt++) {
      try {
        result = await syncExerciseVideos(ex, {
          ...syncOpts,
          waitMs: attempt ? syncOpts.waitMs + 2000 : syncOpts.waitMs,
        });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < opts.retries) {
          console.warn(`[sync] retry ${attempt + 1} ${ex.name}:`, err.message);
          await sleep(1500);
        }
      }
    }

    try {
      if (lastErr) throw lastErr;
      const { videos, captured, slug } = result;

      if (!videos.length) {
        failed += 1;
        console.warn(`[sync] no videos ${ex.name} (slug=${slug})`);
        await sleep(opts.delayMs);
        continue;
      }

      const savedCount = videos.filter((v) => v.localUrl).length;
      if (savedCount === 0) {
        failed += 1;
        console.warn(
          `[sync] partial ${ex.name} — ${videos.length} URLs, captured=${captured} (no local file yet)`,
        );
        await sleep(opts.delayMs);
        continue;
      }

      for (const v of videos) {
        if (v.localUrl) continue;
        const buf = await tryApiDownload(v.filename);
        if (buf && buf.length > 10_000) {
          const abs = localAbsolutePath(ex.muscleWikiId, v.filename);
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          fs.writeFileSync(abs, buf);
          v.localUrl = publicLocalUrl(ex.muscleWikiId, v.filename);
        }
      }

      const keepYoutube = (ex.videos || []).filter((v) => v.type === 'youtube');
      const merged = [...videos, ...keepYoutube];

      await prisma.exercise.update({
        where: { id: ex.id },
        data: {
          slug: ex.slug || slug,
          videos: merged,
          thumbnailUrl: merged.find((v) => v.localUrl)?.localUrl ?? ex.thumbnailUrl,
          source: 'musclewiki-scrape',
        },
      });

      ok += 1;
      console.log(
        `[sync] ok ${ex.name} — ${videos.length} videos, saved=${savedCount}, captured=${captured}`,
      );
    } catch (err) {
      failed += 1;
      console.warn(`[sync] fail ${ex.name}:`, err.message);
    }

    await sleep(opts.delayMs);
  }

  await closePlaywright();
  console.log('[sync] done', { ok, skipped, failed });
}

main()
  .catch((e) => {
    console.error('[sync] fatal:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
