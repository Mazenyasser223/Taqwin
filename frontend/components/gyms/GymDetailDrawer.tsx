import React from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { buttonPress, weightedTransition } from '../../lib/motion';
import { Magnetic } from '../../components/shared/MotionWrappers';
import type { Gym } from '../../types';
import { useI18n } from '../../lib/i18n/useI18n';
import { resolveGymCoordinates } from '../../lib/gymGeo';
import { parseGymAmenities } from '../../lib/gymAmenities';
import { GymPhotoCarousel } from './GymPhotoCarousel';
import { GymAmenitiesDisplay } from './GymAmenitiesDisplay';
import { GymWorkingHoursDisplay } from './GymWorkingHoursDisplay';

export interface GymDetailDrawerProps {
  gym: Gym | null;
  isMember: boolean;
  onClose: () => void;
  onCheckIn: (gym: Gym) => void;
}

export const GymDetailDrawer: React.FC<GymDetailDrawerProps> = ({
  gym,
  isMember,
  onClose,
  onCheckIn,
}) => {
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
            className="fixed right-0 top-0 h-full w-full max-w-xl glass-panel z-[140] p-12 flex flex-col shadow-2xl border-l border-subtle"
          >
            <button
              onClick={onClose}
              className="absolute top-10 right-10 size-12 flex items-center justify-center rounded-2xl bg-elevated hover:bg-elevated-hover"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="flex-1 overflow-y-auto custom-scrollbar pt-10">
              <GymPhotoCarousel gym={gym} className="mb-10" />
              <div className="space-y-8">
                <div>
                  <span className="text-primary font-black uppercase tracking-[0.4em] text-xs">
                    {t('gyms.gymDetails')}
                  </span>
                  <h2 className="text-5xl font-black tracking-tighter mt-2">{gym.name}</h2>
                  <p className="text-faint font-bold mt-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">location_on</span>
                    {gym.location}
                  </p>
                  {gym.phone && <p className="text-muted mt-2 text-sm">{gym.phone}</p>}
                  <button
                    type="button"
                    onClick={openDirections}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-subtle bg-elevated px-4 py-2 text-xs font-bold text-primary hover:border-primary/40"
                  >
                    <span className="material-symbols-outlined text-sm">directions</span>
                    {t('gyms.openDirections')}
                  </button>
                </div>
                {gym.bio && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">
                      {t('gyms.about')}
                    </h4>
                    <p className="text-muted italic leading-relaxed">&ldquo;{gym.bio}&rdquo;</p>
                  </div>
                )}
                {parseGymAmenities(gym.amenities).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">
                      {t('gyms.amenities')}
                    </h4>
                    <GymAmenitiesDisplay amenities={gym.amenities} />
                  </div>
                )}
                {(gym.workingHours ?? []).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">
                      {t('gyms.workingHours')}
                    </h4>
                    <GymWorkingHoursDisplay workingHours={gym.workingHours} />
                  </div>
                )}
              </div>
            </div>
            <div className="pt-10">
              <Magnetic strength={0.3}>
                <motion.button
                  variants={buttonPress}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={() => {
                    onCheckIn(gym);
                    onClose();
                  }}
                  disabled={!isMember}
                  className="w-full bg-primary text-white font-black py-5 rounded-[2rem] text-lg shadow-2xl flex items-center justify-center gap-4 disabled:opacity-40"
                >
                  {isMember ? t('gyms.checkInNow') : t('gyms.membersOnly')}
                  <span className="material-symbols-outlined font-black">arrow_forward</span>
                </motion.button>
              </Magnetic>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
