import type { Order, OrderStatus } from '../../types';

export const ORDER_STATUS_RANK: Record<OrderStatus, number> = {
  cancelled: -1,
  pending: 0,
  pending_payment: 1,
  confirmed: 2,
  processing: 3,
  packed: 4,
  shipped: 5,
  delivered: 6,
};

export function orderStatusRank(status: OrderStatus | string | undefined): number {
  if (status && status in ORDER_STATUS_RANK) return ORDER_STATUS_RANK[status as OrderStatus];
  return 0;
}

export type OrderTimelineStep = {
  key: string;
  labelKey: string;
  icon: string;
  done: boolean;
  at?: string | null;
};

export function buildOrderTimeline(order: Order): OrderTimelineStep[] {
  const rank = orderStatusRank(order.status);
  const paid = order.paymentStatus === 'paid' || Boolean(order.paidAt);

  return [
    {
      key: 'placed',
      labelKey: 'orders.timeline.placed',
      icon: 'shopping_cart',
      done: true,
      at: order.createdAt,
    },
    {
      key: 'paid',
      labelKey: 'orders.timeline.paid',
      icon: 'payments',
      done: paid,
      at: order.paidAt,
    },
    {
      key: 'confirmed',
      labelKey: 'orders.timeline.confirmed',
      icon: 'verified',
      done: rank >= ORDER_STATUS_RANK.confirmed,
    },
    {
      key: 'processing',
      labelKey: 'orders.timeline.processing',
      icon: 'precision_manufacturing',
      done: rank >= ORDER_STATUS_RANK.processing,
    },
    {
      key: 'packed',
      labelKey: 'orders.timeline.packed',
      icon: 'inventory_2',
      done: rank >= ORDER_STATUS_RANK.packed,
    },
    {
      key: 'shipped',
      labelKey: 'orders.timeline.shipped',
      icon: 'local_shipping',
      done: Boolean(order.shippedAt) || rank >= ORDER_STATUS_RANK.shipped,
      at: order.shippedAt,
    },
    {
      key: 'delivered',
      labelKey: 'orders.timeline.delivered',
      icon: 'check_circle',
      done: Boolean(order.deliveredAt) || rank >= ORDER_STATUS_RANK.delivered,
      at: order.deliveredAt,
    },
  ];
}
