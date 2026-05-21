/**
 * Background cache warming — first user search/category load feels instant.
 */
const { logger } = require('./logger');
const fdc = require('../services/fdcService');
const { FDC_CATEGORIES } = require('./fdcCategories');
const { searchFdcCached, DEFAULT_PAGE_SIZE } = require('./nutritionFdcSearchCore');

const COMMON_SEARCHES_AR = [
  'بيض',
  'حليب',
  'دجاج',
  'لحم',
  'أرز',
  'خبز',
  'سمك',
  'جبن',
  'تفاح',
  'موز',
];

const COMMON_SEARCHES_EN = ['egg', 'milk', 'chicken', 'rice', 'bread', 'beef', 'fish'];

function warmEnabled() {
  return process.env.FDC_WARM_CACHE !== 'false' && fdc.isConfigured();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPool(tasks, concurrency) {
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const task = tasks[i++];
      try {
        await task();
      } catch (err) {
        logger.warn({ err: err.message }, 'FDC warm task failed');
      }
      const gap = Number(process.env.FDC_WARM_GAP_MS) || 120;
      if (gap > 0) await delay(gap);
    }
  }
  const n = Math.max(1, Math.min(concurrency, tasks.length));
  await Promise.all(Array.from({ length: n }, worker));
}

async function warmFdcCache() {
  if (!warmEnabled()) return;

  const langs = (process.env.FDC_WARM_LANGS || 'ar')
    .split(',')
    .map((s) => s.trim())
    .filter((l) => l === 'ar' || l === 'en');

  const tasks = [];
  const pageSize = Number(process.env.FDC_WARM_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const dataTypes = fdc.DEFAULT_DATA_TYPES;

  if (process.env.FDC_WARM_CATEGORIES !== 'false') {
    for (const cat of FDC_CATEGORIES) {
      for (const lang of langs) {
        tasks.push(() =>
          searchFdcCached({
            categoryId: cat.id,
            page: 1,
            pageSize,
            lang,
            usdaStartPage: 1,
            dataTypes,
          })
        );
      }
    }
  }

  if (process.env.FDC_WARM_SEARCHES !== 'false') {
    const queries = [
      ...(process.env.FDC_WARM_SEARCHES_AR !== 'false' ? COMMON_SEARCHES_AR : []),
      ...(process.env.FDC_WARM_SEARCHES_EN !== 'false' ? COMMON_SEARCHES_EN : []),
    ];
    for (const q of queries) {
      for (const lang of langs) {
        tasks.push(() =>
          searchFdcCached({
            q,
            page: 1,
            pageSize,
            lang,
            usdaStartPage: 1,
            dataTypes,
          })
        );
      }
    }
  }

  const concurrency = Number(process.env.FDC_WARM_CONCURRENCY) || 2;
  const started = Date.now();
  logger.info({ tasks: tasks.length, concurrency }, 'FDC cache warm started');

  await runPool(tasks, concurrency);

  logger.info({ ms: Date.now() - started, tasks: tasks.length }, 'FDC cache warm finished');
}

function startFdcCacheWarm() {
  if (!warmEnabled()) return;
  setImmediate(() => {
    warmFdcCache().catch((err) => logger.warn({ err }, 'FDC cache warm error'));
  });
}

module.exports = { startFdcCacheWarm, warmFdcCache };
