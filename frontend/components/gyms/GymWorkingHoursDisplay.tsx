import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { WorkingHourSlot } from '../../types';

export interface GymWorkingHoursDisplayProps {
  workingHours?: WorkingHourSlot[];
}

export const GymWorkingHoursDisplay: React.FC<GymWorkingHoursDisplayProps> = ({ workingHours }) => {
  const { t } = useI18n();
  const slots = [...(workingHours ?? [])].sort((a, b) => a.day - b.day);

  if (slots.length === 0) return null;

  return (
    <div className="space-y-2">
      {slots.map((slot) => (
        <div
          key={slot.day}
          className="flex items-center justify-between gap-3 rounded-2xl border border-subtle bg-elevated/30 px-4 py-3.5 text-base sm:text-lg"
        >
          <span className="font-bold text-foreground">
            {t(`gymStaff.days.${slot.day}` as 'gymStaff.days.0')}
          </span>
          <span className="font-black text-primary tabular-nums shrink-0">
            {slot.start} – {slot.end}
          </span>
        </div>
      ))}
    </div>
  );
};
