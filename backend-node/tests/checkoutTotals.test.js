/**
 * Unit tests for checkout totals and shipping zones.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getShippingQuote, FREE_SHIPPING_MIN } = require('../src/lib/shippingZones');
const {
  assertCheckoutTotals,
  toPaymobAmountCents,
  computeCheckoutTotals,
} = require('../src/lib/checkoutTotals');
const { computeOrderTotals } = require('../src/lib/shopShipping');

describe('shippingZones', () => {
  it('cairo zone fee', () => {
    const q = getShippingQuote('Cairo', 500);
    expect(q.shippingFee).toBe(49);
    expect(q.estimatedDays).toBe('2-3');
  });

  it('alex zone fee', () => {
    const q = getShippingQuote('Alexandria', 500);
    expect(q.shippingFee).toBe(59);
  });

  it('free shipping over threshold', () => {
    const q = getShippingQuote('Cairo', FREE_SHIPPING_MIN);
    expect(q.freeShippingApplied).toBe(true);
    expect(q.shippingFee).toBe(0);
  });
});

describe('checkoutTotals', () => {
  const productMap = new Map([
    [
      'p1',
      { id: 'p1', name: 'Test', price: 1000, stock: 10, currency: 'EGP', isActive: true },
    ],
  ]);

  it('computes subtotal + shipping', () => {
    const t = computeCheckoutTotals([{ productId: 'p1', quantity: 2 }], productMap, 'Cairo');
    expect(t.subtotal).toBe(2000);
    expect(t.shippingFee).toBe(0);
    expect(t.total).toBe(2000);
    expect(t.itemsData).toHaveLength(1);
  });

  it('throws on insufficient stock', () => {
    expect(() =>
      computeCheckoutTotals([{ productId: 'p1', quantity: 99 }], productMap, 'Cairo')
    ).toThrow(/Insufficient stock/);
  });

  it('subtotal + shipping = total and Paymob cents match', () => {
    const items = [{ productId: 'p1', quantity: 2, unitPrice: 700 }];
    const { subtotal, shippingFee, total } = computeOrderTotals(1400);
    const order = { subtotal, shippingFee, total, currency: 'EGP', discountAmount: 0 };

    const result = assertCheckoutTotals(order, items);
    expect(result.total).toBe(1475);
    expect(result.paymobAmountCents).toBe(toPaymobAmountCents(1475));
    expect(result.subtotal + result.shippingFee).toBe(result.total);
  });

  it('free shipping when subtotal >= 1500', () => {
    const items = [{ productId: 'p1', quantity: 1, unitPrice: 1600 }];
    const { subtotal, shippingFee, total } = computeOrderTotals(1600);
    const order = { subtotal, shippingFee, total, currency: 'EGP', discountAmount: 0 };

    const result = assertCheckoutTotals(order, items);
    expect(result.shippingFee).toBe(0);
    expect(result.total).toBe(1600);
    expect(result.paymobAmountCents).toBe(160000);
  });

  it('throws when order total does not equal subtotal + shipping', () => {
    const items = [{ productId: 'p1', quantity: 1, unitPrice: 500 }];
    const order = { subtotal: 500, shippingFee: 75, total: 575, currency: 'EGP', discountAmount: 0 };

    expect(() => assertCheckoutTotals(order, items)).toThrow(/total mismatch/i);
  });
});
