/**
 * Sports-focused shop catalog cleanup.
 * Usage:
 *   node scripts/cleanup-shop-catalog.js --dry-run
 *   node scripts/cleanup-shop-catalog.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const MFB = 'https://myfitnessbag.com';
const DRY_RUN = process.argv.includes('--dry-run');

function decodeHtml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseMoney(amountStr, minorUnit = 2) {
  const n = Number.parseInt(String(amountStr || '0'), 10);
  if (!Number.isFinite(n)) return 0;
  return n / 10 ** minorUnit;
}

/** Root MFB categories that are not sports/fitness retail for Taqwin shop. */
const ARCHIVE_ROOT_SLUGS = new Set(['kitchen', 'healthy-groceries']);

/** Subcategory slugs to archive (pharmacy / personal care / non-fitness). */
const ARCHIVE_CATEGORY_SLUGS = new Set([
  'medicines',
  'cough-cold-flu',
  'pain-relief',
  'beauty-cosmetics',
  'oral-care',
  'eyes-ears-nose',
  'personal-care',
  'body-care',
  'women-care',
  'men-care',
  'coffee-machines',
  'microwaves',
  'air-fryers',
  'kettles',
  'ovens-grills',
  'choppers-meat-grinders',
  'kitchen-machines-food-processors',
]);

/** Home / kitchen appliance brands — archive. */
const ARCHIVE_BRAND_PATTERNS = [
  /^black\s*&\s*decker$/i,
  /^delonghi$/i,
  /^tefal$/i,
  /^philips$/i,
  /^grand$/i,
  /^braun$/i,
  /^arzum$/i,
  /^kenwood$/i,
];

const ARCHIVE_NAME_PATTERNS = [
  /\bcoffee machine/i,
  /\bair fryer/i,
  /\bmicrowave/i,
  /\belectric kettle/i,
  /\bvacuum cleaner/i,
  /\bfood processor/i,
  /\bmeat grinder/i,
  /\boven\b/i,
  /\btoaster\b/i,
  /\bTEST PUBLISH/i,
  /^test-/i,
  /__trashed/i,
];

/** Groceries exceptions — keep if name matches sports nutrition. */
const GROCERY_KEEP_NAME =
  /\b(protein|whey|creatine|bcaa|eaa|pre[\s-]?workout|mass gainer|supplement|isolate|casein|collagen|omega|vitamin)\b/i;

