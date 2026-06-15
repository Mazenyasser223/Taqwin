/**
 * Paymob Accept — Egypt payment gateway (Intention API + legacy iframe).
 */
const crypto = require('crypto');
const { logger } = require('../lib/logger');
const { assertCheckoutTotals, toPaymobAmountCents } = require('../lib/checkoutTotals');

const PAYMOB_BASE = (process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com').replace(/\/$/, '');

function getPaymobApiKey() {
  return process.env.PAYMOB_API_KEY?.trim() || null;
}

function isPaymobConfigured() {
  const integrationId = process.env.PAYMOB_INTEGRATION_ID?.trim();
  const hmac = process.env.PAYMOB_HMAC_SECRET?.trim();
  if (!integrationId || !hmac) return false;
  if (process.env.PAYMOB_SECRET_KEY?.trim()) return true;
  const apiKey = getPaymobApiKey();
  const iframeId = process.env.PAYMOB_IFRAME_ID?.trim();
  return Boolean(apiKey && iframeId);
}

function usesIntentionApi() {
  return Boolean(process.env.PAYMOB_SECRET_KEY?.trim());
}

function buildBillingData(user, profile, order) {
  const display = profile?.displayName?.trim() || user.email.split('@')[0] || 'Taqwin';
  const parts = display.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || 'Taqwin';
  const lastName = parts.slice(1).join(' ') || 'Customer';

  let phone =
    order?.shippingPhone?.trim() ||
    user.phone?.trim() ||
    process.env.PAYMOB_FALLBACK_PHONE?.trim() ||
    '+201000000000';
  if (!phone.startsWith('+')) {
    phone = phone.startsWith('0') ? `+20${phone.slice(1)}` : `+20${phone}`;
  }

  const street = order?.shippingAddress?.trim() || 'NA';
  const city = order?.shippingCity?.trim() || 'Cairo';
  const state = order?.shippingGovernorate?.trim() || 'NA';

  return {
    apartment: 'NA',
    email: user.email,
    floor: 'NA',
    first_name: firstName.slice(0, 50),
    last_name: lastName.slice(0, 50),
    street: street.slice(0, 100),
    building: 'NA',
    phone_number: phone,
    shipping_method: 'PKG',
    postal_code: 'NA',
    city: city.slice(0, 50),
    country: 'EG',
    state: state.slice(0, 50),
  };
}

function getUnifiedCheckoutUrl(clientSecret) {
  const publicKey = process.env.PAYMOB_PUBLIC_KEY?.trim();
  if (!publicKey || !clientSecret) return null;
  return `${PAYMOB_BASE}/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;
}

function getLegacyIframeUrl(paymentToken) {
  const iframeId = process.env.PAYMOB_IFRAME_ID?.trim();
  if (!iframeId || !paymentToken) return null;
  return `${PAYMOB_BASE}/api/acceptance/iframes/${iframeId}?payment_token=${encodeURIComponent(paymentToken)}`;
}

async function paymobFetch(path, init) {
  const res = await fetch(`${PAYMOB_BASE}${path}`, init);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const detail = json?.detail || json?.message || text || res.statusText;
    const err = new Error(`Paymob request failed (${res.status}): ${detail}`);
    err.status = 502;
    err.payload = json;
    throw err;
  }
  return json;
}

function buildPaymobLineItems(order, products, itemsData) {
  const lines = itemsData.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    return {
      name: (product?.name || 'Product').slice(0, 100),
      amount: toPaymobAmountCents(item.unitPrice * item.quantity),
      description: (product?.name || 'Taqwin product').slice(0, 255),
      quantity: item.quantity,
    };
  });

  const shippingFee = Number(order.shippingFee) || 0;
  if (shippingFee > 0) {
    lines.push({
      name: 'Shipping',
      amount: toPaymobAmountCents(shippingFee),
      description: 'Delivery fee',
      quantity: 1,
    });
  }

  return lines;
}

function assertPaymobAmount(order, paymobItems) {
  const amountCents = toPaymobAmountCents(order.total);
  const linesTotalCents = paymobItems.reduce((sum, line) => sum + line.amount, 0);
  if (linesTotalCents !== amountCents) {
    const err = new Error(
      `Paymob line items (${linesTotalCents} cents) != order.total (${amountCents} cents)`
    );
    err.status = 500;
    throw err;
  }
  return amountCents;
}

async function createIntentionPayment({
  order,
  products,
  itemsData,
  billingData,
  notificationUrl,
  redirectionUrl,
}) {
  const integrationId = parseInt(process.env.PAYMOB_INTEGRATION_ID, 10);
  const amountCents = toPaymobAmountCents(order.total);
  const currency = order.currency || products[0]?.currency || 'EGP';

  const paymobItems = buildPaymobLineItems(order, products, itemsData);
  assertPaymobAmount(order, paymobItems);

  const body = {
    amount: amountCents,
    currency,
    payment_methods: [integrationId],
    items: paymobItems,
    billing_data: billingData,
    special_reference: order.id,
    notification_url: notificationUrl,
    redirection_url: redirectionUrl,
    extras: { taqwin_order_id: order.id },
    expiration: 3600,
  };

  const data = await paymobFetch('/v1/intention/', {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.PAYMOB_SECRET_KEY.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const checkoutUrl =
    getUnifiedCheckoutUrl(data.client_secret) ||
    getLegacyIframeUrl(data.payment_keys?.[0]?.key);

  return {
    mode: 'intention',
    paymobOrderId: String(data.intention_order_id ?? data.payment_keys?.[0]?.order_id ?? ''),
    paymentReference: data.id,
    checkoutUrl,
    paymobAmountCents: amountCents,
  };
}

async function createLegacyPayment({ order, products, billingData }) {
  const apiKey = getPaymobApiKey();
  const integrationId = parseInt(process.env.PAYMOB_INTEGRATION_ID, 10);
  const iframeId = process.env.PAYMOB_IFRAME_ID?.trim();
  if (!apiKey) {
    const err = new Error('PAYMOB_API_KEY is missing or invalid');
    err.status = 502;
    throw err;
  }
  if (!iframeId) {
    const err = new Error('PAYMOB_IFRAME_ID is required (Paymob Dashboard → Developers → Iframes)');
    err.status = 502;
    throw err;
  }

  const auth = await paymobFetch('/api/auth/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  });

  const amountCents = toPaymobAmountCents(order.total);
  const currency = order.currency || products[0]?.currency || 'EGP';

  const paymobOrder = await paymobFetch('/api/ecommerce/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: auth.token,
      delivery_needed: false,
      amount_cents: amountCents,
      currency,
      merchant_order_id: order.id,
      items: [],
    }),
  });

  const paymentKey = await paymobFetch('/api/acceptance/payment_keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: auth.token,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: paymobOrder.id,
      billing_data: billingData,
      currency,
      integration_id: integrationId,
      lock_order_when_paid: false,
    }),
  });

  return {
    mode: 'legacy',
    paymobOrderId: String(paymobOrder.id),
    paymentReference: String(paymobOrder.id),
    checkoutUrl: getLegacyIframeUrl(paymentKey.token),
    paymobAmountCents: amountCents,
  };
}

async function createCheckoutSession({
  order,
  user,
  profile,
  products,
  itemsData,
  notificationUrl,
  redirectionUrl,
}) {
  assertCheckoutTotals(order, itemsData);
  const billingData = buildBillingData(user, profile, order);

  if (usesIntentionApi()) {
    return createIntentionPayment({
      order,
      products,
      itemsData,
      billingData,
      notificationUrl,
      redirectionUrl,
    });
  }

  return createLegacyPayment({ order, products, billingData });
}

function computeTransactionHmac(transactionObj) {
  const secret = process.env.PAYMOB_HMAC_SECRET?.trim();
  if (!secret) return null;

  const obj = transactionObj;
  const fields = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    obj.order?.id,
    obj.owner,
    obj.pending,
    obj.source_data?.pan,
    obj.source_data?.sub_type,
    obj.source_data?.type,
    obj.success,
  ];

  const concatenated = fields.map((v) => String(v ?? '')).join('');
  return crypto.createHmac('sha512', secret).update(concatenated).digest('hex');
}

function verifyTransactionHmac(transactionObj, receivedHmac) {
  if (!receivedHmac) return false;
  const secret = process.env.PAYMOB_HMAC_SECRET?.trim();
  if (!secret) {
    logger.warn('Paymob webhook received but PAYMOB_HMAC_SECRET is not configured');
    return false;
  }
  const calculated = computeTransactionHmac(transactionObj);
  if (!calculated) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculated, 'hex'),
      Buffer.from(String(receivedHmac), 'hex')
    );
  } catch {
    return calculated === receivedHmac;
  }
}

function extractOrderIdFromTransaction(transactionObj) {
  return (
    transactionObj.order?.merchant_order_id ||
    transactionObj.payment_key_claims?.extra?.taqwin_order_id ||
    transactionObj.data?.merchant_order_id ||
    null
  );
}

module.exports = {
  PAYMOB_BASE,
  isPaymobConfigured,
  usesIntentionApi,
  getPaymobApiKey,
  buildBillingData,
  createCheckoutSession,
  verifyTransactionHmac,
  extractOrderIdFromTransaction,
  getUnifiedCheckoutUrl,
};
