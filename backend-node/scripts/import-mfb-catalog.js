/**
 * Import full My Fitness Bag catalog via public WooCommerce Store API.
 * Usage: node scripts/import-mfb-catalog.js
 */
const { PrismaClient } = require('@prisma/client');
const { buildCategoryMaps, pickProductCategorySlug } = require('./lib/pickProductCategory');

const prisma = new PrismaClient();
const MFB = 'https://myfitnessbag.com';
const PER_PAGE = 100;

const PARENT_ICONS = {
  supplements: 'medication',
  'healthy-groceries': 'restaurant',
  'sports-equipment': 'fitness_center',
  pharmacy: 'local_pharmacy',
  kitchen: 'kitchen',
  clothes: 'checkroom',
  bags: 'shopping_bag',
  'offers-and-discounts': 'local_offer',
  shop: 'storefront',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseMoney(amountStr, minorUnit = 2) {
  const n = Number.parseInt(String(amountStr || '0'), 10);
  if (!Number.isFinite(n)) return 0;
  return n / 10 ** minorUnit;
}

function extractBrand(p) {
  const attr = p.attributes?.find((a) => a.name === 'Brand' || a.taxonomy === 'pa_brands');
  const term = attr?.terms?.[0]?.name;
  if (term) return term;
  const first = String(p.name || '').split(',')[0]?.trim();
  return first || 'General';
}

function stripHtml(html, { preserveTags = false, maxLen = 12000 } = {}) {
  if (!html) return null;
  let text = String(html);
  if (!preserveTags) {
    text = text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } else {
    text = text.trim();
  }
  return text.slice(0, maxLen) || null;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const json = await res.json();
  const total = Number(res.headers.get('x-wp-total') || 0);
  const pages = Number(res.headers.get('x-wp-totalpages') || 1);
  return { json, total, pages };
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
    await sleep(150);
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
    await sleep(200);
  }
  return all;
}

function mapProduct(p, slugToCategoryId, categoryMaps) {
  const minor = p.prices?.currency_minor_unit ?? 2;
  const price = parseMoney(p.prices?.price, minor);
  const regular = parseMoney(p.prices?.regular_price, minor);
  const compareAt = regular > price ? regular : null;
  let discountPercent = null;
  if (compareAt && compareAt > price) {
    discountPercent = Math.round(((compareAt - price) / compareAt) * 100);
  }
  const catSlug = pickProductCategorySlug(p.categories, slugToCategoryId, categoryMaps);
  const categoryId = catSlug ? slugToCategoryId.get(catSlug) ?? null : null;
  const range = p.prices?.price_range;
  const hasVariants =
    Boolean(p.has_options) ||
    p.type === 'variable' ||
    Boolean(range && (range.min_amount || range.max_amount));

  return {
    slug: p.slug,
    name: p.name,
    brand: extractBrand(p),
    categoryId,
    price,
    compareAtPrice: compareAt,
    currency: p.prices?.currency_code || 'EGP',
    discountPercent,
    priceMin: range?.min_amount ? parseMoney(range.min_amount, minor) : null,
    priceMax: range?.max_amount ? parseMoney(range.max_amount, minor) : null,
    hasVariants,
    imageUrl: p.images?.[0]?.thumbnail || p.images?.[0]?.src || null,
    description: stripHtml(p.description || p.short_description, { preserveTags: true }),
    stock: p.is_in_stock === false ? 0 : 50,
    isOnSale: Boolean(p.on_sale),
    isFeatured: false,
    isActive: true,
    sortOrder: 0,
  };
}

async function importCategories(mfbCategories) {
  const byId = new Map(mfbCategories.map((c) => [c.id, c]));
  const slugToId = new Map();
  const mfbIdToOurId = new Map();

  const sorted = [...mfbCategories].sort((a, b) => {
    const depth = (c) => {
      let d = 0;
      let cur = c;
      while (cur?.parent) {
        d += 1;
        cur = byId.get(cur.parent);
      }
      return d;
    };
    return depth(a) - depth(b);
  });

  let order = 0;
  for (const cat of sorted) {
    order += 1;
    const parentOurId = cat.parent ? mfbIdToOurId.get(cat.parent) : null;
    const isRoot = !cat.parent || cat.parent === 0;
    const row = await prisma.shopCategory.upsert({
      where: { slug: cat.slug },
      create: {
        slug: cat.slug,
        nameEn: cat.name,
        icon: isRoot ? PARENT_ICONS[cat.slug] || 'category' : null,
        parentId: parentOurId,
        sortOrder: order,
      },
      update: {
        nameEn: cat.name,
        icon: isRoot ? PARENT_ICONS[cat.slug] || 'category' : undefined,
        parentId: parentOurId,
        sortOrder: order,
      },
    });
    mfbIdToOurId.set(cat.id, row.id);
    slugToId.set(cat.slug, row.id);
  }
  return slugToId;
}

async function importProducts(mfbProducts, slugToCategoryId, categoryMaps) {
  let done = 0;
  const BATCH = 40;
  for (let i = 0; i < mfbProducts.length; i += BATCH) {
    const chunk = mfbProducts.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map((p) => {
        const data = mapProduct(p, slugToCategoryId, categoryMaps);
        return prisma.product.upsert({
          where: { slug: data.slug },
          create: data,
          update: data,
        });
      })
    );
    done += chunk.length;
    if (done % 200 === 0 || done === mfbProducts.length) {
      console.log(`[import-mfb] products ${done}/${mfbProducts.length}`);
    }
  }
}

async function main() {
  console.log('[import-mfb] fetching categories…');
  const mfbCategories = await fetchAllCategories();
  console.log(`[import-mfb] categories: ${mfbCategories.length}`);

  console.log('[import-mfb] deactivating old catalog…');
  await prisma.product.updateMany({ data: { categoryId: null } });
  await prisma.product.updateMany({ data: { isActive: false } });
  await prisma.shopCategory.deleteMany({});

  const slugToCategoryId = await importCategories(mfbCategories);
  const categoryMaps = buildCategoryMaps(mfbCategories);
  console.log(`[import-mfb] categories imported: ${slugToCategoryId.size}`);

  console.log('[import-mfb] fetching products (this may take several minutes)…');
  const mfbProducts = await fetchAllProducts((p) => {
    process.stdout.write(`\r[import-mfb] fetch page ${p.page}/${p.pages} (${p.fetched}/${p.total})   `);
  });
  console.log(`\n[import-mfb] products fetched: ${mfbProducts.length}`);

  await importProducts(mfbProducts, slugToCategoryId, categoryMaps);

  const active = await prisma.product.count({ where: { isActive: true } });
  const cats = await prisma.shopCategory.count();
  console.log('[import-mfb] done', { categories: cats, activeProducts: active });
}

main()
  .catch((e) => {
    console.error('[import-mfb] failed', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
