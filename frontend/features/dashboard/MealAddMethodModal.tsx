import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { useI18n } from '../../lib/i18n/useI18n';

type Props = {
  open: boolean;
  slotLabel: string;
  onPhoto: () => void;
  onBarcode: () => void;
  onClose: () => void;
};

export function MealAddMethodModal({ open, slotLabel, onPhoto, onBarcode, onClose }: Props) {
  const { t } = useI18n();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[205] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="meal-add-method-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="meal-add-method-title" className="text-lg font-bold text-gray-900 dark:text-white">
                  {t('dashboard.mealAddMethodTitle')}
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('dashboard.mealAddMethodSubtitle', { meal: slotLabel })}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                aria-label={t('common.cancel')}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <ul className="mt-4 space-y-2">
              <li>
                <button
                  type="button"
                  onClick={onPhoto}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-3 text-start transition-colors hover:border-violet-500/40 hover:bg-violet-500/5 dark:border-gray-700 dark:bg-white/[0.03] dark:hover:border-violet-500/40"
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      'bg-violet-500/15 text-violet-600 dark:text-violet-400'
                    )}
                  >
                    <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-gray-900 dark:text-white">
                      {t('dashboard.mealAddMethodPhoto')}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-gray-500 dark:text-gray-400">
                      {t('dashboard.mealAddMethodPhotoHint')}
                    </span>
                  </span>
                  <span className="material-symbols-outlined shrink-0 text-gray-400">chevron_right</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onBarcode}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-3 text-start transition-colors hover:border-brand-500/40 hover:bg-brand-500/5 dark:border-gray-700 dark:bg-white/[0.03] dark:hover:border-brand-500/40"
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      'bg-brand-500/15 text-brand-600 dark:text-brand-400'
                    )}
                  >
                    <span className="material-symbols-outlined text-[20px]">barcode_scanner</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-gray-900 dark:text-white">
                      {t('dashboard.mealAddMethodBarcode')}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-gray-500 dark:text-gray-400">
                      {t('dashboard.mealAddMethodBarcodeHint')}
                    </span>
                  </span>
                  <span className="material-symbols-outlined shrink-0 text-gray-400">chevron_right</span>
                </button>
              </li>
            </ul>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
