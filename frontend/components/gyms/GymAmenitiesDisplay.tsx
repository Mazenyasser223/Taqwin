import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import {
  GYM_AMENITY_CATALOG,
  parseGymAmenities,
} from '../../lib/gymAmenities';

export interface GymAmenitiesDisplayProps {
  amenities: unknown;
}

export const GymAmenitiesDisplay: React.FC<GymAmenitiesDisplayProps> = ({ amenities }) => {
  const { t } = useI18n();
  const selected = new Set(parseGymAmenities(amenities));
  const items = GYM_AMENITY_CATALOG.filter((entry) => selected.has(entry.id));

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map(({ id, icon, labelKey }) => (
        <div
          key={id}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/[0.06] px-3 py-5 text-center min-h-[108px] shadow-[0_0_0_1px_rgba(21,139,141,0.2)]"
        >
          <span className="text-3xl leading-none select-none" aria-hidden>
            {icon}
          </span>
          <span className="text-sm sm:text-base font-bold leading-snug text-foreground">{t(labelKey)}</span>
        </div>
      ))}
    </div>
  );
};
