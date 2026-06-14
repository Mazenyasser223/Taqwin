/**
 * Unit tests for Stripe checkout helpers (no API calls).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { toMinorUnits } = require('../src/lib/stripeCheckout');
const { isStripeEnabled, isStripeTestMode } = require('../src/services/stripeClient');

describe('stripeCheckout helpers', () => {
  it('toMinorUnits for EGP', () => {
    expect(toMinorUnits(1899, 'EGP')).toBe(189900);
    expect(toMinorUnits(49.5, 'egp')).toBe(4950);
  });
});

describe('stripeClient flags', () => {
  const orig = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    if (orig === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = orig;
  });

  it('disabled without key', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(isStripeEnabled()).toBe(false);
  });

  it('test mode detection', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    expect(isStripeEnabled()).toBe(true);
    expect(isStripeTestMode()).toBe(true);
  });
});
