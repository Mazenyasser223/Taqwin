#!/usr/bin/env node
/**
 * Cache exercise MP4s locally so videos play inside Taqwin (CDN blocks server fetch).
 *
 *   npm run cache:exercise-videos
 *   npm run cache:exercise-videos -- --limit=30
 *   npm run cache:exercise-videos -- --id=781
 *
 * Requires: npx playwright install chromium
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { downloadVideoUrl, closeBrowser } = require('../src/lib/exerciseVideoCache');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const opts = { limit: 0, muscleWikiId: null, delayMs: 300 };
  for (const arg of argv) {
    if (arg.startsWith('--limit=')) opts.limit = Number(arg.split('=')[1]) || 0;
    else if (arg.startsWith('--id=')) opts.muscleWikiId = Number(arg.split('=')[1]);
    else if (arg.startsWith('--delay-ms=')) opts.delayMs = Number(arg.split('=')[1]) || 300;
  }
  return opts;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const where = opts.muscleWikiId ? { muscleWikiId: opts.muscleWikiId } : { isPublic: true };
  let exercises = await prisma.exercise.findMany({ where, orderBy: { muscleWikiId: 'asc' } });
  if (opts.limit > 0) exercises = exercises.slice(0, opts.limit);

  console.log(`[cache] ${exercises.length} exercises`);
  let files = 0;
  let skipped = 0;
  let failed = 0;

  for (const ex of exercises) {
    const videos = Array.isArray(ex.videos) ? ex.videos : [];
    const mp4s = videos.filter((v) => v?.url?.includes('.mp4') && v.type !== 'youtube');
    if (!mp4s.length) continue;

    let updated = false;
    const nextVideos = [...videos];

    for (let i = 0; i < nextVideos.length; i++) {
      const v = nextVideos[i];
      if (!v?.url?.includes('.mp4') || v.type === 'youtube') continue;
      const filename = v.filename || v.url.split('/').pop();
      if (v.localUrl && v.localUrl.startsWith('/uploads/')) {
        skipped += 1;
        continue;
      }

      try {
        const localUrl = await downloadVideoUrl(v.url, ex.muscleWikiId, filename, ex.slug);
        nextVideos[i] = { ...v, localUrl };
        updated = true;
        files += 1;
        console.log(`[cache] ok ${ex.name} — ${filename}`);
      } catch (err) {
        failed += 1;
        console.warn(`[cache] fail ${ex.name} ${filename}:`, err.message);
      }
      await sleep(opts.delayMs);
    }

    if (updated) {
      await prisma.exercise.update({
        where: { id: ex.id },
        data: { videos: nextVideos, thumbnailUrl: nextVideos.find((v) => v.localUrl)?.localUrl ?? ex.thumbnailUrl },
      });
    }
  }

  await closeBrowser();
  console.log('[cache] done', { files, skipped, failed });
}

main()
  .catch((e) => {
    console.error('[cache] fatal:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
