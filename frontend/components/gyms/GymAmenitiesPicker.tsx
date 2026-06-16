import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import {
  GYM_AMENITY_CATALOG,
  type GymAmenityId,
} from '../../lib/gymAmenities';

export interface GymAmenitiesPickerProps {
  value: GymAmenityId[];
  onChange: (next: GymAmenityId[]) => void;
}

export const GymAmenitiesPicker: React.FC<GymAmenitiesPickerProps> = ({ value, onChange }) => {
  const { t } = useI18n();
  const selected = new Set(value);

  const toggle = (id: GymAmenityId) => {
    if (selected.has(id)) {
      onChange(value.filter((x) => x !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-faint">
          {t('profile.gymAmenitiesTitle')}
        </p>
        <p className="text-xs text-muted mt-1">{t('profile.gymAmenitiesHint')}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {GYM_AMENITY_CATALOG.map(({ id, icon, labelKey }) => {
          const active = selected.has(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              aria-pressed={active}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-5 text-center transition-all min-h-[108px] ${
                active
                  ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(21,139,141,0.35)]'
                  : 'border-subtle bg-elevated/50 hover:border-primary/30 hover:bg-elevated'
              }`}
            >
              <span className="text-3xl leading-none select-none" aria-hidden>
                {icon}
              </span>
              <span className={`text-xs font-bold leading-snug ${active ? 'text-primary' : 'text-muted'}`}>
                {t(labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
