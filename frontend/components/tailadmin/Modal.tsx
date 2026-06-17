import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

const maxWidthMap = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({ title, subtitle, onClose, children, maxWidth = 'md' }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 24, opacity: 0 }}
      className={cn(
        'flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-subtle bg-surface shadow-2xl sm:rounded-2xl',
        maxWidthMap[maxWidth],
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-subtle bg-surface px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h4 className="truncate text-lg font-bold text-primary">{title}</h4>
          {subtitle && <p className="mt-0.5 text-theme-xs text-muted">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-subtle text-muted transition-colors hover:bg-elevated-hover hover:text-primary"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
      <div className="custom-scrollbar flex-1 overflow-y-auto bg-surface">{children}</div>
    </motion.div>
  </motion.div>
);
