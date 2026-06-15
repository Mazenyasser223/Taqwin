/**
 * Marketplace routes — products, categories, checkout, and orders.
 *
 *   GET   /api/marketplace/categories
 *   GET   /api/marketplace/search/suggestions
 *   GET   /api/marketplace/products?search=&brand=&category=&onSale=
 *   GET   /api/marketplace/products/by-slug/:slug
 *   GET   /api/marketplace/products/:id
 *   POST  /api/marketplace/checkout/preview
 *   POST  /api/marketplace/orders
 *   POST  /api/marketplace/orders/:id/confirm-payment
 *   GET   /api/marketplace/orders/me
 *   GET   /api/marketplace/orders/:id
 *
 * Payments: POST /api/marketplace/payments/create + /webhook
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { normalizeProduct, normalizeCategory } = require('../lib/shopProduct');
const { getShopSearchSuggestions } = require('../lib/shopSearchSuggestions');
const { getShippingRules } = require('../lib/shopShipping');
const marketplaceOptimizationRoutes = require('./marketplaceOptimization');
const marketplaceMarketingRoutes = require('./marketplaceMarketing');
const { recordFunnelEvent } = require('../lib/commerce/shopFunnel');
const { funnelEventsLimiter } = require('../middleware/rateLimitApi');
const { computeCheckoutTotals } = require('../lib/checkoutTotals');
const { createCheckoutOrder, confirmMockPayment, loadProductsForItems } = require('../lib/orderCheckout');
const {
  createStripeCheckoutSession,
  syncStripeOrderForUser,
} = require('../lib/stripeCheckout');
const { isStripeEnabled, isStripeTestMode } = require('../services/stripeClient');

const router = express.Router();

/** Public — cart shipping fee rules */
router.get('/shipping-rules', (_req, res) => {
  res.json(getShippingRules());
});

const funnelPublicSchema = z.object({
  body: z.object({
    sessionId: z.string().min(8).max(128),
    step: z.enum(['visit', 'search', 'product_view', 'add_to_cart', 'checkout_start', 'paid']),
    productId: z.string().uuid().optional(),
    query: z.string().max(256).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

/** Public funnel tracking (anonymous + authenticated via optional later enrichment) */
router.post('/funnel/events', funnelEventsLimiter, validate(funnelPublicSchema), async (req, res, next) => {
  try {
    const row = await recordFunnelEvent({
      userId: null,
      ...req.body,
    });
    res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    next(err);
  }
});

router.use(authMiddleware);

router.use(marketplaceOptimizationRoutes);
router.use('/marketing', marketplaceMarketingRoutes);

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const listSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    brand: z.string().optional(),
    category: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    excludeId: z.string().uuid().optional(),
    onSale: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

const slugParam = z.object({
  params: z.object({ slug: z.string().min(1).max(512) }),
});

const cartItemsSchema = z
  .array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive().max(100),
    })
  )
  .min(1);

const shippingSchema = z.object({
  governorate: z.string().min(2).max(80),
  city: z.string().min(2).max(80),
  address: z.string().min(5).max(500),
  phone: z.string().min(10).max(20),
});

const checkoutPreviewSchema = z.object({
  body: z.object({
    items: cartItemsSchema,
    governorate: z.string().min(2).max(80),
  }),
});

const orderCreateSchema = z.object({
  body: z.object({
    items: cartItemsSchema,
    shipping: shippingSchema,
    paymentMethod: z.enum(['cod', 'card', 'fawry', 'wallet']),
  }),
});

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

const productInclude = { category: true };

const orderInclude = {
  items: { include: { product: { include: productInclude } } },
  payments: { orderBy: { createdAt: 'desc' } },
};

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
  avgRating: true,
  reviewCount: true,
  wishlistCount: true,
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

router.get('/search/suggestions', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 6, 12);
    const items = await getShopSearchSuggestions(limit);
    res.json(items);
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
    } else if (req.query.categoryId) {
      const ids = await getCategoryDescendantIds(req.query.categoryId);
      where.categoryId = { in: ids };
    }

    if (req.query.excludeId) {
      where.id = { not: req.query.excludeId };
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

router.get('/products/by-slug/:slug', validate(slugParam), async (req, res, next) => {
  try {
    const raw = req.params.slug;
    const candidates = [raw];
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded !== raw) candidates.push(decoded);
    } catch {
      /* ignore malformed URI sequences */
    }

    let product = null;
    for (const slug of [...new Set(candidates)]) {
      product = await prisma.product.findFirst({
        where: { slug, isActive: true },
        include: productInclude,
      });
      if (product) break;
    }

    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(normalizeProduct(product));
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

router.get('/checkout/config', async (req, res) => {
  res.json({
    stripeEnabled: isStripeEnabled(),
    stripeTestMode: isStripeTestMode(),
    mockPaymentsEnabled: !isStripeEnabled() || process.env.NODE_ENV !== 'production',
    autoRefundEnabled:
      process.env.NODE_ENV !== 'production'
        ? process.env.CHECKOUT_AUTO_REFUND !== 'false'
        : process.env.CHECKOUT_AUTO_REFUND === 'true',
  });
});

router.post('/checkout/preview', validate(checkoutPreviewSchema), async (req, res, next) => {
  try {
    const productMap = await loadProductsForItems(req.body.items);
    const totals = computeCheckoutTotals(req.body.items, productMap, req.body.governorate);
    res.json({
      subtotal: totals.subtotal,
      shippingFee: totals.shippingFee,
      total: totals.total,
      currency: totals.currency,
      estimatedDays: totals.estimatedDays,
      freeShippingApplied: totals.freeShippingApplied,
      freeShippingMin: totals.freeShippingMin,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.post('/orders', validate(orderCreateSchema), async (req, res, next) => {
  try {
    const { order, needsPayment } = await createCheckoutOrder({
      userId: req.user.id,
      items: req.body.items,
      shipping: req.body.shipping,
      paymentMethod: req.body.paymentMethod,
    });
    res.status(201).json({ ...order, needsPayment });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.post('/orders/:id/confirm-payment', validate(idParam), async (req, res, next) => {
  try {
    const { order, autoRefunded } = await confirmMockPayment({ orderId: req.params.id, userId: req.user.id });
    res.json({ ...order, autoRefunded });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

const stripeSyncSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ sessionId: z.string().min(1) }),
});

router.post('/orders/:id/stripe-session', validate(idParam), async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: orderInclude,
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const session = await createStripeCheckoutSession({ order, userEmail: req.user.email });
    res.json(session);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.post('/orders/:id/stripe-sync', validate(stripeSyncSchema), async (req, res, next) => {
  try {
    const result = await syncStripeOrderForUser({
      orderId: req.params.id,
      sessionId: req.body.sessionId,
      userId: req.user.id,
    });
    res.json({ ...result.order, autoRefunded: result.autoRefunded });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.get('/orders/me', async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: orderInclude,
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
      include: orderInclude,
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
