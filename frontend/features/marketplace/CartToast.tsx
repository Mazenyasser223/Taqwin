import React from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import type { CartToastState } from './useCartActions';

interface CartToastProps {
  toast: CartToastState | null;
  onDismiss: () => void;
}

export const CartToast: React.FC<CartToastProps> = ({ toast, onDismiss }) => {
  const { t } = useI18n();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast.productName}
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.22 }}
          className="pointer-events-none fixed inset-x-4 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-[110] mx-auto max-w-md sm:top-6 lg:top-8"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-emerald-400/40 bg-zinc-900/95 px-4 py-3.5 shadow-2xl shadow-black/40 backdrop-blur-md">
            <span className="material-symbols-outlined mt-0.5 shrink-0 text-2xl text-emerald-400">
              check_circle
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black leading-snug text-white">
                {t('marketplace.addedToCartTitle')}
              </p>
              <p className="mt-0.5 text-xs font-medium leading-snug text-emerald-100/95 line-clamp-2">
                {toast.productName}
              </p>
            </div>
            <Link
              to="/marketplace/cart"
              onClick={onDismiss}
              className="shrink-0 rounded-lg bg-primary/90 px-2.5 py-1.5 text-[10px] font-black uppercase leading-none text-white hover:bg-primary"
            >
              {t('marketplace.viewCart')}
            </Link>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};
