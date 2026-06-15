/**
 * Set stock = 0 for archived products that belong to Taqwin shop
 * (demo/seed catalog, Taqwin brands, sports categories) — not MFB bulk off-topic imports.
 *
 * Usage:
 *   node scripts/zero-archived-site-stock.js --dry-run
 *   node scripts/zero-archived-site-stock.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

const OFF_TOPIC_ROOTS = new Set([
  'kitchen',
  'healthy-groceries',
  'pharmacy',
  'beauty-cosmetics',
  'personal-care',
  'body-care',
]);

const TAQWIN_ROOTS = new Set([
  'supplements',
  'equipment',
  'apparel',
  'accessories',
  'offers',
  'sports-nutrition',
  'sports-equipment',
  'fitness-equipment',
]);

function getPath(category) {
  const path = [];
  let c = category;
  while (c) {
    path.unshift(c.slug);
    c = c.parent;
  }
  return path;
}

/** Archived product is Taqwin-site catalog, not MFB off-topic bulk. */
function isSiteRelated(product) {
  const brand = (product.brand || '').trim().toLowerCase();
  if (brand.startsWith('taqwin')) return true;

  const root = getPath(product.category)[0];
  if (root && TAQWIN_ROOTS.has(root)) return true;
  if (root && OFF_TOPIC_ROOTS.has(root)) return false;

  // Seed / demo sports products without MFB category mapping
  if (!product.categoryId) return true;

  return false;
}

async function main() {
  const archived = await prisma.product.findMany({
    where: { isActive: false, stock: { gt: 0 } },
    include: { category: { include: { parent: { include: { parent: true } } } } },
  });

  const targets = archived.filter(isSiteRelated);
  const skipped = archived.length - targets.length;

  if (!targets.length) {
    console.log(JSON.stringify({ updated: 0, skipped, message: 'Nothing to update' }, null, 2));
    return;
  }

  if (DRY_RUN) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          wouldUpdate: targets.length,
          skippedOffTopic: skipped,
          samples: targets.slice(0, 15).map((p) => ({
            id: p.id,
            stock: p.stock,
            brand: p.brand,
            name: p.name.slice(0, 60),
          })),
        },
        null,
        2
      )
    );
    return;
  }

  const ids = targets.map((p) => p.id);
  const result = await prisma.product.updateMany({
    where: { id: { in: ids } },
    data: { stock: 0 },
  });

  console.log(
    JSON.stringify(
      {
        updated: result.count,
        skippedOffTopic: skipped,
        ids: ids.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
