/**
 * Unit tests for payment auto-refund helpers.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('paymentRefund', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('isAutoRefundEnabled defaults on in development', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CHECKOUT_AUTO_REFUND;
    const { isAutoRefundEnabled } = require('../src/lib/paymentRefund');
    expect(isAutoRefundEnabled()).toBe(true);
  });

  it('isAutoRefundEnabled opt-out in development', async () => {
    process.env.NODE_ENV = 'development';
    process.env.CHECKOUT_AUTO_REFUND = 'false';
    const { isAutoRefundEnabled } = require('../src/lib/paymentRefund');
    expect(isAutoRefundEnabled()).toBe(false);
  });

  it('isAutoRefundEnabled off in production unless explicit', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CHECKOUT_AUTO_REFUND;
    const { isAutoRefundEnabled } = require('../src/lib/paymentRefund');
    expect(isAutoRefundEnabled()).toBe(false);
  });

  it('refundPayment mock provider', async () => {
    const { refundPayment } = require('../src/lib/paymentRefund');
    const result = await refundPayment({ id: 'pay-1', provider: 'mock' });
    expect(result.refundId).toBe('mock_ref_pay-1');
  });
});
