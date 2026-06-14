const { getShippingQuote } = require('./shippingZones');

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

module.exports = { computeCheckoutTotals, computeLineItems };
