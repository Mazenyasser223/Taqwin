import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { useHorizontalSwipe } from './useHorizontalSwipe';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.35;

interface ZoomableMediaProps {
  src: string;
  alt?: string;
  onBack: () => void;
  label?: string;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

export const ZoomableMedia: React.FC<ZoomableMediaProps> = ({
  src,
  alt = '',
  onBack,
  label,
  hasPrev = false,
  hasNext = false,
  onPrev,
  onNext,
}) => {
  const { t } = useI18n();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    resetZoom();
  }, [src]);

  const zoomBy = (delta: number) => {
    setScale((s) => {
      const next = clampScale(s + delta);
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  useEffect(() => {
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
  }, []);

  const swipeEnabled = scale <= 1;
  const swipeHandlers = useHorizontalSwipe(
    () => hasNext && onNext?.(),
    () => hasPrev && onPrev?.(),
    swipeEnabled,
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
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
    swipeHandlers.onTouchStart(e);
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

  const onTouchEnd = (e: React.TouchEvent) => {
    swipeHandlers.onTouchEnd(e);
    pinchStart.current = null;
  };

  const onDoubleClick = () => {
    if (scale > 1) resetZoom();
    else setScale(2);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-2 py-1.5 shrink-0 bg-black/45 gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-white/90 text-xs font-bold hover:bg-white/10 rounded-lg px-2 py-1"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {t('community.backToGallery')}
        </button>
        {label && <span className="text-white/70 text-xs font-bold tabular-nums">{label}</span>}
        <div className="flex items-center gap-0.5 ml-auto">
          <button
            type="button"
            onClick={() => zoomBy(-ZOOM_STEP)}
            disabled={scale <= MIN_SCALE}
            className="size-8 rounded-full text-white hover:bg-white/10 disabled:opacity-30 flex items-center justify-center"
            aria-label={t('community.zoomOut')}
          >
            <span className="material-symbols-outlined text-xl">remove</span>
          </button>
          <span className="text-[10px] text-white/60 w-10 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={scale >= MAX_SCALE}
            className="size-8 rounded-full text-white hover:bg-white/10 disabled:opacity-30 flex items-center justify-center"
            aria-label={t('community.zoomIn')}
          >
            <span className="material-symbols-outlined text-xl">add</span>
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="size-8 rounded-full text-white hover:bg-white/10 flex items-center justify-center"
            aria-label={t('community.resetZoom')}
          >
            <span className="material-symbols-outlined text-lg">fit_screen</span>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-hidden bg-black/30 touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {hasPrev && scale <= 1 && (
          <button
            type="button"
            onClick={onPrev}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-10 size-8 rounded-full bg-black/60 text-white flex items-center justify-center md:hidden"
            aria-label={t('community.prevPhoto')}
          >
            <span className="material-symbols-outlined text-lg">chevron_left</span>
          </button>
        )}
        {hasNext && scale <= 1 && (
          <button
            type="button"
            onClick={onNext}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-10 size-8 rounded-full bg-black/60 text-white flex items-center justify-center md:hidden"
            aria-label={t('community.nextPhoto')}
          >
            <span className="material-symbols-outlined text-lg">chevron_right</span>
          </button>
        )}

        <div
          className={`w-full h-full flex items-center justify-center ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="max-w-full max-h-full object-contain select-none transition-transform duration-75 ease-out"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: 'center center',
            }}
          />
        </div>

        {scale <= 1 && (hasPrev || hasNext) && (
          <p className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-white/50 pointer-events-none">
            {t('community.swipePhotos')}
          </p>
        )}
      </div>
    </div>
  );
};
