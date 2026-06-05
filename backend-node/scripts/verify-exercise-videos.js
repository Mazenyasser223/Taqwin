#!/usr/bin/env node
/**
 * Verify all exercises have working local video files.
 *   npm run verify:exercise-videos
 */
require('dotenv').config();
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { localAbsolutePath, isValidMp4File } = require('../src/lib/exerciseVideoCache');

const prisma = new PrismaClient();
const MIN_BYTES = 10_000;

async function main() {
  const rows = await prisma.exercise.findMany({
    where: { isPublic: true },
    select: { id: true, name: true, muscleWikiId: true, videos: true },
  });

  const broken = [];
  let ok = 0;

  for (const ex of rows) {
    const mp4s = (ex.videos || []).filter((v) => v?.localUrl || v?.url?.includes('.mp4'));
    if (!mp4s.length) {
      broken.push({ name: ex.name, reason: 'no_mp4_in_db' });
      continue;
    }

    let exerciseOk = true;
    for (const v of mp4s) {
      const fn = v.filename || v.url?.split('/').pop();
      if (!fn) {
        exerciseOk = false;
        break;
      }
      const abs = localAbsolutePath(ex.muscleWikiId, fn);
      if (!isValidMp4File(abs)) {
        exerciseOk = false;
        break;
      }
    }

    if (exerciseOk) ok += 1;
    else broken.push({ name: ex.name, id: ex.muscleWikiId, reason: 'missing_or_small_file' });
  }

  console.log(JSON.stringify({ total: rows.length, ok, broken: broken.length }, null, 2));
  if (broken.length) {
    console.log('sample failures:', broken.slice(0, 20));
    process.exit(1);
  }
  console.log('[verify] all exercise videos OK');
}

main()
  .finally(() => prisma.$disconnect());
