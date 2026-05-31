/**
 * Count active products per sidebar category (includes descendants).
 * Usage: node scripts/audit-category-products.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCategoryDescendantIds(rootId) {
  const all = await prisma.shopCategory.findMany({ select: { id: true, parentId: true } });
  const ids = [rootId];
  const queue = [rootId];
  while (queue.length) {
    const pid = queue.shift();
    for (const c of all.filter((x) => x.parentId === pid)) {
      ids.push(c.id);
      queue.push(c.id);
    }
  }
  return ids;
}

async function countForCategoryId(categoryId) {
  const ids = await getCategoryDescendantIds(categoryId);
  return prisma.product.count({
    where: { isActive: true, categoryId: { in: ids } },
  });
}

function walkCategories(nodes, depth, rows) {
  for (const node of nodes) {
    rows.push({ slug: node.slug, nameEn: node.nameEn, depth });
    if (node.children?.length) walkCategories(node.children, depth + 1, rows);
  }
}

async function main() {
  const all = await prisma.shopCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
  });
  const byId = new Map(all.map((c) => [c.id, c]));
  const parents = all.filter((c) => !c.parentId);

  const onSale = await prisma.product.count({ where: { isActive: true, isOnSale: true } });
  const allActive = await prisma.product.count({ where: { isActive: true } });
  const uncategorized = await prisma.product.count({
    where: { isActive: true, categoryId: null },
  });

  const rootResults = [];
  for (const p of parents) {
    const count = await countForCategoryId(p.id);
    rootResults.push({
      slug: p.slug,
      nameEn: p.nameEn,
      productCount: count,
      empty: count === 0,
    });
  }

  const allSlugs = [];
  function buildChildren(parentId) {
    return all
      .filter((c) => c.parentId === parentId)
      .map((c) => ({
        slug: c.slug,
        nameEn: c.nameEn,
        children: buildChildren(c.id),
      }));
  }
  const tree = parents.map((p) => ({
    slug: p.slug,
    nameEn: p.nameEn,
    children: buildChildren(p.id),
  }));
  const flat = [];
  walkCategories(tree, 0, flat);

  const leafAndBranch = [];
  for (const row of flat) {
    const cat = all.find((c) => c.slug === row.slug);
    if (!cat) continue;
    const count = await countForCategoryId(cat.id);
    leafAndBranch.push({
      slug: row.slug,
      nameEn: row.nameEn,
      depth: row.depth,
      productCount: count,
      empty: count === 0,
    });
  }

  const emptyRoots = rootResults.filter((r) => r.empty);
  const emptyAll = leafAndBranch.filter((r) => r.empty);

  console.log(
    JSON.stringify(
      {
        summary: {
          allActiveProducts: allActive,
          uncategorizedProducts: uncategorized,
          onSaleProducts: onSale,
          rootCategories: rootResults.length,
          emptyRootCategories: emptyRoots.length,
          emptyCategoriesTotal: emptyAll.length,
          categoriesInTree: leafAndBranch.length,
        },
        specialFilters: {
          offersOnSale: onSale,
          allCategoriesNote:
            'All categories in browse shows products only when a root/sub slug is selected; uncategorized items appear only via onSale/search or if browse loads all — check UI.',
        },
        rootCategories: rootResults.sort((a, b) => a.productCount - b.productCount),
        emptyRootCategories: emptyRoots,
        emptyCategories: emptyAll,
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
