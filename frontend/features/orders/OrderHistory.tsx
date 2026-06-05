import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion } from 'framer-motion';
import { weightedTransition } from '../../lib/motion';
import { formatShopPrice } from '../../lib/shopFormat';
import { OrdersVisual } from '../../3d/PageSpecificVisuals';
import marketplaceService from '../../services/marketplaceService';
import type { Order, OrderStatus } from '../../types';
import type { TranslationKey } from '../../lib/i18n/translations';

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  confirmed: 'bg-primary/10 border-primary/20 text-primary',
  shipped: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  delivered: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/10 border-red-500/20 text-red-400',
};

const STATUS_LABEL_KEY: Record<OrderStatus, TranslationKey> = {
  pending: 'orders.status.pending',
  confirmed: 'orders.status.confirmed',
  shipped: 'orders.status.shipped',
  delivered: 'orders.status.delivered',
  cancelled: 'orders.status.cancelled',
};

function normalizeStatus(status: string | undefined): OrderStatus {
  if (status && status in STATUS_STYLES) return status as OrderStatus;
  return 'pending';
}

export const OrderHistory: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const { t, language } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const location = useLocation();

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await marketplaceService.getMyOrders();
      if (res.error) {
        setError(res.error);
        setOrders([]);
      } else {
        setOrders(res.data ?? []);
      }
    } catch {
      setError(t('orders.loadFailed'));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders, location.pathname, location.key]);

  return (
    <div className="page-shell max-w-4xl mx-auto pb-2">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 relative">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={weightedTransition}
          className="relative z-10"
        >
          <div className="flex items-center gap-3 text-primary mb-2">
            <span className="material-symbols-outlined font-black">receipt_long</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t('orders.badge')}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
            {t('orders.vaultTitle')}
          </h1>
          <p className="text-muted mt-2 font-medium">{t('orders.vaultSubtitle')}</p>
        </motion.div>

        <div className="hidden lg:block absolute -top-10 right-0 w-64 h-64 pointer-events-none opacity-40">
          <OrdersVisual />
        </div>
      </div>

      {loading ? (
        <div className="glass-panel rounded-2xl p-8 text-center text-primary animate-pulse">
          {t('orders.loading')}
        </div>
      ) : null}

      {error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm space-y-3">
          <p>{error}</p>
          <button
            type="button"
            onClick={loadOrders}
            className="rounded-lg bg-red-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wide"
          >
            {t('orders.retry')}
          </button>
        </div>
      ) : null}

      {!loading && !error && orders.length === 0 ? (
        <div className="glass-panel p-10 rounded-3xl text-center text-muted space-y-4">
          <p>{t('orders.empty')}</p>
          <Link
            to="/marketplace"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-black uppercase tracking-wide text-white"
          >
            {t('orders.browseShop')}
          </Link>
        </div>
      ) : null}

      {!loading && !error && orders.length > 0 ? (
        <div className="space-y-6">
          {orders.map((order) => {
            const isOpen = expanded === order.id;
            const status = normalizeStatus(order.status);
            const itemNames =
              order.items?.map((i) => i.product?.name ?? t('orders.item')).join(', ') ??
              t('orders.item');
            const locale = language === 'ar' ? 'ar-EG' : 'en-US';
            const currency =
              order.items?.[0]?.product?.currency ??
              (order as Order & { currency?: string }).currency ??
              'EGP';
            const totalLabel = formatShopPrice(Number(order.total) || 0, currency, language);

            return (
              <article
                key={order.id}
                className="glass-panel rounded-2xl sm:rounded-[2.5rem] border border-subtle hover:border-primary/20 transition-all group overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  className="w-full p-4 sm:p-8 flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-8 text-left"
                >
                  <div className="size-16 bg-elevated rounded-2xl flex items-center justify-center text-primary border border-subtle group-hover:scale-110 transition-transform shrink-0">
                    <span className="material-symbols-outlined text-3xl font-black">inventory_2</span>
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="text-[10px] font-black uppercase text-faint tracking-[0.2em]">
                      #{order.id.slice(0, 8)}
                    </p>
                    <h3 className="text-xl font-black text-foreground truncate">{itemNames}</h3>
                    <p className="text-sm font-medium text-faint">
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString(locale, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 w-full md:w-auto">
                    <div className="text-start md:text-end">
                      <p className="text-2xl font-black tabular-nums text-foreground">{totalLabel}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-faint">
                        {t('orders.total')}
                      </p>
                    </div>
                    <div
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${STATUS_STYLES[status]}`}
                    >
                      {t(STATUS_LABEL_KEY[status])}
                    </div>
                    <span
                      className={`material-symbols-outlined transition-transform text-muted ${isOpen ? 'rotate-90' : ''}`}
                    >
                      chevron_right
                    </span>
                  </div>
                </button>
                {isOpen && order.items && order.items.length > 0 ? (
                  <div className="border-t border-subtle px-4 sm:px-8 py-6 bg-black/20 space-y-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-bold text-foreground">
                          {item.product?.name ?? t('orders.item')} × {item.quantity}
                        </span>
                        <span className="text-muted shrink-0">
                          {formatShopPrice(
                            (Number(item.unitPrice) || 0) * item.quantity,
                            item.product?.currency ?? currency,
                            language
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
