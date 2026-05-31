const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const massage = await prisma.product.findMany({
    where: { isActive: true, name: { contains: 'massage', mode: 'insensitive' } },
    take: 8,
    select: { name: true, slug: true, categoryId: true, brand: true },
  });
  const medical = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: 'recovery', mode: 'insensitive' } },
        { name: { contains: 'medical', mode: 'insensitive' } },
        { brand: { contains: 'medical', mode: 'insensitive' } },
      ],
    },
    take: 8,
    select: { name: true, slug: true, categoryId: true },
  });
  const cats = await prisma.shopCategory.findMany({
    where: {
      OR: [
        { slug: { in: ['massage-equipment', 'medical-equipment'] } },
        { nameEn: { contains: 'Massage', mode: 'insensitive' } },
        { nameEn: { contains: 'Recovery', mode: 'insensitive' } },
      ],
    },
    select: { id: true, slug: true, nameEn: true, parentId: true },
  });
  const uncategorizedSample = await prisma.product.findMany({
    where: { isActive: true, categoryId: null },
    take: 10,
    select: { name: true, slug: true, brand: true },
  });
  console.log(JSON.stringify({ massage, medical, cats, uncategorizedSample }, null, 2));
}

main().finally(() => prisma.$disconnect());