const BRAND_CANONICAL = [
  [/^on$/i, 'Optimum Nutrition'],
  [/^optimum$/i, 'Optimum Nutrition'],
  [/^optimum nutrtion/i, 'Optimum Nutrition'],
  [/^optimum nutrition/i, 'Optimum Nutrition'],
  [/^myprotein$/i, 'MyProtein'],
  [/^my protein$/i, 'MyProtein'],
  [/^now$/i, 'NOW Foods'],
  [/^now foods$/i, 'NOW Foods'],
  [/^now .+/i, 'NOW Foods'],
  [/^muscletech$/i, 'MuscleTech'],
  [/^muscle tech$/i, 'MuscleTech'],
  [/^healthy & tasty$/i, 'Healthy & Tasty'],
  [/^healthy &amp; tasty$/i, 'Healthy & Tasty'],
  [/^organic nation$/i, 'Organic Nation'],
  [/^applied nutrition$/i, 'Applied Nutrition'],
  [/^puritan'?s pride$/i, "Puritan's Pride"],
];

/** Keyword → category slug (leaf preferred). */
const CATEGORY_KEYWORD_RULES = [
  [/\bcreatine\b/i, 'creatine'],
  [/\bwhey\b|\bcasein\b|\bisolate\b|\bprotein powder\b|\bprotein\b.*\b(kg|g|lb)\b/i, 'whey-protein'],
  [/\bpre[\s-]?workout\b|\bpre workout\b/i, 'pre-workout'],
  [/\bbcaa\b|\beaa\b|\bglutamine\b/i, 'bcaa-eaa-glutamine'],
  [/\bmass gainer\b|\bmass gainer\b/i, 'mass-gainers'],
  [/\bfat burner\b|\bthermogenic\b/i, 'fat-burners'],
  [/\bresistance band/i, 'resistance-bands'],
  [/\bshaker\b|\bblender bottle\b|\bprotein cup\b|\bwater bottle\b|\bsports bottle\b/i, 'shakers'],
  [/\bdumbbell\b|\bkettlebell\b/i, 'dumbbells-tires-sports-equipment'],
  [/\btreadmill\b/i, 'ac-treadmills'],
  [/\byoga mat\b|\bfoam roller\b/i, 'injury-disability-equipment'],
  [/\blifting belt\b|\bweight belt\b/i, 'accessories'],
  [/\bgym glove|\bworkout glove|\blifting glove/i, 'accessories'],
  [/\bt-shirt\b|\bhoodie\b|\bjoggers\b|\bleggings\b/i, 'man'],
  [/\bmultivitamin\b|\bvitamin\b/i, 'men'],
];

function normalizeBrand(raw) {
  let brand = decodeHtml(raw);
  if (!brand) return 'General';
  for (const [re, canonical] of BRAND_CANONICAL) {
    if (re.test(brand)) return canonical;
  }
  if (brand.length > 48 && /mg|caps|capsules|tablets|veg caps/i.test(brand)) {
    if (/^now\b/i.test(brand)) return 'NOW Foods';
    if (/^optimum/i.test(brand)) return 'Optimum Nutrition';
    if (/^muscle/i.test(brand)) return 'MuscleTech';
  }
  if (/^optimum nutrition/i.test(brand)) return 'Optimum Nutrition';
  return brand;
}

function getCategoryPath(category) {
  if (!category) return [];
  const path = [category.slug];
  let cur = category;
  while (cur.parent) {
    path.unshift(cur.parent.slug);
    cur = cur.parent;
  }
  return path;
}

function shouldArchive(product) {
  const name = decodeHtml(product.name);
  const brand = decodeHtml(product.brand);
  const path = getCategoryPath(product.category);
  const root = path[0] || null;
  const leaf = path[path.length - 1] || null;

  if (product.slug?.includes('__trashed') || product.slug?.startsWith('test-')) return 'trashed/test slug';
  for (const re of ARCHIVE_NAME_PATTERNS) {
    if (re.test(name) || re.test(product.slug || '')) return 'name/slug pattern';
  }
  for (const re of ARCHIVE_BRAND_PATTERNS) {
    if (re.test(brand)) return `brand:${brand}`;
  }
  if (root && ARCHIVE_ROOT_SLUGS.has(root)) {
    if (root === 'healthy-groceries' && GROCERY_KEEP_NAME.test(name)) return null;
    return `root:${root}`;
  }
  if (leaf && ARCHIVE_CATEGORY_SLUGS.has(leaf)) return `category:${leaf}`;
  if (root === 'pharmacy' && !/\b(vitamin|omega|supplement|creatine|protein|bcaa|zinc|magnesium)\b/i.test(name)) {
    return 'pharmacy-non-sports';
  }
  return null;
}

function pickCategorySlugByKeywords(name) {
  const n = decodeHtml(name);
  for (const [re, slug] of CATEGORY_KEYWORD_RULES) {
    if (re.test(n)) return slug;
  }
  return null;
}

async function loadCategoryMaps() {
  const rows = await prisma.shopCategory.findMany({
    include: { parent: { include: { parent: true } } },
  });
  const slugToId = new Map(rows.map((r) => [r.slug, r.id]));
  const byId = new Map(
    rows.map((r) => [
      r.id,
      {
        ...r,
        parent: r.parent ? { id: r.parent.id, slug: r.parent.slug, parent: r.parent.parent } : null,
      },
    ]),
  );
  return { slugToId, rows, byId };
}

function resolveCategoryId(slug, slugToId, rows) {
  if (slugToId.has(slug)) return slugToId.get(slug);
  const matches = rows.filter((r) => r.slug === slug);
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    const leaf = matches.find((r) => r.parentId);
    return leaf?.id ?? matches[0].id;
  }
  return null;
}

