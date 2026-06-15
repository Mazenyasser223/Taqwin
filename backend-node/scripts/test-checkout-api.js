/**
 * Checkout API smoke test — COD + mock card payment flow.
 * Usage: node scripts/test-checkout-api.js
 * Requires: migrated DB, seeded catalog, backend on PORT (default 4002).
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

const SHIPPING = {
  governorate: 'Cairo',
  city: 'Nasr City',
  address: '12 Test Street, Building 3',
  phone: '+201012345678',
};

async function main() {
  const user = await prisma.user.findFirst({
    where: { role: 'athlete', passwordHash: { not: null } },
    select: { id: true, email: true, role: true },
  });
  assert(user, 'No athlete with password for API test');

  const product = await prisma.product.findFirst({
    where: { isActive: true, stock: { gte: 2 } },
    orderBy: { price: 'asc' },
  });
  assert(product, 'Need at least one in-stock product');

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

  const items = [{ productId: product.id, quantity: 1 }];

  const { res: prevRes, json: preview } = await api('/api/marketplace/checkout/preview', token, {
    method: 'POST',
    body: JSON.stringify({ items, governorate: SHIPPING.governorate }),
  });
  assert(prevRes.ok, `preview failed: ${prevRes.status} ${JSON.stringify(preview)}`);
  assert(preview.subtotal === product.price, 'preview subtotal');
  assert(typeof preview.shippingFee === 'number', 'preview shippingFee');
  assert(preview.total === preview.subtotal + preview.shippingFee, 'preview total');
  assert(preview.estimatedDays, 'preview estimatedDays');
  console.log('✓ POST /checkout/preview', preview.total, preview.currency);

  const stockBefore = product.stock;

  const { res: codRes, json: codOrder } = await api('/api/marketplace/orders', token, {
    method: 'POST',
    body: JSON.stringify({ items, shipping: SHIPPING, paymentMethod: 'cod' }),
  });
  assert(codRes.ok, `COD order failed: ${codRes.status} ${JSON.stringify(codOrder)}`);
  assert(codOrder.status === 'pending', 'COD order status pending');
  assert(codOrder.paymentMethod === 'cod', 'COD payment method');
  assert(codOrder.shippingCity === SHIPPING.city, 'shipping snapshot');
  assert(codOrder.needsPayment === false, 'COD needsPayment false');
  assert(codOrder.payments?.length >= 1, 'COD payment record');
  console.log('✓ POST /orders (COD)', codOrder.id);

  const afterCod = await prisma.product.findUnique({ where: { id: product.id } });
  assert(afterCod.stock === stockBefore - 1, 'COD decrements stock');

  const product2 = await prisma.product.findFirst({
    where: { isActive: true, stock: { gte: 1 }, id: { not: product.id } },
  });
  assert(product2, 'Need second product for card test');
  const cardItems = [{ productId: product2.id, quantity: 1 }];
  const stock2Before = product2.stock;

  const { res: cardRes, json: cardOrder } = await api('/api/marketplace/orders', token, {
    method: 'POST',
    body: JSON.stringify({ items: cardItems, shipping: SHIPPING, paymentMethod: 'card' }),
  });
  assert(cardRes.ok, `card order failed: ${cardRes.status} ${JSON.stringify(cardOrder)}`);
  assert(cardOrder.status === 'pending_payment', 'card order pending_payment');
  assert(cardOrder.needsPayment === true, 'card needsPayment true');
  console.log('✓ POST /orders (card)', cardOrder.id);

  const midStock = await prisma.product.findUnique({ where: { id: product2.id } });
  assert(midStock.stock === stock2Before, 'card order does not decrement stock before pay');

  const { res: payRes, json: paid } = await api(
    `/api/marketplace/orders/${cardOrder.id}/confirm-payment`,
    token,
    { method: 'POST' }
  );
  assert(payRes.ok, `confirm payment failed: ${payRes.status} ${JSON.stringify(paid)}`);

  const autoRefundExpected =
    process.env.NODE_ENV !== 'production' && process.env.CHECKOUT_AUTO_REFUND !== 'false';

  if (autoRefundExpected) {
    assert(paid.status === 'cancelled', 'auto-refund cancels order');
    assert(paid.payments?.[0]?.status === 'refunded', 'payment marked refunded');
    assert(paid.autoRefunded === true, 'autoRefunded flag');
    const afterPay = await prisma.product.findUnique({ where: { id: product2.id } });
    assert(afterPay.stock === stock2Before, 'stock unchanged after auto-refund');
    console.log('✓ POST /orders/:id/confirm-payment (auto-refund)');
  } else {
    assert(paid.status === 'confirmed', 'paid order confirmed');
    assert(paid.payments?.[0]?.status === 'paid', 'payment marked paid');
    const afterPay = await prisma.product.findUnique({ where: { id: product2.id } });
    assert(afterPay.stock === stock2Before - 1, 'stock decrements after mock pay');
    console.log('✓ POST /orders/:id/confirm-payment');
  }

  const { res: meRes, json: orders } = await api('/api/marketplace/orders/me', token);
  assert(meRes.ok && orders.some((o) => o.id === codOrder.id), 'orders/me includes COD');
  assert(orders.some((o) => o.id === cardOrder.id), 'orders/me includes card order');
  console.log('✓ GET /orders/me', orders.length, 'orders');

  console.log('\n✓ All checkout API tests passed');
}

main()
  .catch((e) => {
    console.error('\n✗', e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
