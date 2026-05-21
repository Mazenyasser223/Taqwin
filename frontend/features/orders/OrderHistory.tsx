import React, { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion } from 'framer-motion';
import { staggerContainer, itemVariants, weightedTransition } from '../../lib/motion';
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

export const OrderHistory: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const { t, language } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    marketplaceService.getMyOrders().then((res) => {
      if (!mounted) return;
      if (res.error) setError(res.error);
      else setOrders(res.data ?? []);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="page-shell max-w-4xl mx-auto pb-2">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 relative">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={weightedTransition} className="relative z-10">
          <div className="flex items-center gap-3 text-primary mb-2">
            <span className="material-symbols-outlined font-black">receipt_long</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t('orders.badge')}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">{t('orders.vaultTitle')}</h1>
          <p className="text-muted mt-2 font-medium">{t('orders.vaultSubtitle')}</p>
        </motion.div>

        <div className="hidden lg:block absolute -top-10 right-0 w-64 h-64 pointer-events-none opacity-40">
          <OrdersVisual />
        </div>
      </div>

      {loading && <div className="text-primary animate-pulse">{t('orders.loading')}</div>}
      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
      {!loading && !error && orders.length === 0 && (
        <div className="glass-panel p-10 rounded-3xl text-center text-muted">
          {t('orders.empty')}
        </div>
      )}

      <motion.div variants={staggerContainer(0.1)} initial="hidden" animate="visible" className="space-y-6">
        {orders.map((order) => {
          const isOpen = expanded === order.id;
          const itemNames = order.items?.map((i) => i.product?.name ?? t('orders.item')).join(', ') ?? '—';
          const locale = language === 'ar' ? 'ar-EG' : 'en-US';
          return (
            <motion.div key={order.id} variants={itemVariants} className="glass-panel rounded-2xl sm:rounded-[2.5rem] border border-subtle hover:border-primary/20 transition-all group overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : order.id)}
                className="w-full p-4 sm:p-8 flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-8 text-left"
              >
                <div className="size-16 bg-elevated rounded-2xl flex items-center justify-center text-primary border border-subtle group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-3xl font-black">inventory_2</span>
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                  <p className="text-[10px] font-black uppercase text-faint tracking-[0.2em]">#{order.id.slice(0, 8)}</p>
                  <h3 className="text-xl font-black text-foreground truncate">{itemNames}</h3>
                  <p className="text-sm font-medium text-faint">
                    {new Date(order.createdAt).toLocaleDateString(locale, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-2xl font-black tabular-nums">${order.total.toFixed(2)}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">{t('orders.total')}</p>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${STATUS_STYLES[order.status]}`}>
                    {t(STATUS_LABEL_KEY[order.status])}
                  </div>
                  <span className={`material-symbols-outlined transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                    chevron_right
                  </span>
                </div>
              </button>
              {isOpen && order.items && (
                <div className="border-t border-subtle px-8 py-6 bg-black/20 space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="font-bold">{item.product?.name ?? t('orders.item')} × {item.quantity}</span>
                      <span className="text-muted">${(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};
