/**
 * Checkout total invariants — cart, order row, and Paymob must share one amount.
 */
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

module.exports = {
  AMOUNT_EPSILON,
  roundMoney,
  toPaymobAmountCents,
  sumItemsSubtotal,
  assertCheckoutTotals,
};
