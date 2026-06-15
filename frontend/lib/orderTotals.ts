import type { Order } from '../types';

export function orderDisplayCurrency(order: Order): string {
  return order.currency ?? order.items?.[0]?.product?.currency ?? 'EGP';
}

export function orderItemsSubtotal(order: Order): number {
  if (order.subtotal != null && Number.isFinite(order.subtotal)) {
    return order.subtotal;
  }
  return (order.items ?? []).reduce(
    (sum, item) => sum + (Number(item.unitPrice) || 0) * item.quantity,
    0,
  );
}

export function orderShippingFee(order: Order): number {
  return Number(order.shippingFee) || 0;
}

export function orderGrandTotal(order: Order): number {
  return Number(order.total) || orderItemsSubtotal(order) + orderShippingFee(order);
}
