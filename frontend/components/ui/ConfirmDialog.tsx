import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useI18n();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onCancel}
          role="presentation"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-desc"
            className="w-full max-w-md rounded-3xl bg-surface border border-border shadow-2xl p-6 sm:p-8"
          >
            <div className="flex items-start gap-4 mb-4">
              <span
                className={`material-symbols-outlined text-3xl shrink-0 ${
                  variant === 'danger' ? 'text-red-400' : 'text-primary'
                }`}
              >
                {variant === 'danger' ? 'warning' : 'help'}
              </span>
              <div className="min-w-0">
                <h3 id="confirm-dialog-title" className="text-lg font-black text-foreground">
                  {title}
                </h3>
                <p id="confirm-dialog-desc" className="text-sm text-muted font-medium mt-2 leading-relaxed">
                  {message}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="flex-1 py-3 rounded-xl border border-subtle text-sm font-bold text-muted hover:text-foreground hover:bg-elevated transition-colors disabled:opacity-50"
              >
                {cancelLabel ?? t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 ${
                  variant === 'danger'
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {loading ? '…' : (confirmLabel ?? t('common.confirm'))}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
