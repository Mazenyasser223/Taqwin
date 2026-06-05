import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';

interface ImageLightboxProps {
  open: boolean;
  src: string;
  alt?: string;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ open, src, alt = '', onClose }) => {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-3 sm:p-6 backdrop-blur-md"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={alt || t('common.close')}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute end-3 top-3 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:end-5 sm:top-5"
            aria-label={t('common.close')}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <motion.img
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[min(88dvh,calc(100dvh-2rem))] w-auto max-w-[min(100%,calc(100vw-1.5rem))] rounded-xl object-contain shadow-2xl sm:max-h-[min(90dvh,calc(100dvh-3rem))] sm:max-w-[min(100%,calc(100vw-3rem))] sm:rounded-2xl"
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
