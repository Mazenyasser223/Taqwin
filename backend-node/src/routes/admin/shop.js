/**
 * Admin shop routes — products, orders, categories, dashboard.
 * All routes require JWT + shop admin email allowlist (SHOP_ADMIN_EMAILS).
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../../db');
const { authMiddleware, requireShopAdmin } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { normalizeProduct } = require('../../lib/shopProduct');
const { getLowStockThreshold, getShopSettings, updateShopSettings } = require('../../lib/shopSettings');
const { applyAdminOrderUpdate, notifyOrderChange } = require('../../lib/adminOrderFulfillment');
const { getAiCommerceAnalytics } = require('../../lib/commerce/recommendationEvents');
const { getConversionFunnel } = require('../../lib/commerce/shopFunnel');
const { getShopDataQualityReport } = require('../../lib/commerce/shopDataQuality');
const { listCoupons } = require('../../lib/commerce/shopCoupons');
const { logAdminAction } = require('../../lib/commerce/adminAudit');

const router = express.Router();
router.use(authMiddleware);
router.use(requireShopAdmin);

function csvEscape(val) {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function sendCsv(res, filename, rows) {
  const body = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`\uFEFF${body}`);
}

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const orderStatusEnum = z.enum([
  'pending',
  'pending_payment',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
]);
const paymentStatusEnum = z.enum(['pending', 'paid', 'failed', 'refunded']);

const productInclude = { category: true };

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

async function uniqueProductSlug(base) {
  let slug = base || 'product';
  let n = 1;
  while (true) {
    const exists = await prisma.product.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${n++}`;
  }
}

async function uniqueCategorySlug(base) {
  let slug = base || 'category';
  let n = 1;
  while (true) {
    const exists = await prisma.shopCategory.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${n++}`;
  }
}

function computeDiscount(price, compareAtPrice) {
  if (!compareAtPrice || compareAtPrice <= price) return { compareAtPrice: null, discountPercent: null, isOnSale: false };
  const discountPercent = Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
  return { compareAtPrice, discountPercent, isOnSale: discountPercent > 0 };
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const paidTodayWhere = {
      paymentStatus: 'paid',
      OR: [
        { paidAt: { gte: todayStart } },
        { paidAt: null, createdAt: { gte: todayStart } },
      ],
    };

    const [
      revenueAgg,
      ordersCount,
      productsCount,
      pendingOrders,
      lowStockProducts,
      topProducts,
      revenueByMonth,
      todayOrders,
      todayRevenueAgg,
      monthRevenueAgg,
      monthOrdersCount,
      monthPaidOrdersCount,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { paymentStatus: 'paid' },
        _sum: { total: true },
      }),
      prisma.order.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count({ where: { status: 'pending' } }),
      prisma.product.findMany({
        where: { isActive: true, stock: { lt: getLowStockThreshold() } },
        select: {
          id: true,
          name: true,
          nameAr: true,
          brand: true,
          stock: true,
          price: true,
          imageUrl: true,
        },
        orderBy: [{ stock: 'asc' }, { name: 'asc' }],
        take: 20,
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
      }),
      prisma.$queryRaw`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COALESCE(SUM(total), 0)::float AS revenue,
          COUNT(*)::int AS orders
        FROM orders
        WHERE payment_status = 'paid'
          AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month ASC
      `,
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({
        where: paidTodayWhere,
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { paymentStatus: 'paid', createdAt: { gte: monthStart } },
        _sum: { total: true },
      }),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.order.count({
        where: { paymentStatus: 'paid', createdAt: { gte: monthStart } },
      }),
    ]);

    const topProductIds = topProducts
      .sort((a, b) => (b._sum.quantity ?? 0) - (a._sum.quantity ?? 0))
      .slice(0, 5)
      .map((r) => r.productId);
    const topProductRows = topProductIds.length
      ? await prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true, nameAr: true, brand: true, imageUrl: true, price: true },
        })
      : [];
    const topById = new Map(topProductRows.map((p) => [p.id, p]));

    const todayRevenue = todayRevenueAgg._sum.total ?? 0;
    const monthRevenue = monthRevenueAgg._sum.total ?? 0;
    const conversionRate =
      monthOrdersCount > 0 ? Math.round((monthPaidOrdersCount / monthOrdersCount) * 1000) / 10 : 0;
    const averageOrderValue =
      monthPaidOrdersCount > 0 ? Math.round((monthRevenue / monthPaidOrdersCount) * 100) / 100 : 0;

    res.json({
      revenue: revenueAgg._sum.total ?? 0,
      ordersCount,
      productsCount,
      pendingOrders,
      lowStockThreshold: getLowStockThreshold(),
      lowStockProducts,
      topProducts: topProducts
        .sort((a, b) => (b._sum.quantity ?? 0) - (a._sum.quantity ?? 0))
        .slice(0, 5)
        .map((row) => ({
          productId: row.productId,
          quantitySold: row._sum.quantity ?? 0,
          product: topById.get(row.productId) ?? null,
        })),
      revenueByMonth,
      todayOrders,
      todayRevenue,
      monthRevenue,
      conversionRate,
      averageOrderValue,
      monthPaidOrders: monthPaidOrdersCount,
      monthOrders: monthOrdersCount,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Settings ────────────────────────────────────────────────────────────────

router.get('/settings', async (req, res, next) => {
  try {
    res.json(getShopSettings());
  } catch (err) {
    next(err);
  }
});

const patchSettingsSchema = z.object({
  body: z.object({
    lowStockThreshold: z.number().int().min(1).max(500),
  }),
});

router.patch('/settings', validate(patchSettingsSchema), async (req, res, next) => {
  try {
    res.json(updateShopSettings(req.body));
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

// ─── Products ────────────────────────────────────────────────────────────────

const listProductsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    brand: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    active: z.enum(['true', 'false', 'all']).optional(),
    lowStock: z.enum(['true']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

router.get('/products', validate(listProductsSchema), async (req, res, next) => {
  try {
    const where = {};
    const activeFilter = req.query.active ?? 'all';

    if (activeFilter === 'true') where.isActive = true;
    else if (activeFilter === 'false') where.isActive = false;

    if (req.query.lowStock === 'true') {
      where.stock = { lt: getLowStockThreshold() };
      where.isActive = true;
    }

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

    if (req.query.categoryId) {
      where.categoryId = req.query.categoryId;
    }

    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 24, 100);
    const skip = (page - 1) * limit;

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [{ sortOrder: 'asc' }, { isFeatured: 'desc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

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

const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    nameAr: z.string().max(200).optional().nullable(),
    brand: z.string().min(1).max(120),
    categoryId: z.string().uuid().optional().nullable(),
    price: z.number().positive(),
    compareAtPrice: z.number().positive().optional().nullable(),
    currency: z.string().max(8).optional(),
    imageUrl: z.string().min(1).optional().nullable(),
    description: z.string().max(20000).optional().nullable(),
    descriptionAr: z.string().max(20000).optional().nullable(),
    stock: z.number().int().min(0).optional(),
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
    slug: z.string().max(80).optional().nullable(),
    sortOrder: z.number().int().optional(),
  }),
});

router.post('/products', validate(createProductSchema), async (req, res, next) => {
  try {
    const body = req.body;
    const baseSlug = slugify(body.slug || body.name);
    const slug = await uniqueProductSlug(baseSlug);
    const sale = computeDiscount(body.price, body.compareAtPrice ?? null);

    const product = await prisma.product.create({
      data: {
        slug,
        name: body.name,
        nameAr: body.nameAr ?? null,
        brand: body.brand,
        categoryId: body.categoryId ?? null,
        price: body.price,
        compareAtPrice: sale.compareAtPrice,
        discountPercent: sale.discountPercent,
        isOnSale: sale.isOnSale,
        currency: body.currency ?? 'EGP',
        imageUrl: body.imageUrl ?? null,
        description: body.description ?? null,
        descriptionAr: body.descriptionAr ?? null,
        stock: body.stock ?? 0,
        isFeatured: body.isFeatured ?? false,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
      include: productInclude,
    });

    res.status(201).json(normalizeProduct(product));
  } catch (err) {
    next(err);
  }
});

const updateProductSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    nameAr: z.string().max(200).optional().nullable(),
    brand: z.string().min(1).max(120).optional(),
    categoryId: z.string().uuid().optional().nullable(),
    price: z.number().positive().optional(),
    compareAtPrice: z.number().positive().optional().nullable(),
    currency: z.string().max(8).optional(),
    imageUrl: z.string().min(1).optional().nullable(),
    description: z.string().max(20000).optional().nullable(),
    descriptionAr: z.string().max(20000).optional().nullable(),
    stock: z.number().int().min(0).optional(),
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
    slug: z.string().max(80).optional().nullable(),
    sortOrder: z.number().int().optional(),
  }),
});

router.put('/products/:id', validate(updateProductSchema), async (req, res, next) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const body = req.body;
    const data = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.nameAr !== undefined) data.nameAr = body.nameAr;
    if (body.brand !== undefined) data.brand = body.brand;
    if (body.categoryId !== undefined) data.categoryId = body.categoryId;
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
    if (body.description !== undefined) data.description = body.description;
    if (body.descriptionAr !== undefined) data.descriptionAr = body.descriptionAr;
    if (body.stock !== undefined) data.stock = body.stock;
    if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

    if (body.slug !== undefined) {
      const baseSlug = slugify(body.slug || body.name || existing.name);
      if (baseSlug !== existing.slug) {
        data.slug = await uniqueProductSlug(baseSlug);
      }
    }

    const nextPrice = body.price ?? existing.price;
    const nextCompare = body.compareAtPrice !== undefined ? body.compareAtPrice : existing.compareAtPrice;
    if (body.price !== undefined || body.compareAtPrice !== undefined) {
      data.price = nextPrice;
      const sale = computeDiscount(nextPrice, nextCompare);
      data.compareAtPrice = sale.compareAtPrice;
      data.discountPercent = sale.discountPercent;
      data.isOnSale = sale.isOnSale;
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: productInclude,
    });

    void logAdminAction({
      adminId: req.user.id,
      action: 'update',
      entity: 'product',
      entityId: product.id,
      metadata: { fields: Object.keys(data) },
    });

    res.json(normalizeProduct(product));
  } catch (err) {
    next(err);
  }
});

router.delete('/products/:id', validate(idParam), async (req, res, next) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
      include: productInclude,
    });

    res.json(normalizeProduct(product));
  } catch (err) {
    next(err);
  }
});

router.get('/products/brands', async (req, res, next) => {
  try {
    const rows = await prisma.product.findMany({
      where: { isActive: true },
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
    });
    res.json({ brands: rows.map((r) => r.brand).filter(Boolean) });
  } catch (err) {
    next(err);
  }
});

const bulkProductsSchema = z.object({
  body: z.object({
    ids: z.array(z.string().uuid()).min(1).max(200),
    action: z.enum(['archive', 'restore', 'setStock', 'setPrice']),
    value: z.number().optional(),
  }),
});

router.patch('/products/bulk', validate(bulkProductsSchema), async (req, res, next) => {
  try {
    const { ids, action, value } = req.body;
    if ((action === 'setStock' || action === 'setPrice') && (value === undefined || !Number.isFinite(value))) {
      return res.status(400).json({ error: 'value is required for setStock and setPrice' });
    }

    let data = {};
    if (action === 'archive') data = { isActive: false };
    else if (action === 'restore') data = { isActive: true };
    else if (action === 'setStock') data = { stock: Math.max(0, Math.floor(value)) };
    else if (action === 'setPrice') {
      if (value <= 0) return res.status(400).json({ error: 'price must be positive' });
      data = { price: value };
    }

    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data,
    });

    res.json({ updated: result.count });
  } catch (err) {
    next(err);
  }
});

router.get('/products/export', validate(listProductsSchema), async (req, res, next) => {
  try {
    const where = {};
    const activeFilter = req.query.active ?? 'all';
    if (activeFilter === 'true') where.isActive = true;
    else if (activeFilter === 'false') where.isActive = false;
    if (req.query.lowStock === 'true') {
      where.stock = { lt: getLowStockThreshold() };
      where.isActive = true;
    }
    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search, mode: 'insensitive' } },
        { brand: { contains: req.query.search, mode: 'insensitive' } },
        { nameAr: { contains: req.query.search, mode: 'insensitive' } },
      ];
    }
    if (req.query.brand) where.brand = { equals: req.query.brand, mode: 'insensitive' };
    if (req.query.categoryId) where.categoryId = req.query.categoryId;

    const products = await prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const header = [
      'id',
      'slug',
      'name',
      'nameAr',
      'brand',
      'category',
      'price',
      'currency',
      'stock',
      'isFeatured',
      'isActive',
      'sortOrder',
    ];
    const rows = products.map((p) => [
      p.id,
      p.slug,
      p.name,
      p.nameAr ?? '',
      p.brand,
      p.category?.nameEn ?? '',
      p.price,
      p.currency,
      p.stock,
      p.isFeatured ? 'yes' : 'no',
      p.isActive ? 'yes' : 'no',
      p.sortOrder ?? 0,
    ]);
    sendCsv(res, 'products.csv', [header, ...rows]);
  } catch (err) {
    next(err);
  }
});

// ─── Orders ──────────────────────────────────────────────────────────────────

const listOrdersSchema = z.object({
  query: z.object({
    status: orderStatusEnum.optional(),
    paymentStatus: paymentStatusEnum.optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

router.get('/orders', validate(listOrdersSchema), async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.paymentStatus) where.paymentStatus = req.query.paymentStatus;

    if (req.query.search) {
      const q = req.query.search.trim();
      if (q) {
        where.OR = [
          { id: { contains: q, mode: 'insensitive' } },
          { paymentReference: { contains: q, mode: 'insensitive' } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
        ];
      }
    }

    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 24, 100);
    const skip = (page - 1) * limit;

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        select: {
          id: true,
          userId: true,
          status: true,
          paymentStatus: true,
          paymentProvider: true,
          paymentReference: true,
          paidAt: true,
          total: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      items: orders,
      total,
      page,
      perPage: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/orders/:id', validate(idParam), async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, email: true } },
        items: { include: { product: { include: productInclude } } },
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

const patchOrderStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      status: orderStatusEnum.optional(),
      paymentStatus: paymentStatusEnum.optional(),
      carrier: z.string().max(120).optional(),
      trackingNumber: z.string().max(120).optional(),
    })
    .refine(
      (b) =>
        b.status !== undefined ||
        b.paymentStatus !== undefined ||
        b.carrier !== undefined ||
        b.trackingNumber !== undefined,
      { message: 'At least one of status, paymentStatus, carrier, or trackingNumber is required' },
    ),
});

router.patch('/orders/:id/status', validate(patchOrderStatusSchema), async (req, res, next) => {
  try {
    const result = await applyAdminOrderUpdate(req.params.id, req.body);
    if (!result) return res.status(404).json({ error: 'Order not found' });

    notifyOrderChange(result.previous, result.updated);
    res.json(result.updated);
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message });
    next(err);
  }
});

router.get('/orders/export', validate(listOrdersSchema), async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.paymentStatus) where.paymentStatus = req.query.paymentStatus;
    if (req.query.search) {
      const q = req.query.search.trim();
      if (q) {
        where.OR = [
          { id: { contains: q, mode: 'insensitive' } },
          { paymentReference: { contains: q, mode: 'insensitive' } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
        ];
      }
    }

    const orders = await prisma.order.findMany({
      where,
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const header = [
      'id',
      'email',
      'status',
      'paymentStatus',
      'paymentProvider',
      'paymentReference',
      'paidAt',
      'total',
      'createdAt',
    ];
    const rows = orders.map((o) => [
      o.id,
      o.user?.email ?? '',
      o.status,
      o.paymentStatus,
      o.paymentProvider ?? '',
      o.paymentReference ?? '',
      o.paidAt ? o.paidAt.toISOString() : '',
      o.total,
      o.createdAt.toISOString(),
    ]);
    sendCsv(res, 'orders.csv', [header, ...rows]);
  } catch (err) {
    next(err);
  }
});

// ─── Categories ──────────────────────────────────────────────────────────────

router.get('/categories', async (req, res, next) => {
  try {
    const [all, productCounts] = await Promise.all([
      prisma.shopCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
      }),
      prisma.product.groupBy({
        by: ['categoryId'],
        where: { categoryId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const countByCategoryId = new Map(
      productCounts.map((row) => [row.categoryId, row._count._all])
    );

    const childrenOf = (parentId) =>
      all.filter((c) => c.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);

    function buildNode(c) {
      return {
        id: c.id,
        slug: c.slug,
        nameEn: c.nameEn,
        nameAr: c.nameAr ?? null,
        icon: c.icon ?? null,
        parentId: c.parentId ?? null,
        sortOrder: c.sortOrder ?? 0,
        productCount: countByCategoryId.get(c.id) ?? 0,
        children: childrenOf(c.id).map(buildNode),
      };
    }

    const parents = all.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    res.json(parents.map(buildNode));
  } catch (err) {
    next(err);
  }
});

const createCategorySchema = z.object({
  body: z.object({
    nameEn: z.string().min(1).max(120),
    nameAr: z.string().max(120).optional().nullable(),
    icon: z.string().max(80).optional().nullable(),
    parentId: z.string().uuid().optional().nullable(),
    sortOrder: z.number().int().optional(),
    slug: z.string().max(80).optional().nullable(),
  }),
});

router.post('/categories', validate(createCategorySchema), async (req, res, next) => {
  try {
    const body = req.body;
    const baseSlug = slugify(body.slug || body.nameEn);
    const slug = await uniqueCategorySlug(baseSlug);

    const category = await prisma.shopCategory.create({
      data: {
        slug,
        nameEn: body.nameEn,
        nameAr: body.nameAr ?? null,
        icon: body.icon ?? null,
        parentId: body.parentId ?? null,
        sortOrder: body.sortOrder ?? 0,
      },
    });

    res.status(201).json({
      id: category.id,
      slug: category.slug,
      nameEn: category.nameEn,
      nameAr: category.nameAr ?? null,
      icon: category.icon ?? null,
      parentId: category.parentId ?? null,
      sortOrder: category.sortOrder ?? 0,
      productCount: 0,
      children: [],
    });
  } catch (err) {
    next(err);
  }
});

const reorderCategoriesSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          id: z.string().uuid(),
          sortOrder: z.number().int(),
        })
      )
      .min(1),
  }),
});

router.put('/categories/reorder', validate(reorderCategoriesSchema), async (req, res, next) => {
  try {
    await prisma.$transaction(
      req.body.items.map((item) =>
        prisma.shopCategory.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const updateCategorySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    nameEn: z.string().min(1).max(120).optional(),
    nameAr: z.string().max(120).optional().nullable(),
    icon: z.string().max(80).optional().nullable(),
    parentId: z.string().uuid().optional().nullable(),
    sortOrder: z.number().int().optional(),
    slug: z.string().max(80).optional().nullable(),
  }),
});

router.put('/categories/:id', validate(updateCategorySchema), async (req, res, next) => {
  try {
    const existing = await prisma.shopCategory.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    const body = req.body;
    if (body.parentId === req.params.id) {
      return res.status(400).json({ error: 'Category cannot be its own parent' });
    }

    const data = {};
    if (body.nameEn !== undefined) data.nameEn = body.nameEn;
    if (body.nameAr !== undefined) data.nameAr = body.nameAr;
    if (body.icon !== undefined) data.icon = body.icon;
    if (body.parentId !== undefined) data.parentId = body.parentId;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

    if (body.slug !== undefined || body.nameEn !== undefined) {
      const baseSlug = slugify(body.slug || body.nameEn || existing.nameEn);
      if (baseSlug !== existing.slug) {
        data.slug = await uniqueCategorySlug(baseSlug);
      }
    }

    const category = await prisma.shopCategory.update({
      where: { id: req.params.id },
      data,
    });

    const productCount = await prisma.product.count({ where: { categoryId: category.id } });
    res.json({
      id: category.id,
      slug: category.slug,
      nameEn: category.nameEn,
      nameAr: category.nameAr ?? null,
      icon: category.icon ?? null,
      parentId: category.parentId ?? null,
      sortOrder: category.sortOrder ?? 0,
      productCount,
      children: [],
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/categories/:id', validate(idParam), async (req, res, next) => {
  try {
    const existing = await prisma.shopCategory.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    const [childCount, productCount] = await Promise.all([
      prisma.shopCategory.count({ where: { parentId: req.params.id } }),
      prisma.product.count({ where: { categoryId: req.params.id } }),
    ]);

    if (childCount > 0) {
      return res.status(400).json({ error: 'Cannot delete category with subcategories' });
    }
    if (productCount > 0) {
      return res.status(400).json({ error: 'Cannot delete category with products' });
    }

    await prisma.shopCategory.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/ai-commerce', async (req, res, next) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 30;
    const analytics = await getAiCommerceAnalytics({ days });
    res.json(analytics);
  } catch (err) {
    next(err);
  }
});

router.get('/conversion-funnel', async (req, res, next) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 30;
    const funnel = await getConversionFunnel({ days });
    res.json(funnel);
  } catch (err) {
    next(err);
  }
});

router.get('/data-quality', async (_req, res, next) => {
  try {
    const report = await getShopDataQualityReport();
    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.get('/marketing/coupons', async (_req, res, next) => {
  try {
    const coupons = await listCoupons();
    res.json({ items: coupons });
  } catch (err) {
    next(err);
  }
});

router.get('/audit-logs', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { admin: { select: { id: true, email: true } } },
    });
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
