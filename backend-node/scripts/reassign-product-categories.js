/**
 * Re-assign product categories using smart slug pick (no full catalog wipe).
 * Usage: node scripts/reassign-product-categories.js
 */
const { PrismaClient } = require('@prisma/client');
const { buildCategoryMaps, pickProductCategorySlug } = require('./lib/pickProductCategory');

const prisma = new PrismaClient();
const MFB = 'https://myfitnessbag.com';
const PER_PAGE = 100;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const json = await res.json();
  const pages = Number(res.headers.get('x-wp-totalpages') || 1);
  return { json, pages };
}

async function fetchAllCategories() {
  const all = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const { json, pages: p } = await fetchJson(
      `${MFB}/wp-json/wc/store/products/categories?per_page=100&page=${page}`
    );
    pages = p;
    all.push(...json);
    page += 1;
    await sleep(120);
  }
  return all;
}

async function fetchAllProducts(onProgress) {
  const all = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const { json, pages: p, total } = await fetchJson(
      `${MFB}/wp-json/wc/store/products?per_page=${PER_PAGE}&page=${page}`
    );
    pages = p;
    all.push(...json);
    if (onProgress) onProgress({ page, pages, total, fetched: all.length });
    page += 1;
    await sleep(180);
  }
  return all;
}

async function main() {
  const slugRows = await prisma.shopCategory.findMany({ select: { id: true, slug: true } });
  const slugToCategoryId = new Map(slugRows.map((r) => [r.slug, r.id]));

  console.log('[reassign] fetching MFB categories for tree…');
  const mfbCategories = await fetchAllCategories();
  const categoryMaps = buildCategoryMaps(mfbCategories);

  console.log('[reassign] fetching MFB products…');
  const mfbProducts = await fetchAllProducts((p) => {
    process.stdout.write(`\r[reassign] page ${p.page}/${p.pages} (${p.fetched})   `);
  });
  console.log(`\n[reassign] products: ${mfbProducts.length}`);

  let updated = 0;
  const BATCH = 50;

  for (let i = 0; i < mfbProducts.length; i += BATCH) {
    const chunk = mfbProducts.slice(i, i + BATCH);
    const results = await prisma.$transaction(
      chunk.map((p) => {
        const catSlug = pickProductCategorySlug(p.categories, slugToCategoryId, categoryMaps);
        const categoryId = catSlug ? slugToCategoryId.get(catSlug) ?? null : null;
        return prisma.product.updateMany({
          where: { slug: p.slug, isActive: true },
          data: { categoryId },
        });
      })
    );
    updated += results.reduce((n, r) => n + r.count, 0);
    if ((i + BATCH) % 500 === 0 || i + BATCH >= mfbProducts.length) {
      console.log(`[reassign] progress ${Math.min(i + BATCH, mfbProducts.length)}/${mfbProducts.length}`);
    }
  }

  const uncategorized = await prisma.product.count({
    where: { isActive: true, categoryId: null },
  });

  console.log('[reassign] done', { rowsTouched: updated, uncategorized });
}

main()
  .catch((e) => {
    console.error('[reassign] failed', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
