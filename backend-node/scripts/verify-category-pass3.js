/**
 * Verify pass3 category cleanup + search suggestions impact.
 */
const { PrismaClient } = require('@prisma/client');
const { getShopSearchSuggestions } = require('../src/lib/shopSearchSuggestions');

const prisma = new PrismaClient();

function path(cat) {
  const p = [];
  let c = cat;
  while (c) {
    p.unshift(c.nameEn);
    c = c.parent;
  }
  return p.join(' > ');
}

async function main() {
  const shakers = await prisma.shopCategory.findFirst({
    where: { slug: 'shakers' },
    include: { parent: { include: { parent: true } } },
  });
  const bands = await prisma.shopCategory.findFirst({
    where: { slug: 'resistance-bands' },
    include: { parent: true },
  });

  const shakerProducts = await prisma.product.findMany({
    where: { isActive: true, categoryId: shakers?.id },
    select: { name: true, slug: true, categoryId: true },
  });
  const bandProducts = await prisma.product.findMany({
    where: { isActive: true, categoryId: bands?.id },
    select: { name: true, slug: true },
  });

  const wrongKitchen = await prisma.product.count({
    where: {
      isActive: true,
      name: { contains: 'shaker', mode: 'insensitive' },
      category: { slug: 'hand-mixers-blenders' },
    },
  });

  const sample = shakerProducts[0];
  let related = [];
  if (sample?.categoryId) {
    related = await prisma.product.findMany({
      where: {
        isActive: true,
        categoryId: sample.categoryId,
        id: { not: sample.id ?? undefined },
      },
      take: 8,
      select: { name: true },
    });
  }

  const suggestions = await getShopSearchSuggestions(8);

  console.log(
    JSON.stringify(
      {
        shakersCategory: shakers ? path(shakers) : null,
        bandsCategory: bands ? path(bands) : null,
        shakerCount: shakerProducts.length,
        bandCount: bandProducts.length,
        shakersStillInKitchen: wrongKitchen,
        sampleShaker: sample
          ? { name: sample.name, slug: sample.slug, breadcrumb: shakers ? path(shakers) : null }
          : null,
        relatedInShakers: related.map((r) => r.name.slice(0, 50)),
        searchSuggestions: suggestions,
      },
      null,
      2
    )
  );
}

main().finally(() => prisma.$disconnect());
