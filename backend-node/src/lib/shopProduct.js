/** API shape for marketplace products (includes nested category). */

const { ensureProductDescription } = require('./ensureProductDescription');

function normalizeProduct(row) {
  if (!row) return null;
  const { category, ...rest } = row;
  const normalizedCategory = category
    ? {
        id: category.id,
        slug: category.slug,
        nameEn: category.nameEn,
        nameAr: category.nameAr,
        icon: category.icon,
        parentId: category.parentId,
      }
    : null;

  const out = {
    ...rest,
    category: normalizedCategory,
  };

  if (Object.prototype.hasOwnProperty.call(row, 'description')) {
    out.description = ensureProductDescription({
      ...rest,
      category: normalizedCategory,
    });
  }

  return out;
}

function normalizeCategoryNode(c) {
  const kids = (c.children || []).filter((child) => (child.productCount ?? 0) > 0);
  return {
    id: c.id,
    slug: c.slug,
    nameEn: c.nameEn,
    nameAr: c.nameAr ?? null,
    icon: c.icon ?? null,
    parentId: c.parentId ?? null,
    sortOrder: c.sortOrder ?? 0,
    productCount: c.productCount ?? 0,
    previewImageUrl: c.previewImageUrl ?? null,
    ...(kids.length ? { children: kids.map(normalizeCategoryNode) } : {}),
  };
}

function normalizeCategory(row, children = []) {
  if (!row) return null;
  return normalizeCategoryNode({ ...row, children });
}

module.exports = { normalizeProduct, normalizeCategory };
