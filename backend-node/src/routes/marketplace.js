/**
 * Marketplace routes — products, categories, and orders.
 *
 *   GET   /api/marketplace/categories
 *   GET   /api/marketplace/products?search=&brand=&category=&onSale=
 *   GET   /api/marketplace/products/:id
 *   POST  /api/marketplace/orders
 *   GET   /api/marketplace/orders/me
 *   GET   /api/marketplace/orders/:id
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { emitNotification } = require('../lib/notifications');
const { normalizeProduct, normalizeCategory } = require('../lib/shopProduct');

const router = express.Router();
router.use(authMiddleware);

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const listSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    brand: z.string().optional(),
    category: z.string().optional(),
    onSale: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

function buildCategoryChildren(all, parentId) {
  return all
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn))
    .map((c) => {
      const kids = buildCategoryChildren(all, c.id);
      return {
        id: c.id,
        slug: c.slug,
        nameEn: c.nameEn,
        nameAr: c.nameAr,
        icon: c.icon,
        parentId: c.parentId,
        sortOrder: c.sortOrder,
        ...(kids.length ? { children: kids } : {}),
      };
    });
}

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

const orderCreateSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().int().positive().max(100),
        })
      )
      .min(1),
  }),
});

const productInclude = { category: true };

const listProductSelect = {
  id: true,
  slug: true,
  name: true,
  nameAr: true,
  brand: true,
  categoryId: true,
  price: true,
  compareAtPrice: true,
  currency: true,
  discountPercent: true,
  priceMin: true,
  priceMax: true,
  hasVariants: true,
  imageUrl: true,
  stock: true,
  isOnSale: true,
  isFeatured: true,
  isActive: true,
  sortOrder: true,
  category: {
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameAr: true,
      icon: true,
      parentId: true,
    },
  },
};

async function attachProductCounts(all, childrenOf) {
  const direct = new Map();
  const [rows, previewRows] = await Promise.all([
    prisma.product.groupBy({
      by: ['categoryId'],
      where: { isActive: true, categoryId: { not: null } },
      _count: { _all: true },
    }),
    prisma.$queryRaw`
      SELECT DISTINCT ON (p.category_id) p.category_id::text AS id, p.image_url AS url
      FROM products p
      WHERE p.is_active = true
        AND p.category_id IS NOT NULL
        AND p.image_url IS NOT NULL
        AND p.image_url <> ''
      ORDER BY p.category_id, p.is_featured DESC, p.name ASC
    `,
  ]);

  for (const row of rows) {
    direct.set(row.categoryId, row._count._all);
  }
  const previewById = new Map(previewRows.map((r) => [r.id, r.url]));

  function countFor(id) {
    let total = direct.get(id) || 0;
    for (const child of childrenOf(id)) {
      total += countFor(child.id);
    }
    return total;
  }
  const countById = new Map(all.map((c) => [c.id, countFor(c.id)]));
  function withCounts(parentId) {
    return childrenOf(parentId).map((c) => ({
      ...c,
      productCount: countById.get(c.id) || 0,
      previewImageUrl: previewById.get(c.id) ?? null,
      children: withCounts(c.id),
    }));
  }
  return { countById, withCounts, previewById };
}

router.get('/categories', async (req, res, next) => {
  try {
    const all = await prisma.shopCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    });
    const childrenOf = (parentId) =>
      all.filter((c) => c.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    const { countById, withCounts, previewById } = await attachProductCounts(all, childrenOf);
    const parents = all.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    const tree = parents.map((p) =>
      normalizeCategory(
        {
          ...p,
          productCount: countById.get(p.id) || 0,
          previewImageUrl: previewById.get(p.id) ?? null,
        },
        withCounts(p.id)
      )
    );
    res.json(tree);
  } catch (err) {
    next(err);
  }
});

router.get('/products', validate(listSchema), async (req, res, next) => {
  try {
    const where = { isActive: true };

    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search, mode: 'insensitive' } },
        { brand: { contains: req.query.search, mode: 'insensitive' } },
        { nameAr: { contains: req.query.search, mode: 'insensitive' } },
      ];
    }

    if (req.query.brand) {
      where.brand = { equals: req.query.brand, mode: 'insensitive' };
    }

    if (req.query.onSale === 'true') {
      where.isOnSale = true;
    }

    if (req.query.category) {
      const cat = await prisma.shopCategory.findUnique({ where: { slug: req.query.category } });
      if (cat) {
        const ids = await getCategoryDescendantIds(cat.id);
        where.categoryId = { in: ids };
      } else {
        where.categoryId = { in: [] };
      }
    }

    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 48, 100);
    const skip = (page - 1) * limit;

    const total = await prisma.product.count({ where });
    const products = await prisma.product.findMany({
      where,
      select: listProductSelect,
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      skip,
      take: limit,
    });

    res.json({
      items: products.map(normalizeProduct),
      total,
      page,
      perPage: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/products/:id', validate(idParam), async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: productInclude,
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(normalizeProduct(product));
  } catch (err) {
    next(err);
  }
});

router.post('/orders', validate(orderCreateSchema), async (req, res, next) => {
  try {
    const productIds = req.body.items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } });
    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products are unavailable' });
    }
    const productMap = new Map(products.map((p) => [p.id, p]));
    let total = 0;
    const itemsData = req.body.items.map((i) => {
      const p = productMap.get(i.productId);
      total += p.price * i.quantity;
      return { productId: p.id, quantity: i.quantity, unitPrice: p.price };
    });

    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        total,
        items: { createMany: { data: itemsData } },
      },
      include: { items: { include: { product: { include: productInclude } } } },
    });

    const currency = products[0]?.currency || 'EGP';
    emitNotification({
      userId: req.user.id,
      type: 'order.placed',
      title: 'Order placed',
      message: `Your order for ${total.toFixed(0)} ${currency} is pending confirmation.`,
      link: '/orders',
    });

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

router.get('/orders/me', async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: { include: { product: { include: productInclude } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

router.get('/orders/:id', validate(idParam), async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: { include: productInclude } } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
