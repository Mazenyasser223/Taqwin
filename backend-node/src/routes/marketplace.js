/**
 * Marketplace routes — products and orders.
 *
 *   GET   /api/marketplace/products
 *   GET   /api/marketplace/products/:id
 *   POST  /api/marketplace/orders                body: { items: [{ productId, quantity }] }
 *   GET   /api/marketplace/orders/me
 *   GET   /api/marketplace/orders/:id
 *
 * Orders are created in `pending` status; payment integration is deferred.
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { emitNotification } = require('../lib/notifications');

const router = express.Router();
router.use(authMiddleware);

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const listSchema = z.object({
  query: z.object({
    search: z.string().optional(),
  }),
});

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

router.get('/products', validate(listSchema), async (req, res, next) => {
  try {
    const where = { isActive: true };
    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search, mode: 'insensitive' } },
        { brand: { contains: req.query.search, mode: 'insensitive' } },
      ];
    }
    const products = await prisma.product.findMany({ where, orderBy: { name: 'asc' } });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

router.get('/products/:id', validate(idParam), async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
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
      include: { items: { include: { product: true } } },
    });

    emitNotification({
      userId: req.user.id,
      type: 'order.placed',
      title: 'Order placed',
      message: `Your order for $${total.toFixed(2)} is pending confirmation.`,
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
      include: { items: { include: { product: true } } },
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
      include: { items: { include: { product: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
