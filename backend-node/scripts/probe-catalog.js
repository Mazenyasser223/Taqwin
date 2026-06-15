const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const roots = await prisma.shopCategory.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: 'asc' },
    select: { slug: true, nameEn: true },
  });
  console.log('ROOT CATEGORIES:');
  for (const r of roots) {
    const count = await prisma.product.count({
      where: { isActive: true, category: { OR: [{ slug: r.slug }, { parent: { slug: r.slug } }] } },
    });
    console.log(`  ${r.slug} (${r.nameEn}): ${count}`);
  }

  const brands = await prisma.product.groupBy({
    by: ['brand'],
    where: { isActive: true },
    _count: { _all: true },
    orderBy: { _count: { brand: 'desc' } },
    take: 50,
  });
  console.log('\nTOP BRANDS:');
  for (const b of brands) console.log(`  ${b._count._all}\t${b.brand}`);

  const brandDupes = brands.filter((b) =>
    /optimum|myprotein|my protein|on\b/i.test(b.brand),
  );
  console.log('\nBRAND DUPES (optimum/myprotein):');
  for (const b of brandDupes) console.log(`  ${b._count._all}\t${b.brand}`);

  const badPrices = await prisma.product.count({
    where: { isActive: true, OR: [{ price: { lte: 1 } }, { price: { gte: 500000 } }] },
  });
  console.log('\nBad prices (<=1 or >=500k):', badPrices);

  const zeroStock = await prisma.product.count({ where: { isActive: true, stock: 0 } });
  console.log('Zero stock active:', zeroStock);

  const featured = await prisma.product.count({ where: { isActive: true, isFeatured: true } });
  console.log('Featured active:', featured);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
