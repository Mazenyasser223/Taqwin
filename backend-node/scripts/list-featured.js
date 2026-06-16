const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const featured = await prisma.product.findMany({
    where: { isActive: true, isFeatured: true },
    select: {
      name: true,
      brand: true,
      category: { select: { nameEn: true, parent: { select: { nameEn: true } } } },
    },
    orderBy: { name: 'asc' },
  });
  for (const x of featured) {
    const cat = `${x.category?.parent?.nameEn || ''} > ${x.category?.nameEn || ''}`;
    console.log(`${x.brand} | ${x.name.slice(0, 70)} | ${cat}`);
  }
  const active = await prisma.product.count({ where: { isActive: true } });
  console.log('\nActive products:', active);
}

main().finally(() => prisma.$disconnect());
