import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { assertCheckoutTotals, toPaymobAmountCents } = requireFromHere('../src/lib/checkoutTotals');
const { computeOrderTotals } = requireFromHere('../src/lib/shopShipping');

describe('checkoutTotals', () => {
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
