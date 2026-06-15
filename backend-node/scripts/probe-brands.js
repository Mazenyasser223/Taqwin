const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { brand: { contains: 'optimum', mode: 'insensitive' } },
        { brand: { contains: 'myprotein', mode: 'insensitive' } },
        { brand: { contains: 'my protein', mode: 'insensitive' } },
        { brand: { equals: 'ON', mode: 'insensitive' } },
        { brand: { contains: 'now', mode: 'insensitive' } },
        { brand: { contains: 'muscletech', mode: 'insensitive' } },
      ],
    },
    select: { brand: true },
    distinct: ['brand'],
  });
  console.log(brands.map((b) => b.brand));
}

main().finally(() => prisma.$disconnect());
