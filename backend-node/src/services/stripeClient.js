/** Stripe client (test/live via STRIPE_SECRET_KEY). */

let stripeInstance = null;

function isStripeEnabled() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return Boolean(key && key.startsWith('sk_'));
}

function isStripeTestMode() {
  return process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') === true;
}

function getStripe() {
  if (!isStripeEnabled()) return null;
  if (!stripeInstance) {
    const Stripe = require('stripe');
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY.trim());
  }
  return stripeInstance;
}

module.exports = { getStripe, isStripeEnabled, isStripeTestMode };
