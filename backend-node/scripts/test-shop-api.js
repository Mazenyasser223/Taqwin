/**
 * Full shop API smoke test — run while backend is on PORT (default 4002).
 * Usage: node scripts/test-shop-api.js
 */
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;

async function api(path, token, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const categories = await prisma.shopCategory.count();
  const products = await prisma.product.count({ where: { isActive: true, slug: { not: null } } });
  const onSale = await prisma.product.count({ where: { isOnSale: true, isActive: true } });
  const user = await prisma.user.findFirst({
    where: { role: 'athlete', passwordHash: { not: null } },
    select: { id: true, email: true, role: true },
  });

  console.log('DB:', { categories, products, onSale, testUser: user?.email ?? 'none' });
  assert(categories >= 17, 'Expected seeded categories');
  assert(products >= 20, 'Expected seeded catalog products');

  if (!user) {
    throw new Error('No athlete with password for API test');
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

  const { res: catRes, json: cats } = await api('/api/marketplace/categories', token);
  assert(catRes.ok, `categories failed: ${catRes.status} ${JSON.stringify(cats)}`);
  assert(Array.isArray(cats) && cats.length >= 5, 'Expected parent categories');
  assert(cats.some((c) => c.children?.length > 0), 'Expected child categories');
  console.log('✓ GET /categories', cats.length, 'parents');

  const { res: allRes, json: all } = await api('/api/marketplace/products?limit=5', token);
  assert(allRes.ok, `products failed: ${allRes.status}`);
  assert(all.items?.length >= 1, 'Expected products in page');
  assert(all.total >= 20, `Expected 20+ total products, got ${all.total}`);
  const sample = all.items[0];
  assert(sample.currency === 'EGP', 'Expected EGP currency');
  assert(sample.category?.slug, 'Expected nested category on product');
  console.log('✓ GET /products', all.total, 'total, sample EGP', sample.price);

  const { res: saleRes, json: sale } = await api('/api/marketplace/products?onSale=true&limit=5', token);
  assert(saleRes.ok && sale.total >= 2, 'onSale filter');
  console.log('✓ GET /products?onSale=true', sale.total);

  const { res: protRes, json: prot } = await api(
    '/api/marketplace/products?category=protein&limit=5',
    token
  );
  assert(protRes.ok && prot.total >= 1, 'protein category filter');
  console.log('✓ GET /products?category=protein', prot.total);

  const brand = sample.brand;
  const { res: brandRes, json: branded } = await api(
    `/api/marketplace/products?brand=${encodeURIComponent(brand)}&limit=5`,
    token
  );
  assert(brandRes.ok && branded.total >= 1, 'brand filter');
  assert(
    branded.items.every((p) => p.brand.toLowerCase() === brand.toLowerCase()),
    'brand filter mismatch'
  );
  console.log('✓ GET /products?brand=', brand, branded.total);

  const { res: parentRes, json: parentProds } = await api(
    '/api/marketplace/products?category=supplements&limit=5',
    token
  );
  assert(parentRes.ok && parentProds.total >= 5, 'parent category includes children');
  console.log('✓ GET /products?category=supplements', parentProds.total);

  const cartItem = all.items.find((p) => p.stock > 0) || all.items[0];
  const { res: orderRes, json: order } = await api('/api/marketplace/orders', token, {
    method: 'POST',
    body: JSON.stringify({
      items: [{ productId: cartItem.id, quantity: 1 }],
    }),
  });
  assert(orderRes.ok, `order create failed: ${orderRes.status} ${JSON.stringify(order)}`);
  assert(order.total === cartItem.price, 'order total should match unit price x qty');
  console.log('✓ POST /orders', order.id, 'total', order.total, cartItem.currency || 'EGP');

  const { res: meRes, json: orders } = await api('/api/marketplace/orders/me', token);
  assert(meRes.ok && orders.some((o) => o.id === order.id), 'orders/me includes new order');
  console.log('✓ GET /orders/me', orders.length, 'orders');

  const { res: oneRes, json: one } = await api(`/api/marketplace/orders/${order.id}`, token);
  assert(oneRes.ok && one.id === order.id, 'GET order by id');
  console.log('✓ GET /orders/:id');

  const { productHasAllSections } = require('../src/lib/ensureProductDescription');
  const detailIds = all.items.slice(0, 5).map((p) => p.id);
  for (const id of detailIds) {
    const { res: detRes, json: detail } = await api(`/api/marketplace/products/${id}`, token);
    assert(detRes.ok, `product detail failed: ${detRes.status}`);
    assert(
      productHasAllSections(detail.description),
      `product ${id} missing Description/Key Highlights/How to Use`
    );
  }
  console.log('✓ GET /products/:id — all 3 sections on', detailIds.length, 'samples');

  console.log('\n✓ All shop API tests passed');
}

main()
  .catch((e) => {
    console.error('\n✗', e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
