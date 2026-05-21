import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import type { PostMediaItem } from '../../types';

interface PostMediaLightboxProps {
  items: PostMediaItem[];
  initialIndex: number;
  onClose: () => void;
}

export const PostMediaLightbox: React.FC<PostMediaLightboxProps> = ({ items, initialIndex, onClose }) => {
  const { t } = useI18n();
  const [index, setIndex] = useState(initialIndex);
  const current = items[index];

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(items.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [items.length, onClose]);

  if (!current || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[280] bg-black/95 flex flex-col"
        onClick={onClose}
      >
        <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          <span className="text-white/80 text-sm font-bold tabular-nums">
            {index + 1} / {items.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-white p-2 rounded-full hover:bg-white/10"
            aria-label={t('common.close')}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div
          className="flex-1 flex items-center justify-center relative min-h-0 px-4 pb-4"
          onClick={(e) => e.stopPropagation()}
        >
          {index > 0 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              className="absolute left-2 z-10 size-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
          )}
          {index < items.length - 1 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="absolute right-2 z-10 size-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          )}
          {current.mediaType === 'video' ? (
            <video
              key={current.url}
              src={current.url}
              controls
              autoPlay
              playsInline
              className="max-w-full max-h-[calc(100vh-5rem)] object-contain"
            />
          ) : (
            <img
              src={current.url}
              alt=""
              className="max-w-full max-h-[calc(100vh-5rem)] object-contain select-none"
              draggable={false}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};
