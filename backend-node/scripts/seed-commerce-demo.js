/**
 * Seed demo commerce / AI analytics data for admin dashboard testing.
 *
 * Usage:
 *   node scripts/seed-commerce-demo.js
 *   node scripts/seed-commerce-demo.js --force   # wipe & re-seed demo rows
 *
 * Creates:
 *   - 5 demo athlete users (demo-commerce-1@taqwin.test …)
 *   - Recommendation events (shown, clicked, bundle_added, purchased, feedback…)
 *   - Paid orders by commerce source (ai_bundle, ai_recommendation, search…)
 *   - Reviews, wishlists, subscriptions
 *   - Old paid orders (~35 days) for reorder banner testing
 */
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { computeOrderTotals } = require('../src/lib/shopShipping');
const { ORDER_SOURCES } = require('../src/lib/commerce/orderAttribution');
const { getAiCommerceAnalytics } = require('../src/lib/commerce/recommendationEvents');
const { recordFunnelEvent } = require('../src/lib/commerce/shopFunnel');

const prisma = new PrismaClient();
const DEMO_EMAIL_PREFIX = 'demo-commerce-';
const DEMO_EMAIL_DOMAIN = '@taqwin.test';
const DEMO_SESSION_PREFIX = 'demo-seed-';
const DEMO_PASSWORD = 'Demo1234!';

const META_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10 + (n % 8), 15, 0, 0);
  return d;
}

function hoursAgo(n) {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}

async function ensureMetaTable() {
  await prisma.$executeRawUnsafe(META_TABLE_SQL);
}

