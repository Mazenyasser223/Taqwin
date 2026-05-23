#!/usr/bin/env node
/**
 * Set localUrl in DB for any MP4 already on disk (no Playwright).
 *   npm run backfill:local-urls
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { publicLocalUrl, localAbsolutePath, UPLOAD_ROOT } = require('../src/lib/exerciseVideoCache');

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.exercise.findMany({ where: { isPublic: true } });
  let updated = 0;

  for (const ex of rows) {
    const videos = Array.isArray(ex.videos) ? [...ex.videos] : [];
    let changed = false;

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      if (!v?.url?.includes('.mp4') && !v?.filename) continue;
      const fn = v.filename || v.url.split('/').pop()?.split('#')[0];
      if (!fn) continue;
      if (v.localUrl?.startsWith('/uploads/')) continue;

      const abs = localAbsolutePath(ex.muscleWikiId, fn);
      if (fs.existsSync(abs) && fs.statSync(abs).size > 10_000) {
        videos[i] = { ...v, localUrl: publicLocalUrl(ex.muscleWikiId, fn) };
        changed = true;
        continue;
      }

      const dir = path.join(UPLOAD_ROOT, String(ex.muscleWikiId));
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mp4'));
      const wantFront = /front/i.test(fn) || v.angle === 'front';
      const wantSide = /side/i.test(fn) || v.angle === 'side';
      const hit = files.find((f) =>
        wantSide ? /side/i.test(f) : wantFront ? /front/i.test(f) : f === fn,
      );
      if (hit) {
        const absHit = path.join(dir, hit);
        if (fs.statSync(absHit).size > 10_000) {
          videos[i] = {
            ...v,
            filename: hit,
            url: v.url?.includes('http') ? v.url : `https://media.musclewiki.com/media/uploads/videos/branded/${hit}`,
            localUrl: publicLocalUrl(ex.muscleWikiId, hit),
          };
          changed = true;
        }
      }
    }

    if (changed) {
      await prisma.exercise.update({ where: { id: ex.id }, data: { videos } });
      updated += 1;
    }
  }

  console.log('[backfill] updated exercises:', updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
