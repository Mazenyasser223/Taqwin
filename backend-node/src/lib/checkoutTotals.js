/**
 * Checkout total invariants — cart, order row, Paymob/Stripe must share one amount.
 */
const { getShippingQuote } = require('./shippingZones');

const AMOUNT_EPSILON = 0.01;

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toPaymobAmountCents(totalEgp) {
  return Math.round(roundMoney(totalEgp) * 100);
}

function sumItemsSubtotal(itemsData) {
  return roundMoney(itemsData.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
}

function assertCheckoutTotals(order, itemsData) {
  const itemsSubtotal = sumItemsSubtotal(itemsData);
  const discountAmount = roundMoney(order.discountAmount ?? 0);
  const orderSubtotal = roundMoney(order.subtotal);
  const shippingFee = roundMoney(order.shippingFee ?? 0);
  const orderTotal = roundMoney(order.total);

  if (Math.abs(itemsSubtotal - discountAmount - orderSubtotal) > AMOUNT_EPSILON) {
    const err = new Error(
      `Checkout subtotal mismatch: items=${itemsSubtotal} discount=${discountAmount} order.subtotal=${orderSubtotal}`
    );
    err.status = 500;
    throw err;
  }

  if (Math.abs(orderSubtotal + shippingFee - orderTotal) > AMOUNT_EPSILON) {
    const err = new Error(
      `Checkout total mismatch: subtotal(${orderSubtotal}) + shipping(${shippingFee}) != total(${orderTotal})`
    );
    err.status = 500;
    throw err;
  }

  return {
    subtotal: orderSubtotal,
    shippingFee,
    total: orderTotal,
    paymobAmountCents: toPaymobAmountCents(orderTotal),
  };
}

function computeLineItems(items, productMap) {
  let subtotal = 0;
  const itemsData = [];
  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw Object.assign(new Error('One or more products are unavailable'), { status: 400 });
    }
    if (product.stock < item.quantity) {
      throw Object.assign(new Error(`Insufficient stock for ${product.name}`), { status: 400 });
    }
    subtotal += product.price * item.quantity;
    itemsData.push({
      productId: product.id,
      quantity: item.quantity,
      unitPrice: product.price,
    });
  }
  return { subtotal, itemsData };
}

function computeCheckoutTotals(items, productMap, governorate) {
  const { subtotal, itemsData } = computeLineItems(items, productMap);
  const shipping = getShippingQuote(governorate, subtotal);
  const currency = [...productMap.values()][0]?.currency || 'EGP';
  return {
    subtotal,
    shippingFee: shipping.shippingFee,
    total: subtotal + shipping.shippingFee,
    currency,
    estimatedDays: shipping.estimatedDays,
    freeShippingApplied: shipping.freeShippingApplied,
    freeShippingMin: shipping.freeShippingMin,
    itemsData,
  };
}

module.exports = {
  AMOUNT_EPSILON,
  roundMoney,
  toPaymobAmountCents,
  sumItemsSubtotal,
  assertCheckoutTotals,
  computeCheckoutTotals,
  computeLineItems,
};
