/**
 * Audit shop catalog: images, prices, categories.
 * Usage: node scripts/audit-shop-catalog.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const active = await prisma.product.count({ where: { isActive: true } });
  const noImage = await prisma.product.count({
    where: { isActive: true, OR: [{ imageUrl: null }, { imageUrl: '' }] },
  });
  const noCategory = await prisma.product.count({
    where: { isActive: true, categoryId: null },
  });
  const onSale = await prisma.product.count({ where: { isActive: true, isOnSale: true } });
  const categories = await prisma.shopCategory.count();
  const roots = await prisma.shopCategory.count({ where: { parentId: null } });

  const sampleNoImg = await prisma.product.findMany({
    where: { isActive: true, OR: [{ imageUrl: null }, { imageUrl: '' }] },
    take: 5,
    select: { slug: true, name: true },
  });

  const brokenSamples = [];
  const withImage = await prisma.product.findMany({
    where: { isActive: true, imageUrl: { not: null } },
    take: 12,
    select: { imageUrl: true, slug: true },
  });
  for (const p of withImage) {
    try {
      const res = await fetch(p.imageUrl, { method: 'HEAD', redirect: 'follow' });
      if (!res.ok) brokenSamples.push({ slug: p.slug, status: res.status, url: p.imageUrl });
    } catch (e) {
      brokenSamples.push({ slug: p.slug, error: e.message, url: p.imageUrl });
    }
  }

  console.log(
    JSON.stringify(
      {
        activeProducts: active,
        categories,
        rootCategories: roots,
        onSale,
        missingImage: noImage,
        missingCategory: noCategory,
        imageReachabilitySample: {
          checked: withImage.length,
          broken: brokenSamples.length,
          brokenSamples,
        },
        sampleProductsWithoutImage: sampleNoImg,
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