async function fetchMfbProduct(slug) {
  const url = `${MFB}/wp-json/wc/store/products?slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const json = await res.json();
  return json[0] || null;
}

async function syncFromMfb(product) {
  if (!product.slug) return {};
  const remote = await fetchMfbProduct(product.slug);
  if (!remote) return {};
  const minor = remote.prices?.currency_minor_unit ?? 2;
  const price = parseMoney(remote.prices?.price, minor);
  const regular = parseMoney(remote.prices?.regular_price, minor);
  const compareAt = regular > price ? regular : null;
  let discountPercent = null;
  if (compareAt && compareAt > price) {
    discountPercent = Math.round(((compareAt - price) / compareAt) * 100);
  }
  const patch = {};
  if (price > 1 && price < 500000) patch.price = price;
  if (compareAt) patch.compareAtPrice = compareAt;
  if (discountPercent) patch.discountPercent = discountPercent;
  patch.isOnSale = Boolean(remote.on_sale || (compareAt && compareAt > price));
  const img = remote.images?.[0]?.thumbnail || remote.images?.[0]?.src;
  if (img && (!product.imageUrl || !product.imageUrl.trim())) patch.imageUrl = img;
  patch.stock = remote.is_in_stock === false ? 0 : Math.max(product.stock || 0, 10);
  return patch;
}

async function pickFeaturedProducts() {
  const queries = [
    {
      key: 'whey',
      where: {
        isActive: true,
        stock: { gt: 0 },
        OR: [
          { name: { contains: 'whey', mode: 'insensitive' } },
          { name: { contains: 'isolate', mode: 'insensitive' } },
        ],
      },
      take: 4,
    },
    {
      key: 'creatine',
      where: {
        isActive: true,
        stock: { gt: 0 },
        name: { contains: 'creatine', mode: 'insensitive' },
      },
      take: 3,
    },
    {
      key: 'bands',
      where: {
        isActive: true,
        stock: { gt: 0 },
        name: { contains: 'resistance band', mode: 'insensitive' },
      },
      take: 2,
    },
    {
      key: 'shaker',
      where: {
        isActive: true,
        stock: { gt: 0 },
        OR: [
          { name: { contains: 'shaker', mode: 'insensitive' } },
          { name: { contains: 'blender bottle', mode: 'insensitive' } },
        ],
      },
      take: 2,
    },
    {
      key: 'pre',
      where: {
        isActive: true,
        stock: { gt: 0 },
        OR: [
          { name: { contains: 'pre-workout', mode: 'insensitive' } },
          { name: { contains: 'pre workout', mode: 'insensitive' } },
          { name: { contains: 'preworkout', mode: 'insensitive' } },
        ],
      },
      take: 3,
    },
  ];

  const picked = new Map();
  for (const q of queries) {
    const items = await prisma.product.findMany({
      where: q.where,
      orderBy: [{ isOnSale: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      take: q.take,
      select: { id: true, name: true },
    });
    for (const item of items) {
      if (!picked.has(item.id)) picked.set(item.id, item.name);
    }
  }

  return [...picked.keys()].slice(0, 20);
}

async function main() {
  console.log(`[cleanup] starting${DRY_RUN ? ' (DRY RUN)' : ''}…`);

  const { slugToId, rows } = await loadCategoryMaps();

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: {
        include: { parent: { include: { parent: true } } },
      },
    },
  });

  const stats = {
    total: products.length,
    archived: 0,
    brandUpdated: 0,
    categoryUpdated: 0,
    priceFixed: 0,
    imageFixed: 0,
    stockUpdated: 0,
    featured: 0,
    archiveReasons: {},
  };

  const toArchive = [];
  const toUpdate = [];
  const stockArchive = [];

  for (const product of products) {
    const reason = shouldArchive(product);
    if (reason) {
      toArchive.push({ id: product.id, reason });
      stats.archiveReasons[reason] = (stats.archiveReasons[reason] || 0) + 1;
      continue;
    }

    const patch = {};
    const brand = normalizeBrand(product.brand);
    if (brand !== product.brand) {
      patch.brand = brand;
      stats.brandUpdated += 1;
    }

    const keywordSlug = pickCategorySlugByKeywords(product.name);
    if (keywordSlug) {
      const categoryId = resolveCategoryId(keywordSlug, slugToId, rows);
      if (categoryId && categoryId !== product.categoryId) {
        patch.categoryId = categoryId;
        stats.categoryUpdated += 1;
      }
    } else if (!product.categoryId) {
      const fallback =
        resolveCategoryId('accessories', slugToId, rows) ||
        resolveCategoryId('supplements', slugToId, rows);
      if (fallback) {
        patch.categoryId = fallback;
        stats.categoryUpdated += 1;
      }
    }

    const badPrice = product.price <= 1 || product.price >= 500000;
    const noImage = !product.imageUrl || !product.imageUrl.trim();
    const zeroStock = product.stock === 0;

    if (Object.keys(patch).length || badPrice || noImage || zeroStock) {
      toUpdate.push({ product, patch, badPrice, noImage, zeroStock });
    }
  }

  console.log(`[cleanup] archive candidates: ${toArchive.length}`);
  if (!DRY_RUN && toArchive.length) {
    const BATCH = 100;
    for (let i = 0; i < toArchive.length; i += BATCH) {
      const ids = toArchive.slice(i, i + BATCH).map((x) => x.id);
      await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
    }
    stats.archived = toArchive.length;
  } else {
    stats.archived = toArchive.length;
  }

  console.log(`[cleanup] brand/category/stock patches: ${toUpdate.length}`);
  for (let i = 0; i < toUpdate.length; i++) {
    const { product, patch, badPrice, noImage, zeroStock } = toUpdate[i];
    let data = { ...patch };
    let mfbPatch = {};

    if ((badPrice || noImage || zeroStock) && product.slug && !DRY_RUN) {
      await sleep(120);
      mfbPatch = await syncFromMfb(product);
      if (badPrice && mfbPatch.price) {
        data = { ...data, price: mfbPatch.price };
        if (mfbPatch.compareAtPrice) data.compareAtPrice = mfbPatch.compareAtPrice;
        if (mfbPatch.discountPercent) data.discountPercent = mfbPatch.discountPercent;
        if (mfbPatch.isOnSale !== undefined) data.isOnSale = mfbPatch.isOnSale;
        stats.priceFixed += 1;
      } else if (badPrice && !DRY_RUN) {
        stockArchive.push({ id: product.id, reason: 'bad-price-no-mfb' });
        continue;
      }
      if (noImage && mfbPatch.imageUrl) {
        data.imageUrl = mfbPatch.imageUrl;
        stats.imageFixed += 1;
      }
      if (zeroStock) {
        if (mfbPatch.stock === 0) {
          stockArchive.push({ id: product.id, reason: 'mfb-out-of-stock' });
          continue;
        }
        if (mfbPatch.stock > 0) {
          data.stock = mfbPatch.stock;
          stats.stockUpdated += 1;
        }
      }
    } else if ((badPrice || noImage || zeroStock) && DRY_RUN) {
      if (badPrice) stats.priceFixCandidates = (stats.priceFixCandidates || 0) + 1;
      if (noImage) stats.imageFixCandidates = (stats.imageFixCandidates || 0) + 1;
      if (zeroStock) stats.stockCheckCandidates = (stats.stockCheckCandidates || 0) + 1;
    }

    if (Object.keys(data).length && !DRY_RUN) {
      await prisma.product.update({ where: { id: product.id }, data });
    }

    if ((i + 1) % 100 === 0) console.log(`[cleanup] updated ${i + 1}/${toUpdate.length}`);
  }

  if (stockArchive.length) {
    console.log(`[cleanup] archiving ${stockArchive.length} out-of-stock / bad-price products`);
    stats.stockArchived = stockArchive.length;
    if (!DRY_RUN) {
      const BATCH = 100;
      for (let i = 0; i < stockArchive.length; i += BATCH) {
        const ids = stockArchive.slice(i, i + BATCH).map((x) => x.id);
        await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
      }
      stats.archived += stockArchive.length;
    }
  }

  const featuredIds = await pickFeaturedProducts();
  stats.featured = featuredIds.length;
  if (!DRY_RUN) {
    await prisma.product.updateMany({ where: { isActive: true }, data: { isFeatured: false } });
    if (featuredIds.length) {
      await prisma.product.updateMany({
        where: { id: { in: featuredIds } },
        data: { isFeatured: true },
      });
    }
  }

  const afterActive = DRY_RUN
    ? products.length - toArchive.length
    : await prisma.product.count({ where: { isActive: true } });
  const afterFeatured = DRY_RUN
    ? featuredIds.length
    : await prisma.product.count({ where: { isActive: true, isFeatured: true } });
  const afterNoImg = DRY_RUN
    ? null
    : await prisma.product.count({
        where: { isActive: true, OR: [{ imageUrl: null }, { imageUrl: '' }] },
      });
  const afterBadPrice = DRY_RUN
    ? null
    : await prisma.product.count({
        where: { isActive: true, OR: [{ price: { lte: 1 } }, { price: { gte: 500000 } }] },
      });

  console.log(
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        before: { active: products.length },
        actions: stats,
        after: {
          activeProducts: afterActive,
          featuredProducts: afterFeatured,
          missingImage: afterNoImg,
          badPrices: afterBadPrice,
        },
        featuredSample: featuredIds.slice(0, 20),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error('[cleanup] failed', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
