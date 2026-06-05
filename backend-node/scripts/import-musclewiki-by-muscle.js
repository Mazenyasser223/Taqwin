#!/usr/bin/env node
/**
 * Import MuscleWiki exercises grouped by body-map muscle (api-next catalog).
 *
 *   npm run import:musclewiki:muscles
 *   npm run import:musclewiki:muscles -- --muscle=Forearms
 *   npm run import:musclewiki:muscles -- --dry-run --limit=50
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { scrapeExercisesByMuscle, BODY_MAP_MUSCLES } = require('../src/lib/musclewikiApiNext');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const opts = {
    limit: 0,
    limitPerMuscle: 0,
    dryRun: false,
    muscle: null,
    maxPages: 0,
    pageSize: 100,
    delayMs: Number(process.env.MUSCLEWIKI_SCRAPE_DELAY_MS) || 200,
    headless: true,
  };
  for (const arg of argv) {
    if (arg.startsWith('--limit=')) opts.limit = Number(arg.split('=')[1]) || 0;
    else if (arg.startsWith('--limit-per-muscle=')) opts.limitPerMuscle = Number(arg.split('=')[1]) || 0;
    else if (arg.startsWith('--muscle=')) opts.muscle = arg.split('=')[1];
    else if (arg.startsWith('--max-pages=')) opts.maxPages = Number(arg.split('=')[1]) || 0;
    else if (arg.startsWith('--page-size=')) opts.pageSize = Number(arg.split('=')[1]) || 100;
    else if (arg.startsWith('--delay-ms=')) opts.delayMs = Number(arg.split('=')[1]) || 200;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--headed') opts.headless = false;
    else if (arg === '--list-muscles') opts.listMuscles = true;
  }
  return opts;
}

async function upsertExercise(data) {
  return prisma.exercise.upsert({
    where: { muscleWikiId: data.muscleWikiId },
    create: data,
    update: {
      slug: data.slug,
      name: data.name,
      category: data.category,
      difficulty: data.difficulty,
      force: data.force,
      mechanic: data.mechanic,
      grips: data.grips,
      primaryMuscles: data.primaryMuscles,
      secondaryMuscles: data.secondaryMuscles,
      steps: data.steps,
      videos: data.videos,
      thumbnailUrl: data.thumbnailUrl,
      longDescription: data.longDescription,
      source: data.source,
      isPublic: data.isPublic,
      updatedAt: new Date(),
    },
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.listMuscles) {
    console.log('Body-map muscles:', BODY_MAP_MUSCLES.join(', '));
    return;
  }

  console.log('[import] MuscleWiki by-muscle import (api-next + Playwright)…');
  if (opts.muscle) console.log(`[import] filter muscle: ${opts.muscle}`);

  const { exercises, muscleStats, rawCount } = await scrapeExercisesByMuscle({
    ...opts,
    musclesOnly: !opts.muscle,
  });

  console.log(`\n[import] ${exercises.length} unique exercises (from ${rawCount} api rows)`);
  console.log('[import] per muscle:');
  for (const s of muscleStats.sort((a, b) => b.count - a.count)) {
    console.log(`  ${s.muscle.padEnd(22)} ${String(s.count).padStart(4)} in catalog`);
  }

  if (opts.dryRun) {
    console.log('[import] dry-run — no DB writes');
    return;
  }

  let ok = 0;
  let fail = 0;
  const batchSize = Number(process.env.MUSCLEWIKI_IMPORT_BATCH) || 25;

  for (let i = 0; i < exercises.length; i += batchSize) {
    const chunk = exercises.slice(i, i + batchSize);
    const results = await Promise.allSettled(chunk.map((data) => upsertExercise(data)));
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') ok += 1;
      else {
        fail += 1;
        console.warn(`[import] skip ${chunk[j].name}:`, results[j].reason?.message);
      }
    }
    if ((i + batchSize) % 200 === 0 || i + batchSize >= exercises.length) {
      console.log(`[import] progress ${Math.min(i + batchSize, exercises.length)}/${exercises.length}`);
    }
  }

  const total = await prisma.exercise.count({ where: { isPublic: true } });
  console.log('[import] done.', { ok, fail, totalInDb: total });
}

main()
  .catch((err) => {
    console.error('[import] fatal:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
