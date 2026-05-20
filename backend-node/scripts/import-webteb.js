#!/usr/bin/env node
/**
 * Import WebTeb nutrition facts into PostgreSQL.
 *
 * Usage:
 *   node scripts/import-webteb.js                    # full catalog via sitemap (~2110 foods)
 *   node scripts/import-webteb.js --category=vegetables
 *   node scripts/import-webteb.js --limit-per-category=50
 *   node scripts/import-webteb.js --from-category-pages  # legacy: max ~100 per category from HTML
 *
 * Requires DATABASE_URL and network access to webteb.com.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const {
  fetchCategoryIndex,
  fetchCategoryFoodLinks,
  fetchSitemapFoodLinks,
  fetchFoodPage,
  sleep,
} = require('../src/lib/webtebScraper');
const { taqwinIdForSlug, iconForTaqwinId } = require('../src/lib/webtebCategories');
const { translateFoodNameArToEn } = require('../src/lib/webtebFoodNameEn');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const opts = {
    limitPerCategory: 0,
    categorySlug: null,
    delayMs: Number(process.env.WEBTEB_SCRAPE_DELAY_MS) || 1000,
    skipExisting: true,
    fromCategoryPages: false,
    translateNames: true,
  };
  for (const arg of argv) {
    if (arg.startsWith('--limit-per-category=')) {
      opts.limitPerCategory = Number(arg.split('=')[1]) || 0;
    } else if (arg.startsWith('--category=')) {
      opts.categorySlug = arg.split('=')[1];
    } else if (arg.startsWith('--delay-ms=')) {
      opts.delayMs = Number(arg.split('=')[1]) || 1000;
    } else if (arg === '--force') {
      opts.skipExisting = false;
    } else if (arg === '--from-category-pages') {
      opts.fromCategoryPages = true;
    } else if (arg === '--no-translate') {
      opts.translateNames = false;
    }
  }
  return opts;
}

async function upsertCategory(cat) {
  await prisma.webtebCategory.upsert({
    where: { id: cat.id },
    create: {
      id: cat.id,
      slug: cat.slug,
      nameAr: cat.nameAr,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
    },
    update: {
      slug: cat.slug,
      nameAr: cat.nameAr,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
    },
  });
}

async function upsertFood(link, parsed, categoryId, opts) {
  let nameEn = null;
  if (opts.translateNames) {
    nameEn = await translateFoodNameArToEn(parsed.nameAr);
  }
  const data = {
    webtebId: parsed.webtebId,
    categoryId,
    categorySlug: link.categorySlug,
    slug: parsed.slug || link.slug,
    nameAr: parsed.nameAr,
    nameEn,
    url: parsed.url || link.url,
    calories: parsed.calories ?? 0,
    protein: parsed.protein ?? 0,
    carbs: parsed.carbs ?? 0,
    fat: parsed.fat ?? 0,
    servingUnits: parsed.servingUnits ?? [],
    sections: parsed.sections ?? {},
    scrapedAt: new Date(),
  };

  await prisma.webtebFood.upsert({
    where: { webtebId: parsed.webtebId },
    create: data,
    update: data,
  });
}

function groupLinksByCategory(links) {
  const map = new Map();
  for (const link of links) {
    if (!map.has(link.categorySlug)) map.set(link.categorySlug, []);
    map.get(link.categorySlug).push(link);
  }
  return map;
}

async function collectLinks(opts, categories) {
  if (opts.fromCategoryPages) {
    const all = [];
    const targetCats = opts.categorySlug
      ? categories.filter((c) => c.slug === opts.categorySlug || c.id === opts.categorySlug)
      : categories;
    for (const cat of targetCats) {
      await sleep(opts.delayMs);
      const links = await fetchCategoryFoodLinks(cat.slug);
      let list = links;
      if (opts.limitPerCategory > 0) list = list.slice(0, opts.limitPerCategory);
      all.push(...list);
    }
    return all;
  }

  let links = await fetchSitemapFoodLinks();
  console.log(`[webteb] Sitemap: ${links.length} food URLs`);

  if (opts.categorySlug) {
    links = links.filter((l) => l.categorySlug === opts.categorySlug);
    console.log(`[webteb] Filtered to category ${opts.categorySlug}: ${links.length}`);
  }

  if (opts.limitPerCategory > 0) {
    const grouped = groupLinksByCategory(links);
    links = [];
    for (const [, list] of grouped) {
      links.push(...list.slice(0, opts.limitPerCategory));
    }
  }

  return links;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log('[webteb] Starting import', opts);

  const categories = await fetchCategoryIndex();
  console.log(`[webteb] Found ${categories.length} categories`);
  const catBySlug = new Map(categories.map((c) => [c.slug, c]));
  for (const cat of categories) {
    await upsertCategory(cat);
  }

  const links = await collectLinks(opts, categories);
  if (links.length === 0) {
    console.error('[webteb] No food links to import');
    process.exit(1);
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const started = Date.now();

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const cat = catBySlug.get(link.categorySlug);
    const categoryId = cat?.id ?? taqwinIdForSlug(link.categorySlug);

    if (opts.skipExisting) {
      const exists = await prisma.webtebFood.findUnique({
        where: { webtebId: link.webtebId },
        select: { id: true },
      });
      if (exists) {
        skipped++;
        if ((i + 1) % 50 === 0) {
          console.log(
            `[webteb] progress ${i + 1}/${links.length} imported=${imported} skipped=${skipped} failed=${failed}`
          );
        }
        continue;
      }
    }

    await sleep(opts.delayMs);
    try {
      const parsed = await fetchFoodPage(link.url);
      if (!parsed.webtebId) {
        failed++;
        continue;
      }
      await upsertCategory({
        id: categoryId,
        slug: link.categorySlug,
        nameAr: cat?.nameAr || link.categorySlug,
        icon: cat?.icon || iconForTaqwinId(categoryId),
        sortOrder: cat?.sortOrder ?? 0,
      });
      await upsertFood(link, parsed, categoryId, opts);
      imported++;
      if (imported % 50 === 0 || (i + 1) % 100 === 0 || i === links.length - 1) {
        const elapsed = Math.round((Date.now() - started) / 1000);
        console.log(
          `[webteb] ${i + 1}/${links.length} imported=${imported} skipped=${skipped} failed=${failed} (${elapsed}s)`
        );
      }
    } catch (err) {
      failed++;
      console.error(`[webteb] fail ${link.url}:`, err.message);
    }
  }

  const total = await prisma.webtebFood.count();
  console.log(`[webteb] Done. imported=${imported} skipped=${skipped} failed=${failed} totalInDb=${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
