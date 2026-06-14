import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Gym } from '../../types';
import { gymPhotoUrls } from '../../lib/gymPhotos';
import { useHorizontalSwipe } from '../../features/community/useHorizontalSwipe';
import { useI18n } from '../../lib/i18n/useI18n';

export interface GymPhotoCarouselProps {
  gym: Pick<Gym, 'id' | 'name' | 'imageUrl' | 'galleryUrls'>;
  className?: string;
}

export const GymPhotoCarousel: React.FC<GymPhotoCarouselProps> = ({ gym, className = '' }) => {
  const { t } = useI18n();
  const photos = useMemo(() => gymPhotoUrls(gym), [gym.id, gym.imageUrl, gym.galleryUrls]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [gym.id, photos.length]);

  const hasMany = photos.length > 1;
  const goPrev = () => setIndex((i) => (i <= 0 ? photos.length - 1 : i - 1));
  const goNext = () => setIndex((i) => (i >= photos.length - 1 ? 0 : i + 1));
  const swipe = useHorizontalSwipe(goNext, goPrev, hasMany);

  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-[2.5rem] border border-subtle bg-black/20 ${className}`.trim()}
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
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60"
          >
            <span className="material-symbols-outlined text-xl">chevron_left</span>
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label={t('gyms.photoNext')}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60"
          >
            <span className="material-symbols-outlined text-xl">chevron_right</span>
          </button>
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur-sm">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={t('gyms.photoGoTo', { n: String(i + 1) })}
                onClick={() => setIndex(i)}
                className={`rounded-full transition-all ${
                  i === index ? 'size-2 bg-white' : 'size-1.5 bg-white/45 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
          <span className="absolute top-3 right-3 z-10 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            {t('gyms.photoCount', { current: String(index + 1), total: String(photos.length) })}
          </span>
        </>
      )}
    </div>
  );
};
