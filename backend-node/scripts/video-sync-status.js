#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { localAbsolutePath } = require('../src/lib/exerciseVideoCache');

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.exercise.findMany({
    where: { isPublic: true },
    select: { name: true, muscleWikiId: true, videos: true },
    orderBy: { muscleWikiId: 'asc' },
  });

  let cached = 0;
  let partial = 0;
  let missing = 0;
  const needSync = [];

  for (const ex of rows) {
    const mp4s = (ex.videos || []).filter((v) => v?.url?.includes('.mp4'));
    if (!mp4s.length) {
      missing += 1;
      needSync.push(ex.name);
      continue;
    }
    let okCount = 0;
    for (const v of mp4s) {
      const fn = v.filename || v.url.split('/').pop();
      const abs = localAbsolutePath(ex.muscleWikiId, fn);
      if (fs.existsSync(abs) && fs.statSync(abs).size > 10_000) okCount += 1;
    }
    if (okCount === mp4s.length) cached += 1;
    else if (okCount > 0) partial += 1;
    else {
      missing += 1;
      needSync.push(ex.name);
    }
  }

  console.log(
    JSON.stringify({ total: rows.length, cached, partial, missing }, null, 2),
  );
  if (needSync.length && needSync.length <= 15) {
    console.log('need sync:', needSync.join(', '));
  } else if (needSync.length) {
    console.log(`need sync: ${needSync.length} exercises (first 5: ${needSync.slice(0, 5).join(', ')})`);
  }
}

main()
  .finally(() => prisma.$disconnect());
