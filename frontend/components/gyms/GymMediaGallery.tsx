import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Gym } from '../../types';
import { gymPhotoUrls } from '../../lib/gymPhotos';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { useHorizontalSwipe } from '../../features/community/useHorizontalSwipe';
import { useI18n } from '../../lib/i18n/useI18n';

export interface GymMediaGalleryProps {
  gym: Pick<Gym, 'id' | 'name' | 'imageUrl' | 'galleryUrls' | 'videoUrl'>;
  className?: string;
}

export const GymMediaGallery: React.FC<GymMediaGalleryProps> = ({ gym, className = '' }) => {
  const { t } = useI18n();
  const photos = useMemo(() => gymPhotoUrls(gym), [gym.id, gym.imageUrl, gym.galleryUrls]);
  const videoSrc = gym.videoUrl?.trim() ? resolveMediaUrl(gym.videoUrl.trim()) : null;
  const [index, setIndex] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);

  useEffect(() => {
    setIndex(0);
    setVideoPlaying(false);
  }, [gym.id, photos.length]);

  const hasMany = photos.length > 1;
  const goPrev = () => setIndex((i) => (i <= 0 ? photos.length - 1 : i - 1));
  const goNext = () => setIndex((i) => (i >= photos.length - 1 ? 0 : i + 1));
  const swipe = useHorizontalSwipe(goNext, goPrev, hasMany);

  const poster = photos[index] ?? photos[0];

  return (
    <div className={`space-y-0 ${className}`.trim()}>
      <div
        className={`grid gap-3 ${videoSrc ? 'grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,38%)]' : 'grid-cols-1'}`}
      >
        {/* Main photo + thumbnails */}
        <div className="flex min-w-0 flex-col gap-3">
          <div
            className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-subtle bg-black/30 sm:rounded-3xl"
            {...swipe}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.img
                key={photos[index]}
                src={photos[index]}
                alt={gym.name}
                className="size-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                draggable={false}
              />
            </AnimatePresence>

            {hasMany && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label={t('gyms.photoPrev')}
                  className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 sm:flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60"
                >
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label={t('gyms.photoNext')}
                  className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 sm:flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60"
                >
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
                <span className="absolute bottom-3 right-3 z-10 rounded-lg bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                  {t('gyms.photoCount', { current: String(index + 1), total: String(photos.length) })}
                </span>
              </>
            )}
          </div>

          {hasMany && (
            <div className="flex gap-2 overflow-x-auto pb-0.5 custom-scrollbar">
              {photos.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  aria-label={t('gyms.photoGoTo', { n: String(i + 1) })}
                  onClick={() => setIndex(i)}
                  className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                    i === index
                      ? 'border-brand-500 ring-2 ring-brand-500/30'
                      : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt="" className="size-full object-cover" draggable={false} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Video panel */}
        {videoSrc && (
          <div className="relative min-h-[10rem] w-full overflow-hidden rounded-2xl border border-subtle bg-black/40 sm:min-h-0 sm:h-full sm:rounded-3xl">
            {videoPlaying ? (
              <video
                src={videoSrc}
                controls
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
                poster={poster}
              />
            ) : (
              <button
                type="button"
                onClick={() => setVideoPlaying(true)}
                className="group absolute inset-0 block h-full w-full"
                aria-label={t('gyms.playIntroTour')}
              >
                <img src={poster} alt="" className="size-full object-cover opacity-90" draggable={false} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/20" />
                <span className="absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-lg bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                  <span className="material-symbols-outlined text-sm">videocam</span>
                  {t('gyms.introTour')}
                </span>
                <span className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg transition-transform group-hover:scale-105">
                  <span className="material-symbols-outlined text-3xl ms-0.5">play_arrow</span>
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
