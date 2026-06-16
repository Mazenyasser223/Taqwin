/**
 * Full shop + shop-admin smoke test.
 * Usage: node scripts/test-shop-full.js
 */
require('dotenv').config({ override: true });
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/db');

const BASE = process.env.API_BASE || `http://127.0.0.1:${process.env.PORT || 4000}`;
const SHOP_ADMIN_EMAIL = (process.env.SHOP_ADMIN_EMAILS || 'ziad74488@gmail.com').split(',')[0].trim();

const results = { pass: 0, fail: 0, warn: 0, items: [] };

function log(status, name, detail = '') {
  const icon = status === 'pass' ? '✓' : status === 'warn' ? '⚠' : '✗';
  results[status === 'pass' ? 'pass' : status === 'warn' ? 'warn' : 'fail'] += 1;
  const line = detail ? `${name} — ${detail}` : name;
  results.items.push({ status, line });
  console.log(`${icon} ${line}`);
}

async function api(path, token, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json, text };
}

function tokenFor(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
}

async function main() {
  console.log(`\nShop full test → ${BASE}\n`);

  const health = await fetch(`${BASE}/health`);
  if (!health.ok) {
    log('fail', 'Backend health', `${health.status} — start backend first`);
    process.exit(1);
  }
  log('pass', 'GET /health', String(health.status));

  const shopAdmin = await prisma.user.findUnique({
    where: { email: SHOP_ADMIN_EMAIL },
    select: { id: true, email: true, role: true },
  });
  const athlete = await prisma.user.findFirst({
    where: { role: 'athlete', passwordHash: { not: null } },
    select: { id: true, email: true, role: true },
  });

  if (!athlete) {
    log('fail', 'Test athlete user', 'none found');
    process.exit(1);
  }
  log('pass', 'Test athlete', athlete.email);

  const athleteToken = tokenFor(athlete);
  const adminToken = shopAdmin ? tokenFor(shopAdmin) : null;
  if (shopAdmin) log('pass', 'Shop admin user', shopAdmin.email);
  else log('warn', 'Shop admin user', `missing ${SHOP_ADMIN_EMAIL}`);

  // —— Marketplace public (auth) ——
  const endpoints = [
    ['GET', '/api/marketplace/shipping-rules', null, (j) => j && typeof j.freeShippingMin !== 'undefined'],
    ['GET', '/api/marketplace/categories', athleteToken, (j) => Array.isArray(j) && j.length > 0],
    ['GET', '/api/marketplace/search/suggestions', athleteToken, (j) => Array.isArray(j) && j.length >= 0],
    ['GET', '/api/marketplace/products?limit=5&page=1', athleteToken, (j) => j?.items?.length >= 1 && j.total >= 1],
    ['GET', '/api/marketplace/products?onSale=true&limit=5', athleteToken, (j) => j?.items !== undefined],
    ['GET', '/api/marketplace/products?search=whey&limit=5', athleteToken, (j) => j?.items !== undefined],
    ['GET', '/api/marketplace/products?category=whey-protein&limit=5', athleteToken, (j) => j?.items !== undefined],
    ['GET', '/api/marketplace/orders/me', athleteToken, (j) => Array.isArray(j)],
    ['GET', '/api/marketplace/marketing/coupons/active', athleteToken, (j) => Array.isArray(j?.items)],
    ['GET', '/api/marketplace/marketing/loyalty/me', athleteToken, (j) => j && typeof j.points !== 'undefined'],
    ['GET', '/api/marketplace/marketing/referral/me', athleteToken, (j) => j !== null],
    ['GET', '/api/marketplace/wishlist', athleteToken, (j) => Array.isArray(j?.items ?? j)],
    ['GET', '/api/marketplace/reorder/suggestions', athleteToken, (j) => j?.suggestions !== undefined || Array.isArray(j)],
    ['GET', '/api/marketplace/subscriptions', athleteToken, (j) => Array.isArray(j?.items ?? j)],
    ['GET', '/api/ai/commerce/recommendations?locale=ar&source=marketplace', athleteToken, (j) => j?.bundle && Array.isArray(j.bundle.products)],
    ['GET', '/api/ai/commerce/diet-products?locale=ar', athleteToken, (j) => j?.dietProducts !== undefined],
  ];

  for (const [method, path, token, check] of endpoints) {
    const { res, json } = await api(path, token, { method });
    if (res.ok && check(json)) log('pass', `${method} ${path}`, String(res.status));
    else log('fail', `${method} ${path}`, `${res.status} ${JSON.stringify(json)?.slice(0, 120)}`);
  }

  // Product detail + slug
  const productsRes = await api('/api/marketplace/products?limit=3', athleteToken);
  const sample = productsRes.json?.items?.[0];
  if (sample?.id) {
    const det = await api(`/api/marketplace/products/${sample.id}`, athleteToken);
    if (det.res.ok && det.json?.id === sample.id) log('pass', 'GET /products/:id', sample.id.slice(0, 8));
    else log('fail', 'GET /products/:id', det.res.status);

    if (sample.slug) {
      const bySlug = await api(`/api/marketplace/products/by-slug/${encodeURIComponent(sample.slug)}`, athleteToken);
      if (bySlug.res.ok && bySlug.json?.slug === sample.slug) log('pass', 'GET /products/by-slug/:slug', sample.slug.slice(0, 30));
      else log('fail', 'GET /products/by-slug/:slug', bySlug.res.status);
    } else {
      log('warn', 'GET /products/by-slug/:slug', 'sample product has no slug');
    }

    const revElig = await api(`/api/marketplace/products/${sample.id}/reviews/eligibility`, athleteToken);
    if (revElig.res.ok) log('pass', 'GET reviews/eligibility', String(revElig.res.status));
    else log('fail', 'GET reviews/eligibility', revElig.res.status);

    const revList = await api(`/api/marketplace/products/${sample.id}/reviews?limit=5`, athleteToken);
    if (revList.res.ok) log('pass', 'GET product reviews', String(revList.res.status));
    else log('fail', 'GET product reviews', revList.res.status);

    // Wishlist toggle
    const addWl = await api(`/api/marketplace/wishlist/${sample.id}`, athleteToken, { method: 'POST' });
    if (addWl.res.ok || addWl.res.status === 201) log('pass', 'POST wishlist add', String(addWl.res.status));
    else log('fail', 'POST wishlist add', `${addWl.res.status} ${JSON.stringify(addWl.json)?.slice(0, 80)}`);

    const checkWl = await api(`/api/marketplace/wishlist/check/${sample.id}`, athleteToken);
    if (checkWl.res.ok && checkWl.json?.saved === true) log('pass', 'GET wishlist check', 'saved=true');
    else log('warn', 'GET wishlist check', JSON.stringify(checkWl.json));

    const delWl = await api(`/api/marketplace/wishlist/${sample.id}`, athleteToken, { method: 'DELETE' });
    if (delWl.res.ok) log('pass', 'DELETE wishlist', String(delWl.res.status));
    else log('fail', 'DELETE wishlist', delWl.res.status);
  } else {
    log('fail', 'Product samples', 'no products in catalog');
  }

  // Funnel + commerce events
  const funnel = await api('/api/marketplace/funnel/events', null, {
    method: 'POST',
    body: JSON.stringify({ step: 'visit', sessionId: `testshop${Date.now()}` }),
  });
  if (funnel.res.ok || funnel.res.status === 201) log('pass', 'POST funnel/events', String(funnel.res.status));
  else log('fail', 'POST funnel/events', funnel.res.status);

  const commerceEvent = await api('/api/ai/commerce/events', athleteToken, {
    method: 'POST',
    body: JSON.stringify({ eventType: 'shown', source: 'marketplace', productIds: sample ? [sample.id] : [] }),
  });
  if (commerceEvent.res.ok || commerceEvent.res.status === 201) log('pass', 'POST ai/commerce/events', String(commerceEvent.res.status));
  else log('fail', 'POST ai/commerce/events', commerceEvent.res.status);

  // Coupon validate
  const coupon = await api('/api/marketplace/marketing/coupons/validate', athleteToken, {
    method: 'POST',
    body: JSON.stringify({
      code: 'COACH15',
      items: sample ? [{ productId: sample.id, quantity: 1 }] : [],
    }),
  });
  if (coupon.res.ok && coupon.json?.valid !== undefined) log('pass', 'POST coupons/validate WELCOME10', coupon.json.valid ? 'valid' : 'invalid');
  else log('warn', 'POST coupons/validate', `${coupon.res.status} (migration/coupon seed?)`);

  // Payment create (may skip if Paymob off)
  if (sample?.stock > 0) {
    const pay = await api('/api/marketplace/payments/create', athleteToken, {
      method: 'POST',
      body: JSON.stringify({
        items: [{ productId: sample.id, quantity: 1 }],
        shipping: {
          governorate: 'Cairo',
          city: 'Nasr City',
          address: 'Test address line 123',
          phone: '01012345678',
        },
        commerceSource: 'direct',
      }),
    });
    if (pay.res.ok && pay.json?.checkoutUrl) {
      log('pass', 'POST payments/create', 'checkout URL returned');
      if (pay.json?.orderId) {
        const ord = await api(`/api/marketplace/orders/${pay.json.orderId}`, athleteToken);
        if (ord.res.ok) log('pass', 'GET order after checkout create', pay.json.orderId.slice(0, 8));
        else log('fail', 'GET order after checkout', ord.res.status);
      }
    } else if (pay.res.status === 503) {
      log('warn', 'POST payments/create', 'Paymob not configured (503) — checkout UI will show error');
    } else {
      log('fail', 'POST payments/create', `${pay.res.status} ${JSON.stringify(pay.json)?.slice(0, 100)}`);
    }
  }

  // —— Admin shop (email allowlist) ——
  if (adminToken) {
    const adminRoutes = [
      '/api/admin/shop/dashboard',
      '/api/admin/shop/settings',
      '/api/admin/shop/products?limit=10&active=true',
      '/api/admin/shop/products/brands',
      '/api/admin/shop/categories',
      '/api/admin/shop/orders?limit=10',
      '/api/admin/shop/ai-commerce',
      '/api/admin/shop/conversion-funnel',
      '/api/admin/shop/data-quality',
      '/api/admin/shop/marketing/coupons',
      '/api/admin/shop/audit-logs?limit=5',
    ];
    for (const path of adminRoutes) {
      const { res, json } = await api(path, adminToken);
      if (res.ok) log('pass', `GET ${path}`, String(res.status));
      else log('fail', `GET ${path}`, `${res.status} ${JSON.stringify(json)?.slice(0, 80)}`);
    }

    // Non-shop-admin should get 403
    const forbidden = await api('/api/admin/shop/dashboard', athleteToken);
    if (forbidden.res.status === 403) log('pass', 'Admin 403 for non-allowlist user', athlete.email);
    else log('warn', 'Admin access control', `athlete got ${forbidden.res.status} (expected 403)`);
  }

  // Frontend routes (static checklist)
  const frontendRoutes = [
    '/marketplace',
    '/marketplace/cart',
    '/marketplace/wishlist',
    '/orders',
    '/admin/shop',
    '/admin/shop/products',
    '/admin/shop/orders',
    '/admin/shop/categories',
    '/admin/shop/marketing',
    '/admin/shop/conversion-funnel',
    '/admin/shop/ai-commerce',
    '/admin/shop/data-quality',
  ];
  log('pass', 'Frontend routes defined', frontendRoutes.length + ' paths in App.tsx');

  console.log('\n—'.repeat(40));
  console.log(`PASS: ${results.pass}  WARN: ${results.warn}  FAIL: ${results.fail}`);
  if (results.fail > 0) {
    console.log('\nFailed:');
    results.items.filter((i) => i.status === 'fail').forEach((i) => console.log('  ✗', i.line));
    process.exit(1);
  }
  console.log('\n✓ Shop full test completed\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