async function isSeeded() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT value FROM _meta WHERE key = $1 LIMIT 1',
    'commerce_demo_seeded',
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function markSeeded() {
  await prisma.$executeRawUnsafe(
    `INSERT INTO _meta (key, value) VALUES ('commerce_demo_seeded', NOW()::text)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
  );
}

async function clearDemoData() {
  const demoUsers = await prisma.user.findMany({
    where: { email: { startsWith: DEMO_EMAIL_PREFIX, endsWith: DEMO_EMAIL_DOMAIN } },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map((u) => u.id);

  const demoOrders = await prisma.order.findMany({
    where: { commerceSessionId: { startsWith: DEMO_SESSION_PREFIX } },
    select: { id: true },
  });
  const demoOrderIds = demoOrders.map((o) => o.id);

  await prisma.recommendationEvent.deleteMany({
    where: { sessionId: { startsWith: DEMO_SESSION_PREFIX } },
  });
  await prisma.shopFunnelEvent.deleteMany({
    where: { sessionId: { startsWith: DEMO_SESSION_PREFIX } },
  });

  if (demoOrderIds.length) {
    await prisma.productReview.deleteMany({ where: { orderId: { in: demoOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: demoOrderIds } } });
  }

  if (demoUserIds.length) {
    await prisma.productReview.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.reviewVote.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.productWishlist.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.productSubscription.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.recommendationEvent.deleteMany({ where: { userId: { in: demoUserIds } } });
  }

  console.log('[seed-commerce-demo] cleared previous demo rows');
}

async function ensureDemoUsers(count = 5) {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = [];

  for (let i = 1; i <= count; i += 1) {
    const email = `${DEMO_EMAIL_PREFIX}${i}${DEMO_EMAIL_DOMAIN}`;
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: hash,
        role: 'athlete',
        emailVerifiedAt: new Date(),
        athleteProfile: {
          create: {
            displayName: `Demo Shopper ${i}`,
          },
        },
      },
      update: {},
    });
    users.push(user);
  }

  return users;
}

async function getProducts() {
  const products = await prisma.product.findMany({
    where: { isActive: true, stock: { gt: 0 } },
    orderBy: [{ isFeatured: 'desc' }, { salesCount: 'desc' }, { name: 'asc' }],
    take: 8,
  });
  if (products.length < 3) {
    throw new Error('Need at least 3 active in-stock products. Run seedShopOnly first.');
  }
  return products;
}

async function getExperiment() {
  return prisma.commerceExperiment.findUnique({
    where: { slug: 'bundle-composition' },
    include: { variants: { orderBy: { key: 'asc' } } },
  });
}

function buildItems(products, qty = 1) {
  return products.map((p) => ({
    productId: p.id,
    quantity: qty,
    unitPrice: p.price,
  }));
}

function orderMoney(items, discountAmount = 0) {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) - discountAmount;
  const { shippingFee, total } = computeOrderTotals(Math.max(0, subtotal));
  return {
    subtotal: Math.max(0, subtotal),
    shippingFee,
    total,
    discountAmount,
  };
}

async function createPaidOrder({
  userId,
  items,
  source,
  paidAt,
  sessionId,
  experimentId,
  abVariant,
  discountAmount = 0,
  status = 'delivered',
}) {
  const { subtotal, shippingFee, total } = orderMoney(items, discountAmount);
  const order = await prisma.order.create({
    data: {
      userId,
      status,
      paymentStatus: 'paid',
      paymentProvider: 'paymob',
      paymentReference: `demo-${randomUUID().slice(0, 8)}`,
      paidAt,
      subtotal,
      shippingFee,
      discountAmount,
      total,
      currency: 'EGP',
      commerceSource: source,
      commerceSessionId: sessionId,
      commerceExperimentId: experimentId || null,
      commerceAbVariant: abVariant || null,
      shippingGovernorate: 'Cairo',
      shippingCity: 'Nasr City',
      shippingAddress: 'Demo Address 12',
      shippingPhone: '+201000000001',
      items: { create: items },
    },
    include: { items: true },
  });
  return order;
}

async function seedRecommendationEvents({ users, products, experiment, ordersBySource }) {
  const expId = experiment?.id ?? null;
  const variants = experiment?.variants?.map((v) => v.key) || ['A', 'B'];
  const rows = [];
  let idx = 0;

  const push = (eventType, user, extra = {}) => {
    const variant = variants[idx % variants.length];
    idx += 1;
    rows.push({
      userId: user.id,
      eventType,
      source: extra.source || 'dashboard_diet',
      bundleId: extra.bundleId || 'demo-bundle',
      productId: extra.productId || products[idx % products.length].id,
      productIds: extra.productIds || products.slice(0, 3).map((p) => p.id),
      sessionId: `${DEMO_SESSION_PREFIX}${randomUUID()}`,
      orderId: extra.orderId || null,
      metadata: {
        experimentId: expId,
        abVariant: variant,
        variantKey: variant,
        ...(extra.metadata || {}),
      },
      createdAt: extra.createdAt || hoursAgo(idx % 72),
    });
  };

  // Funnel events
  for (let i = 0; i < 48; i += 1) push('shown', users[i % users.length], { createdAt: daysAgo(i % 14) });
  for (let i = 0; i < 26; i += 1) push('clicked', users[i % users.length], { createdAt: daysAgo(i % 12) });
  for (let i = 0; i < 16; i += 1) push('bundle_added', users[i % users.length], { createdAt: daysAgo(i % 10) });
  for (let i = 0; i < 6; i += 1) push('dismissed', users[i % users.length], { createdAt: daysAgo(i % 8) });
  for (let i = 0; i < 14; i += 1) push('feedback_positive', users[i % users.length]);
  for (let i = 0; i < 5; i += 1) push('feedback_negative', users[i % users.length]);

  // Purchased events linked to AI orders
  const aiOrders = [
    ...(ordersBySource[ORDER_SOURCES.AI_BUNDLE] || []),
    ...(ordersBySource[ORDER_SOURCES.AI_RECOMMENDATION] || []),
  ];
  for (const order of aiOrders) {
    rows.push({
      userId: order.userId,
      eventType: 'purchased',
      source: order.commerceSource,
      bundleId: 'demo-bundle',
      productIds: order.items.map((i) => i.productId),
      sessionId: order.commerceSessionId,
      orderId: order.id,
      metadata: {
        experimentId: expId,
        abVariant: order.commerceAbVariant,
        variantKey: order.commerceAbVariant,
        total: order.total,
        discountAmount: order.discountAmount,
      },
      createdAt: order.paidAt,
    });
  }

  await prisma.recommendationEvent.createMany({ data: rows });
  return rows.length;
}

async function seedOrders({ users, products, experiment }) {
  const expId = experiment?.id ?? null;
  const ordersBySource = {};

  const plans = [
    { source: ORDER_SOURCES.AI_BUNDLE, count: 4, products: products.slice(0, 3), variant: 'B', discount: 450, days: 2 },
    { source: ORDER_SOURCES.AI_BUNDLE, count: 3, products: products.slice(0, 2), variant: 'A', discount: 280, days: 5 },
    { source: ORDER_SOURCES.AI_RECOMMENDATION, count: 5, products: products.slice(1, 3), variant: 'A', discount: 0, days: 3 },
    { source: ORDER_SOURCES.AI_RECOMMENDATION, count: 3, products: products.slice(2, 4), variant: 'B', discount: 0, days: 7 },
    { source: ORDER_SOURCES.SEARCH, count: 3, products: products.slice(0, 1), variant: null, discount: 0, days: 4 },
    { source: ORDER_SOURCES.CATEGORY, count: 2, products: products.slice(3, 5), variant: null, discount: 0, days: 6 },
    { source: ORDER_SOURCES.FEATURED, count: 2, products: products.slice(0, 1), variant: null, discount: 0, days: 8 },
    { source: ORDER_SOURCES.DIRECT, count: 2, products: products.slice(4, 6), variant: null, discount: 0, days: 9 },
  ];

  let userIdx = 0;
  for (const plan of plans) {
    ordersBySource[plan.source] = ordersBySource[plan.source] || [];
    for (let i = 0; i < plan.count; i += 1) {
      const user = users[userIdx % users.length];
      userIdx += 1;
      const items = buildItems(plan.products, 1 + (i % 2));
      const order = await createPaidOrder({
        userId: user.id,
        items,
        source: plan.source,
        paidAt: daysAgo(plan.days + i),
        sessionId: `${DEMO_SESSION_PREFIX}${randomUUID()}`,
        experimentId: plan.variant ? expId : null,
        abVariant: plan.variant,
        discountAmount: plan.discount,
      });
      ordersBySource[plan.source].push(order);

      for (const item of order.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { salesCount: { increment: item.quantity } },
        });
      }
    }
  }

  // Reorder test — old purchases (35+ days)
  for (let i = 0; i < users.length; i += 1) {
    const product = products[i % products.length];
    await createPaidOrder({
      userId: users[i].id,
      items: buildItems([product], 2),
      source: ORDER_SOURCES.DIRECT,
      paidAt: daysAgo(35 + i),
      sessionId: `${DEMO_SESSION_PREFIX}reorder-${randomUUID()}`,
    });
  }

  return ordersBySource;
}

async function seedReviews({ users, products, ordersBySource }) {
  const allOrders = Object.values(ordersBySource).flat();
  const bodies = [
    'Great quality, mixes well and tastes good. Will buy again.',
    'Noticeable improvement in recovery. Verified purchase — happy customer.',
    'Good value for money. Delivery was fast and packaging intact.',
    'Solid product for daily use. Helped me hit my protein goals easily.',
  ];

  let reviewCount = 0;
  for (let i = 0; i < Math.min(allOrders.length, 10); i += 1) {
    const order = allOrders[i];
    const item = order.items[0];
    if (!item) continue;

    const existing = await prisma.productReview.findUnique({
      where: { productId_userId: { productId: item.productId, userId: order.userId } },
    });
    if (existing) continue;

    const rating = 4 + (i % 2);
    await prisma.productReview.create({
      data: {
        productId: item.productId,
        userId: order.userId,
        orderId: order.id,
        rating,
        title: i % 2 === 0 ? 'Highly recommend' : null,
        body: bodies[i % bodies.length],
        isVerifiedPurchase: true,
        helpfulCount: 2 + (i % 5),
        createdAt: daysAgo(i % 10),
      },
    });
    reviewCount += 1;
  }

  for (const product of products.slice(0, 5)) {
    const agg = await prisma.productReview.aggregate({
      where: { productId: product.id },
      _avg: { rating: true },
      _count: { id: true },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: {
        avgRating: agg._avg.rating ?? 0,
        reviewCount: agg._count.id ?? 0,
      },
    });
  }

  return reviewCount;
}

async function seedWishlists({ users, products }) {
  let count = 0;
  for (const user of users) {
    for (const product of products.slice(0, 3)) {
      const exists = await prisma.productWishlist.findUnique({
        where: { userId_productId: { userId: user.id, productId: product.id } },
      });
      if (exists) continue;
      await prisma.productWishlist.create({
        data: { userId: user.id, productId: product.id, createdAt: daysAgo(count % 14) },
      });
      await prisma.product.update({
        where: { id: product.id },
        data: { wishlistCount: { increment: 1 } },
      });
      count += 1;
    }
  }
  return count;
}

async function seedSubscriptions({ users, products }) {
  let count = 0;
  for (let i = 0; i < 2; i += 1) {
    const user = users[i];
    const product = products[i];
    const existing = await prisma.productSubscription.findFirst({
      where: { userId: user.id, productId: product.id, status: { in: ['active', 'paused'] } },
    });
    if (existing) continue;

    await prisma.productSubscription.create({
      data: {
        userId: user.id,
        productId: product.id,
        quantity: 1,
        intervalDays: 30,
        status: 'active',
        nextDeliveryAt: daysAgo(-14 + i),
      },
    });
    count += 1;
  }
  return count;
}

/** Demo funnel sessions for Admin → Conversion Funnel */
async function seedFunnelEvents({ products, ordersBySource }) {
  const paidOrders = Object.values(ordersBySource).flat().filter((o) => o.paymentStatus === 'paid');
  const funnelPlan = [
    { step: 'visit', sessions: 220 },
    { step: 'search', sessions: 140 },
    { step: 'product_view', sessions: 95 },
    { step: 'add_to_cart', sessions: 48 },
    { step: 'checkout_start', sessions: 26 },
    { step: 'paid', sessions: Math.min(18, paidOrders.length || 12) },
  ];

  let count = 0;
  for (const { step, sessions } of funnelPlan) {
    for (let i = 0; i < sessions; i += 1) {
      const sessionId = `${DEMO_SESSION_PREFIX}funnel-${step}-${i}`;
      const product = products[i % products.length];
      await recordFunnelEvent({
        userId: null,
        sessionId,
        step,
        productId: step === 'product_view' || step === 'add_to_cart' ? product?.id : undefined,
        query: step === 'search' ? 'protein' : undefined,
        metadata: step === 'paid' && paidOrders[i] ? { orderId: paidOrders[i].id } : undefined,
      });
      count += 1;
    }
  }
  return count;
}

async function main() {
  const force = process.argv.includes('--force');

  await ensureMetaTable();
  if (!force && (await isSeeded())) {
    console.log('[seed-commerce-demo] already seeded — use --force to re-run');
    const analytics = await getAiCommerceAnalytics({ days: 30 });
    console.log('[seed-commerce-demo] current analytics snapshot:', {
      shown: analytics.recommendationsShown,
      bundlesAdded: analytics.bundlesAdded,
      aiOrders: analytics.aiOrders,
      aiRevenue: analytics.aiRevenue,
      feedbackPositive: analytics.feedbackPositive,
      feedbackNegative: analytics.feedbackNegative,
      wishlisted: analytics.mostWishlisted?.length ?? 0,
    });
    return;
  }

  if (force) await clearDemoData();

  const users = await ensureDemoUsers(5);
  const products = await getProducts();
  const experiment = await getExperiment();

  console.log(`[seed-commerce-demo] users=${users.length} products=${products.length} experiment=${experiment?.slug ?? 'none'}`);

  const ordersBySource = await seedOrders({ users, products, experiment });
  const eventCount = await seedRecommendationEvents({ users, products, experiment, ordersBySource });
  const reviewCount = await seedReviews({ users, products, ordersBySource });
  const wishlistCount = await seedWishlists({ users, products });
  const subscriptionCount = await seedSubscriptions({ users, products });
  const funnelCount = await seedFunnelEvents({ products, ordersBySource });

  await markSeeded();

  const analytics = await getAiCommerceAnalytics({ days: 30 });

  console.log('[seed-commerce-demo] done ✓');
  console.log({
    demoUsers: users.map((u) => u.email),
    demoPassword: DEMO_PASSWORD,
    ordersCreated: Object.values(ordersBySource).reduce((s, arr) => s + arr.length, 0),
    recommendationEvents: eventCount,
    reviews: reviewCount,
    wishlists: wishlistCount,
    subscriptions: subscriptionCount,
    funnelEvents: funnelCount,
  });
  console.log('[seed-commerce-demo] admin dashboard (30d):', {
    recommendationsShown: analytics.recommendationsShown,
    bundlesAdded: analytics.bundlesAdded,
    aiOrders: analytics.aiOrders,
    aiRevenue: analytics.aiRevenue,
    conversionRate: analytics.conversionRate,
    feedbackPositive: analytics.feedbackPositive,
    feedbackNegative: analytics.feedbackNegative,
    revenueBySource: analytics.revenueBySource?.bySource?.map((r) => `${r.source}: ${r.revenue} EGP`),
    topWishlisted: analytics.mostWishlisted?.slice(0, 3).map((p) => `${p.name} (${p.wishlistCount})`),
    abVariants: analytics.abTest?.variants?.map((v) => `${v.variantKey}: shown=${v.shown} purchased=${v.purchased}`),
  });
  console.log('\nOpen Admin → Shop → Conversion Funnel / AI Commerce to verify charts.');
}

main()
  .catch((err) => {
    console.error('[seed-commerce-demo] failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
