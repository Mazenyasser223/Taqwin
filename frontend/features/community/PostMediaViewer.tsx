import React, { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { PostMediaItem } from '../../types';
import { ZoomableMedia } from './ZoomableMedia';
import { useHorizontalSwipe } from './useHorizontalSwipe';

const MEDIA_FRAME = 'w-full h-[min(420px,70vw)] max-h-[min(420px,70vw)] overflow-hidden';

function findAdjacentImageIndex(items: PostMediaItem[], from: number, dir: 1 | -1): number | null {
  let i = from + dir;
  while (i >= 0 && i < items.length) {
    if (items[i].mediaType === 'image') return i;
    i += dir;
  }
  return null;
}

interface PostMediaViewerProps {
  items: PostMediaItem[];
  initialIndex: number;
  mode: 'carousel' | 'gallery';
  onClose: () => void;
}

export const PostMediaViewer: React.FC<PostMediaViewerProps> = ({
  items,
  initialIndex,
  mode,
  onClose,
}) => {
  const { t } = useI18n();
  const [index, setIndex] = useState(initialIndex);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const current = items[index];

  useEffect(() => {
    setIndex(initialIndex);
    setZoomIndex(null);
  }, [initialIndex]);

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(items.length - 1, i + 1));

  const goPrevImage = () => {
    if (zoomIndex === null) return;
    const prev = findAdjacentImageIndex(items, zoomIndex, -1);
    if (prev !== null) setZoomIndex(prev);
  };

  const goNextImage = () => {
    if (zoomIndex === null) return;
    const next = findAdjacentImageIndex(items, zoomIndex, 1);
    if (next !== null) setZoomIndex(next);
  };

  const browseSwipe = useHorizontalSwipe(goNext, goPrev, zoomIndex === null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomIndex !== null) {
          setZoomIndex(null);
          return;
        }
        onClose();
        return;
      }
      if (zoomIndex !== null) {
        if (e.key === 'ArrowLeft') goPrevImage();
        if (e.key === 'ArrowRight') goNextImage();
        return;
      }
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length, onClose, zoomIndex]);

  if (!current) return null;

  const zoomItem = zoomIndex !== null ? items[zoomIndex] : null;
  const zoomPrev = zoomIndex !== null ? findAdjacentImageIndex(items, zoomIndex, -1) : null;
  const zoomNext = zoomIndex !== null ? findAdjacentImageIndex(items, zoomIndex, 1) : null;

  const renderMediaSlide = (item: PostMediaItem, slideIndex: number, allowZoom: boolean) => (
    <div className="w-full h-full flex items-center justify-center min-h-[180px]">
      {item.mediaType === 'video' ? (
        <video
          key={item.url}
          src={item.url}
          controls
          playsInline
          className="w-full max-h-[min(360px,65vw)] object-contain"
        />
      ) : allowZoom ? (
        <button
          type="button"
          onClick={() => setZoomIndex(slideIndex)}
          className="w-full h-full flex items-center justify-center cursor-zoom-in"
          title={t('community.tapToZoom')}
        >
          <img
            src={item.url}
            alt=""
            className="w-full max-h-[min(360px,65vw)] object-contain select-none"
            draggable={false}
          />
        </button>
      ) : (
        <img
          src={item.url}
          alt=""
          className="w-full max-h-[min(360px,65vw)] object-contain select-none"
          draggable={false}
        />
      )}
    </div>
  );

  return (
    <div
      className={`${MEDIA_FRAME} bg-black/25 rounded-lg flex flex-col shadow-inner`}
      onClick={(e) => e.stopPropagation()}
    >
      {zoomItem?.mediaType === 'image' ? (
        <ZoomableMedia
          src={zoomItem.url}
          label={`${zoomIndex! + 1} / ${items.length}`}
          onBack={() => setZoomIndex(null)}
          hasPrev={zoomPrev !== null}
          hasNext={zoomNext !== null}
          onPrev={goPrevImage}
          onNext={goNextImage}
        />
      ) : (
        <>
          <div className="flex items-center justify-between px-3 py-2 shrink-0 bg-black/35">
            <span className="text-white/80 text-xs font-bold tabular-nums">
              {index + 1} / {items.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-white/90 p-1 rounded-full hover:bg-white/10"
              aria-label={t('common.close')}
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <div
            className="relative flex-1 min-h-0 flex flex-col touch-pan-y"
            onTouchStart={browseSwipe.onTouchStart}
            onTouchEnd={browseSwipe.onTouchEnd}
          >
            {index > 0 && (
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-1 top-1/2 -translate-y-1/2 z-10 size-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
              >
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
            )}
            {index < items.length - 1 && (
              <button
                type="button"
                onClick={goNext}
                className="absolute right-1 top-1/2 -translate-y-1/2 z-10 size-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
              >
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            )}

            {renderMediaSlide(current, index, true)}

            {items.length > 1 && (
              <p className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-white/50 pointer-events-none">
                {t('community.swipePhotos')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
