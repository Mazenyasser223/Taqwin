/**
 * Ensure every active product has Description + Key Highlights + How to Use in DB.
 * Usage: node scripts/ensure-product-sections.js [--dry-run]
 */
const { PrismaClient } = require('@prisma/client');
const {
  ensureProductDescription,
  productHasAllSections,
} = require('../src/lib/ensureProductDescription');

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { name: 'asc' },
  });

  let alreadyComplete = 0;
  let updated = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    if (productHasAllSections(p.description)) {
      alreadyComplete += 1;
      continue;
    }
    const next = ensureProductDescription(p);
    if (next === (p.description || '').trim()) continue;
    updated += 1;
    if (!dryRun) {
      await prisma.product.update({
        where: { id: p.id },
        data: { description: next },
      });
    }
    if ((i + 1) % 250 === 0 || i + 1 === products.length) {
      console.log(`[ensure] progress ${i + 1}/${products.length} (updated ${updated})`);
    }
  }

  const audit = await prisma.product.findMany({
    where: { isActive: true },
    select: { description: true },
  });
  let complete = 0;
  let empty = 0;
  for (const p of audit) {
    if (!p.description?.trim()) empty += 1;
    else if (productHasAllSections(p.description)) complete += 1;
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        totalActive: products.length,
        alreadyComplete,
        updated,
        after: {
          withAllSections: complete,
          emptyDescription: empty,
          pctComplete: `${((complete / audit.length) * 100).toFixed(1)}%`,
        },
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
