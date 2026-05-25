#!/usr/bin/env node
/**
 * Import MuscleWiki exercises via web scraping (no API key).
 *
 *   npm run import:musclewiki
 *   npm run import:musclewiki -- --limit=50
 *   npm run import:musclewiki -- --site-only
 *   npm run import:musclewiki -- --mirror-only
 *
 * Uses workoutapi.vercel.app mirror + optional Playwright on musclewiki.com.
 * Install Playwright for full site crawl: npx playwright install chromium
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { scrapeAllExercises, scrapeWorkoutApiCatalog, scrapeMuscleWikiSitePlaywright } = require('../src/lib/musclewikiScraper');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const opts = {
    limit: 0,
    dryRun: false,
    siteOnly: false,
    mirrorOnly: false,
    requireSite: false,
    siteLimit: 0,
    delayMs: Number(process.env.MUSCLEWIKI_SCRAPE_DELAY_MS) || 400,
    headless: true,
  };
  for (const arg of argv) {
    if (arg.startsWith('--limit=')) opts.limit = Number(arg.split('=')[1]) || 0;
    else if (arg.startsWith('--site-limit=')) opts.siteLimit = Number(arg.split('=')[1]) || 0;
    else if (arg.startsWith('--delay-ms=')) opts.delayMs = Number(arg.split('=')[1]) || 400;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--site-only') opts.siteOnly = true;
    else if (arg === '--mirror-only') opts.mirrorOnly = true;
    else if (arg === '--require-site') opts.requireSite = true;
    else if (arg === '--headed') opts.headless = false;
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
  console.log('[import] MuscleWiki web scrape import (no API)…');

  let exercises;
  if (opts.siteOnly) {
    exercises = await scrapeMuscleWikiSitePlaywright({
      delayMs: opts.delayMs,
      limit: opts.limit || opts.siteLimit,
      headless: opts.headless,
    });
  } else if (opts.mirrorOnly) {
    exercises = await scrapeWorkoutApiCatalog();
    if (opts.limit > 0) exercises = exercises.slice(0, opts.limit);
  } else {
    exercises = await scrapeAllExercises({
      delayMs: opts.delayMs,
      limit: opts.limit,
      siteLimit: opts.siteLimit,
      site: !opts.mirrorOnly,
      requireSite: opts.requireSite,
      headless: opts.headless,
    });
  }

  console.log(`[import] ${exercises.length} exercises to upsert`);
  let ok = 0;
  let fail = 0;
  const batchSize = Number(process.env.MUSCLEWIKI_IMPORT_BATCH) || 25;

  for (let i = 0; i < exercises.length; i += batchSize) {
    const chunk = exercises.slice(i, i + batchSize);
    if (opts.dryRun) {
      ok += chunk.length;
      continue;
    }
    const results = await Promise.allSettled(chunk.map((data) => upsertExercise(data)));
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') ok += 1;
      else {
        fail += 1;
        console.warn(`[import] skip ${chunk[j].name}:`, results[j].reason?.message);
      }
    }
    if ((i + batchSize) % 100 === 0 || i + batchSize >= exercises.length) {
      console.log(`[import] progress ${Math.min(i + batchSize, exercises.length)}/${exercises.length}`);
    }
  }

  console.log('[import] done.', { ok, fail, dryRun: opts.dryRun });
}

main()
  .catch((err) => {
    console.error('[import] fatal:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
