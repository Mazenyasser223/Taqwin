/**
 * Shop shipping fee rules (Egypt).
 * Free shipping when subtotal >= SHOP_FREE_SHIPPING_MIN_EGP (default 1500).
 */

function getFreeShippingMinimum() {
  const raw = Number(process.env.SHOP_FREE_SHIPPING_MIN_EGP);
  return Number.isFinite(raw) && raw > 0 ? raw : 1500;
}

function getFlatShippingFee() {
  const raw = Number(process.env.SHOP_FLAT_SHIPPING_FEE_EGP);
  return Number.isFinite(raw) && raw >= 0 ? raw : 75;
}

function computeShippingFee(subtotal) {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  if (safeSubtotal >= getFreeShippingMinimum()) return 0;
  return getFlatShippingFee();
}

function computeOrderTotals(subtotal) {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const shippingFee = computeShippingFee(safeSubtotal);
  return {
    subtotal: safeSubtotal,
    shippingFee,
    total: safeSubtotal + shippingFee,
  };
}

function getShippingRules() {
  return {
    freeShippingMin: getFreeShippingMinimum(),
    flatFee: getFlatShippingFee(),
    currency: 'EGP',
  };
}

module.exports = {
  getFreeShippingMinimum,
  getFlatShippingFee,
  computeShippingFee,
  computeOrderTotals,
  getShippingRules,
};
