const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const subs = await prisma.shopCategory.findMany({
    where: { parentId: { not: null } },
    select: { slug: true, nameEn: true, parent: { select: { slug: true, nameEn: true } } },
    orderBy: { nameEn: 'asc' },
  });
  console.log('SUBCATEGORIES:', subs.length);
  for (const s of subs.slice(0, 80)) {
    console.log(`  ${s.parent?.slug}/${s.slug} - ${s.nameEn}`);
  }
  const taqwin = await prisma.shopCategory.findMany({
    where: { slug: { in: ['supplements', 'equipment', 'apparel', 'accessories', 'offers', 'protein', 'creatine', 'pre-workout', 'bands', 'hydration'] } },
    select: { id: true, slug: true, nameEn: true, parentId: true },
  });
  console.log('\nTAQWIN-LIKE SLUGS:', taqwin);
}

main().finally(() => prisma.$disconnect());
