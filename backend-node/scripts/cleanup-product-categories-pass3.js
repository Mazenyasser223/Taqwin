/**
 * Reassign shakers/bottles and resistance bands to correct leaf categories.
 *
 * Target tree (MFB):
 *   sports-equipment > accessories > shakers   (new)
 *   sports-equipment > resistance-bands        (existing)
 *
 * Usage:
 *   node scripts/cleanup-product-categories-pass3.js --dry-run
 *   node scripts/cleanup-product-categories-pass3.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

function decodeHtml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;/g, '–')
    .trim();
}

/** Fitness shakers / bottles / cups — not kitchen appliances. */
const SHAKER_BOTTLE_CUP =
  /\b(shaker|blender bottle|protein cup|mixing bottle|gym shaker|shaker bottle|water bottle|sports bottle|bottle set|hydra|tumbler|travel cup|protein powder shaker)\b/i;

const KITCHEN_APPLIANCE =
  /\b(hand mixer|immersion blender|stand mixer|food processor|nutri.?bullet|juicer|electric blender)\b/i;

const RESISTANCE_BAND = /\bresistance band/i;

function getPath(category) {
  const parts = [];
  let c = category;
  while (c) {
    parts.unshift(c.slug);
    c = c.parent;
  }
  return parts;
}

function isShakerProduct(name) {
  const n = decodeHtml(name);
  if (KITCHEN_APPLIANCE.test(n)) return false;
  return SHAKER_BOTTLE_CUP.test(n);
}

function isBandProduct(name) {
  return RESISTANCE_BAND.test(decodeHtml(name));
}

async function ensureShakersCategory(accessoriesId) {
  let cat = await prisma.shopCategory.findFirst({
    where: { slug: 'shakers', parentId: accessoriesId },
  });
  if (cat) return cat;

  const data = {
    slug: 'shakers',
    nameEn: 'Shakers',
    nameAr: 'شيكرات',
    icon: 'water_drop',
    parentId: accessoriesId,
    sortOrder: 5,
  };

  if (DRY_RUN) {
    console.log('[dry-run] would create category shakers under accessories');
    return { id: '__dry_run_shakers__', ...data };
  }

  cat = await prisma.shopCategory.create({ data });
  console.log('[cleanup] created category shakers');
  return cat;
}

async function main() {
  const accessories = await prisma.shopCategory.findFirst({
    where: { slug: 'accessories', parent: { slug: 'sports-equipment' } },
    include: { parent: true },
  });
  const resistanceBands = await prisma.shopCategory.findFirst({
    where: { slug: 'resistance-bands', parent: { slug: 'sports-equipment' } },
  });

  if (!accessories) {
    console.error('Missing sports-equipment > accessories category');
    process.exit(1);
  }
  if (!resistanceBands) {
    console.error('Missing sports-equipment > resistance-bands category');
    process.exit(1);
  }

  const shakersCat = await ensureShakersCategory(accessories.id);

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: { include: { parent: { include: { parent: true } } } } },
  });

  const updates = [];
  for (const p of products) {
    const name = decodeHtml(p.name);
    const path = getPath(p.category).join('/');

    if (isBandProduct(name) && p.categoryId !== resistanceBands.id) {
      updates.push({
        id: p.id,
        name: name.slice(0, 70),
        from: path,
        to: 'sports-equipment/resistance-bands',
        categoryId: resistanceBands.id,
      });
      continue;
    }

    if (isShakerProduct(name) && p.categoryId !== shakersCat.id) {
      updates.push({
        id: p.id,
        name: name.slice(0, 70),
        from: path,
        to: 'sports-equipment/accessories/shakers',
        categoryId: shakersCat.id,
      });
    }
  }

  console.log(JSON.stringify({ dryRun: DRY_RUN, updates: updates.length, samples: updates.slice(0, 20) }, null, 2));

  if (!DRY_RUN && updates.length) {
    for (const u of updates) {
      await prisma.product.update({
        where: { id: u.id },
        data: { categoryId: u.categoryId },
      });
    }
    console.log(`[cleanup] updated ${updates.length} products`);
  }

  // Verification counts
  const shakerCount = await prisma.product.count({
    where: { isActive: true, categoryId: shakersCat.id === '__dry_run_shakers__' ? undefined : shakersCat.id },
  });
  const bandCount = await prisma.product.count({
    where: { isActive: true, categoryId: resistanceBands.id },
  });

  if (!DRY_RUN) {
    const miscShakers = products.filter(
      (p) => isShakerProduct(p.name) && p.categoryId !== shakersCat.id
    ).length;
    const miscBands = products.filter(
      (p) => isBandProduct(p.name) && p.categoryId !== resistanceBands.id
    ).length;
    console.log(
      JSON.stringify(
        {
          shakersInCategory: shakerCount,
          bandsInCategory: bandCount,
          remainingMiscShakers: miscShakers,
          remainingMiscBands: miscBands,
        },
        null,
        2
      )
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
