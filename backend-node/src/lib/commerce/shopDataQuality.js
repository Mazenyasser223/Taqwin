/**
 * Weekly shop data quality report — featured, brands, images, nutrition, categories.
 */
const { prisma } = require('../../db');

const NUTRITION_PATTERN =
  /nutrition\s*facts|nutritional\s*information|serving\s*size|calories|per\s*serving|macros/i;

function productHasNutrition(product) {
  const text = `${product.description || ''} ${product.descriptionAr || ''}`;
  return NUTRITION_PATTERN.test(text);
}

/**
 * @param {{ limit?: number }} [opts]
 */
async function getShopDataQualityReport(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 20, 5), 100);

  const [products, categories, featured, noImage, noBrand, noCategory, noNutrition, emptyCategories] =
    await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.shopCategory.count(),
      prisma.product.findMany({
        where: { isActive: true, isFeatured: true },
        select: { id: true, name: true, nameAr: true, imageUrl: true, stock: true, brand: true },
        take: limit,
      }),
      prisma.product.findMany({
        where: {
          isActive: true,
          OR: [{ imageUrl: null }, { imageUrl: '' }],
        },
        select: { id: true, name: true, brand: true },
        take: limit,
      }),
      prisma.product.findMany({
        where: { isActive: true, brand: '' },
        select: { id: true, name: true },
        take: limit,
      }),
      prisma.product.findMany({
        where: { isActive: true, categoryId: null },
        select: { id: true, name: true, brand: true },
        take: limit,
      }),
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          brand: true,
          description: true,
          descriptionAr: true,
          category: { select: { slug: true, nameEn: true } },
        },
        take: 200,
      }),
      prisma.shopCategory.findMany({
        where: { parentId: null },
        include: { _count: { select: { products: true } } },
        take: 100,
      }),
    ]);

  const supplementNoNutrition = noNutrition
    .filter((p) => {
      const slug = p.category?.slug || '';
      const isSupp =
        /supplement|whey|creatine|protein|vitamin/i.test(slug) ||
        /\b(whey|creatine|protein|bcaa|pre-workout)\b/i.test(`${p.name} ${p.brand}`);
      return isSupp && !productHasNutrition(p);
    })
    .slice(0, limit)
    .map(({ id, name, brand }) => ({ id, name, brand }));

  const featuredIssues = featured.filter((p) => !p.imageUrl || (p.stock ?? 0) <= 0);

  const brands = await prisma.product.groupBy({
    by: ['brand'],
    where: { isActive: true, brand: { not: '' } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  });

  const emptyCats = emptyCategories.filter((c) => c._count.products === 0);

  const scoreParts = [
    featuredIssues.length === 0 ? 20 : Math.max(0, 20 - featuredIssues.length * 4),
    noImage.length === 0 ? 20 : Math.max(0, 20 - Math.min(noImage.length, 5) * 4),
    noBrand.length === 0 ? 15 : Math.max(0, 15 - Math.min(noBrand.length, 5) * 3),
    noCategory.length === 0 ? 15 : Math.max(0, 15 - Math.min(noCategory.length, 5) * 3),
    supplementNoNutrition.length === 0 ? 15 : Math.max(0, 15 - Math.min(supplementNoNutrition.length, 5) * 3),
    emptyCats.length === 0 ? 15 : Math.max(0, 15 - Math.min(emptyCats.length, 5) * 3),
  ];
  const qualityScore = scoreParts.reduce((a, b) => a + b, 0);

  return {
    generatedAt: new Date().toISOString(),
    qualityScore,
    summary: {
      activeProducts: products,
      categories: categories,
      featuredCount: featured.length,
      featuredIssues: featuredIssues.length,
      missingImages: noImage.length,
      missingBrand: noBrand.length,
      missingCategory: noCategory.length,
      supplementsMissingNutrition: supplementNoNutrition.length,
      emptyCategories: emptyCats.length,
    },
    featuredIssues,
    missingImages: noImage,
    missingBrand: noBrand,
    missingCategory: noCategory,
    supplementsMissingNutrition: supplementNoNutrition,
    emptyCategories: emptyCats.map((c) => ({ id: c.id, slug: c.slug, nameEn: c.nameEn, nameAr: c.nameAr })),
    topBrands: brands.map((b) => ({ brand: b.brand, productCount: b._count.id })),
    weeklyChecklist: [
      'Review featured products — image + stock',
      'Verify brand names are consistent',
      'Fix products missing images',
      'Add nutrition facts to supplements',
      'Remove or fill empty categories',
    ],
  };
}

module.exports = { getShopDataQualityReport, productHasNutrition };
