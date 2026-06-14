/**
 * Unit tests for checkout totals and shipping zones.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getShippingQuote, FREE_SHIPPING_MIN } = require('../src/lib/shippingZones');
const { computeCheckoutTotals } = require('../src/lib/checkoutTotals');

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
});
