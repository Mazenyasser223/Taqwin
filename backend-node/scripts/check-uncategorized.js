const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const uncategorized = await prisma.product.findMany({
    where: { isActive: true, categoryId: null },
    select: { slug: true },
  });
  console.log('uncategorized count', uncategorized.length);
  // Sample MFB categories for first 20 slugs would need API - skip
  const withInvalidCat = await prisma.$queryRaw`
    SELECT COUNT(*)::int as c FROM "Product" p
    WHERE p."isActive" = true AND p."categoryId" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "ShopCategory" c WHERE c.id = p."categoryId")
  `.catch(() => null);
  console.log('orphan categoryId refs', withInvalidCat);
}

main().finally(() => prisma.$disconnect());
