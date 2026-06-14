const { getStripe } = require('../services/stripeClient');
const { logger } = require('../lib/logger');
const { fulfillStripeCheckoutSession } = require('../lib/stripeCheckout');

async function handleStripeWebhook(req, res) {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    logger.warn('STRIPE_WEBHOOK_SECRET is not set — webhook ignored');
    return res.status(503).json({ error: 'Webhook secret not configured' });
  }

  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, secret);
  } catch (err) {
    logger.warn({ err }, 'Stripe webhook signature verification failed');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await fulfillStripeCheckoutSession(event.data.object.id);
    }
  } catch (err) {
    logger.error({ err, type: event.type }, 'Stripe webhook handler failed');
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  return res.json({ received: true });
}

module.exports = { handleStripeWebhook };
