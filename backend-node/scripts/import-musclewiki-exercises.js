#!/usr/bin/env node
/**
 * Import all MuscleWiki exercises into PostgreSQL (official API).
 *
 * Usage:
 *   node scripts/import-musclewiki-exercises.js
 *   node scripts/import-musclewiki-exercises.js --limit=100
 *   node scripts/import-musclewiki-exercises.js --offset=500
 *   node scripts/import-musclewiki-exercises.js --dry-run
 *
 * Requires: DATABASE_URL, MUSCLEWIKI_API_KEY in backend-node/.env
 * @see https://api.musclewiki.com/documentation
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const {
  listExercises,
  getExercise,
  normalizeExercise,
  sleep,
  getApiKey,
} = require('../src/lib/musclewikiApi');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const opts = {
    limit: 0,
    offset: 0,
    dryRun: false,
    delayMs: Number(process.env.MUSCLEWIKI_IMPORT_DELAY_MS) || 250,
    pageSize: Number(process.env.MUSCLEWIKI_IMPORT_PAGE_SIZE) || 100,
    concurrency: Math.min(8, Math.max(1, Number(process.env.MUSCLEWIKI_IMPORT_CONCURRENCY) || 3)),
  };
  for (const arg of argv) {
    if (arg.startsWith('--limit=')) opts.limit = Number(arg.split('=')[1]) || 0;
    else if (arg.startsWith('--offset=')) opts.offset = Number(arg.split('=')[1]) || 0;
    else if (arg.startsWith('--delay-ms=')) opts.delayMs = Number(arg.split('=')[1]) || 250;
    else if (arg === '--dry-run') opts.dryRun = true;
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

async function fetchDetailWithRetry(id, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await getExercise(id);
    } catch (err) {
      lastErr = err;
      if (err.status === 429) {
        const wait = 2000 * (i + 1);
        console.warn(`[import] rate limited on exercise ${id}, waiting ${wait}ms`);
        await sleep(wait);
      } else if (i < retries - 1) {
        await sleep(500 * (i + 1));
      }
    }
  }
  throw lastErr;
}

async function processBatch(ids, opts, stats) {
  const queue = [...ids];
  const workers = Array.from({ length: opts.concurrency }, async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (id == null) break;
      try {
        const raw = await fetchDetailWithRetry(id);
        const data = normalizeExercise(raw);
        if (!opts.dryRun) await upsertExercise(data);
        stats.imported += 1;
        if (stats.imported % 25 === 0) {
          console.log(`[import] ${stats.imported} exercises saved (latest: ${data.name})`);
        }
      } catch (err) {
        stats.failed += 1;
        console.error(`[import] failed exercise id=${id}:`, err.message);
      }
      await sleep(opts.delayMs);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  getApiKey();

  console.log('[import] MuscleWiki exercise import starting…');
  const stats = { imported: 0, failed: 0, skipped: 0 };
  let offset = opts.offset;
  let total = Infinity;
  let processed = 0;

  while (offset < total) {
    const page = await listExercises({ limit: opts.pageSize, offset });
    total = page.total ?? total;
    const results = page.results ?? page.data ?? [];
    if (!results.length) break;

    const ids = results.map((r) => r.id).filter((id) => id != null);
    const remaining = opts.limit > 0 ? opts.limit - processed : ids.length;
    const slice = ids.slice(0, remaining);

    console.log(`[import] page offset=${offset} count=${slice.length} / total≈${total}`);
    await processBatch(slice, opts, stats);

    processed += slice.length;
    offset += results.length;

    if (opts.limit > 0 && processed >= opts.limit) break;
    if (!page.count || results.length < opts.pageSize) break;
  }

  console.log('[import] done.', stats);
  if (opts.dryRun) console.log('[import] dry-run: nothing written to DB');
}

main()
  .catch((err) => {
    console.error('[import] fatal:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
