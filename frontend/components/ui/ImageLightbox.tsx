import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.35;

interface ImageLightboxProps {
  open: boolean;
  src: string;
  alt?: string;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ open, src, alt = '', onClose }) => {
  const { t } = useI18n();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const scaleRef = useRef(scale);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  scaleRef.current = scale;

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const zoomBy = (delta: number) => {
    setScale((s) => {
      const next = clampScale(s + delta);
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  useEffect(() => {
    if (!open) {
      resetZoom();
      return;
    }
    resetZoom();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (scaleRef.current > 1) resetZoom();
        else onClose();
        return;
      }
      if (e.key === '+' || e.key === '=') zoomBy(ZOOM_STEP);
      if (e.key === '-') zoomBy(-ZOOM_STEP);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, src]);

  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setScale((s) => {
        const next = clampScale(s + delta);
        if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || scale <= 1) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  const touchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStart.current = { dist: touchDistance(e.touches), scale };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current) {
      e.preventDefault();
      const dist = touchDistance(e.touches);
      if (pinchStart.current.dist > 0) {
        const ratio = dist / pinchStart.current.dist;
        const next = clampScale(pinchStart.current.scale * ratio);
        setScale(next);
        if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      }
    }
  };

  const onTouchEnd = () => {
    pinchStart.current = null;
  };

  const onDoubleClick = () => {
    if (scale > 1) resetZoom();
    else setScale(2);
  };

  const onBackdropClick = () => {
    if (scale > 1) resetZoom();
    else onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex flex-col bg-black/90 backdrop-blur-md"
          onClick={onBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-label={alt || t('common.close')}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute end-3 top-3 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:end-5 sm:top-5"
            aria-label={t('common.close')}
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          <div
            ref={containerRef}
            className="flex-1 min-h-0 w-full overflow-hidden touch-none"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div
              className={`flex h-full w-full items-center justify-center p-3 sm:p-6 ${
                scale > 1 ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={onDoubleClick}
            >
              <motion.img
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                src={src}
                alt={alt}
                draggable={false}
                className="max-h-[min(88dvh,calc(100dvh-2rem))] w-auto max-w-[min(100%,calc(100vw-1.5rem))] select-none rounded-xl object-contain shadow-2xl sm:max-h-[min(90dvh,calc(100dvh-3rem))] sm:max-w-[min(100%,calc(100vw-3rem))] sm:rounded-2xl"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                }}
              />
            </div>
          </div>

          <div
            className="flex shrink-0 items-center justify-center gap-1 pb-4 pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => zoomBy(-ZOOM_STEP)}
              disabled={scale <= MIN_SCALE}
              className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
              aria-label={t('community.zoomOut')}
            >
              <span className="material-symbols-outlined text-xl">remove</span>
            </button>
            <span className="w-12 text-center text-xs font-bold tabular-nums text-white/70">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => zoomBy(ZOOM_STEP)}
              disabled={scale >= MAX_SCALE}
              className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
              aria-label={t('community.zoomIn')}
            >
              <span className="material-symbols-outlined text-xl">add</span>
            </button>
            <button
              type="button"
              onClick={resetZoom}
              disabled={scale <= MIN_SCALE}
              className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
              aria-label={t('community.resetZoom')}
            >
              <span className="material-symbols-outlined text-lg">fit_screen</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
