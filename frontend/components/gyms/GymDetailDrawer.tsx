import React from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { weightedTransition } from '../../lib/motion';
import type { Gym } from '../../types';
import { useI18n } from '../../lib/i18n/useI18n';
import { resolveGymCoordinates } from '../../lib/gymGeo';
import { parseGymAmenities } from '../../lib/gymAmenities';
import { GymMediaGallery } from './GymMediaGallery';
import { GymAmenitiesDisplay } from './GymAmenitiesDisplay';
import { GymWorkingHoursDisplay } from './GymWorkingHoursDisplay';
import { GymMemberReviewsSection } from './GymMemberReviewsSection';
import { GymDetailOfferings } from './GymDetailOfferings';

export interface GymDetailDrawerProps {
  gym: Gym | null;
  onClose: () => void;
}

export const GymDetailDrawer: React.FC<GymDetailDrawerProps> = ({ gym, onClose }) => {
  const { t } = useI18n();

  const openDirections = () => {
    if (!gym) return;
    const coords = resolveGymCoordinates(gym);
    const url = coords
      ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gym.location)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      {gym && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[130]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={weightedTransition}
            className="fixed right-0 top-0 h-full w-full max-w-2xl glass-panel z-[140] p-8 sm:p-12 flex flex-col shadow-2xl border-l border-subtle"
          >
            <button
              onClick={onClose}
              className="absolute top-10 right-10 size-12 flex items-center justify-center rounded-2xl bg-elevated hover:bg-elevated-hover"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="flex-1 overflow-y-auto custom-scrollbar pt-10 text-lg">
              <GymMediaGallery gym={gym} className="mb-8" />
              <div className="space-y-8">
                <div>
                  <span className="text-primary font-black uppercase tracking-[0.4em] text-base">
                    {t('gyms.gymDetails')}
                  </span>
                  <h2 className="text-5xl font-black tracking-tighter mt-2">{gym.name}</h2>
                  <p className="text-faint font-bold mt-4 flex items-center gap-2 text-lg sm:text-xl">
                    <span className="material-symbols-outlined text-xl">location_on</span>
                    {gym.location}
                  </p>
                  {gym.phone && <p className="text-muted mt-2 text-lg">{gym.phone}</p>}
                  <button
                    type="button"
                    onClick={openDirections}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-subtle bg-elevated px-4 py-2.5 text-base font-bold text-primary hover:border-primary/40"
                  >
                    <span className="material-symbols-outlined text-lg">directions</span>
                    {t('gyms.openDirections')}
                  </button>
                </div>
                {gym.bio && (
                  <div className="space-y-3">
                    <h4 className="text-base font-black uppercase tracking-widest text-primary">
                      {t('gyms.about')}
                    </h4>
                    <p className="text-muted italic leading-relaxed text-lg sm:text-xl">&ldquo;{gym.bio}&rdquo;</p>
                  </div>
                )}
                {parseGymAmenities(gym.amenities).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-base font-black uppercase tracking-widest text-primary">
                      {t('gyms.amenities')}
                    </h4>
                    <GymAmenitiesDisplay amenities={gym.amenities} />
                  </div>
                )}
                {(gym.workingHours ?? []).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-base font-black uppercase tracking-widest text-primary">
                      {t('gyms.workingHours')}
                    </h4>
                    <GymWorkingHoursDisplay workingHours={gym.workingHours} />
                  </div>
                )}
                <GymDetailOfferings gymId={gym.id} />
                <GymMemberReviewsSection gymId={gym.id} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
