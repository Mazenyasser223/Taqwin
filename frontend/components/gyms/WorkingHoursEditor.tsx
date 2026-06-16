import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { WorkingHourSlot } from '../../types';

export type DaySchedule = {
  enabled: boolean;
  start: string;
  end: string;
};

export function emptyDaySchedules(): DaySchedule[] {
  return Array.from({ length: 7 }, () => ({ enabled: false, start: '09:00', end: '22:00' }));
}

export function slotsFromDays(days: DaySchedule[]): WorkingHourSlot[] {
  return days
    .map((d, day) => (d.enabled ? { day, start: d.start, end: d.end } : null))
    .filter((s): s is WorkingHourSlot => s !== null);
}

export function daysFromSlots(slots: WorkingHourSlot[]): DaySchedule[] {
  const days = emptyDaySchedules();
  for (const slot of slots) {
    if (slot.day >= 0 && slot.day <= 6) {
      days[slot.day] = { enabled: true, start: slot.start, end: slot.end };
    }
  }
  return days;
}

export function applyWeekdayPreset(days: DaySchedule[]): DaySchedule[] {
  return days.map((d, idx) =>
    idx >= 1 && idx <= 5 ? { enabled: true, start: '09:00', end: '22:00' } : { ...d, enabled: false },
  );
}

export function apply24_7Preset(): DaySchedule[] {
  return Array.from({ length: 7 }, () => ({ enabled: true, start: '00:00', end: '23:59' }));
}

interface Props {
  days: DaySchedule[];
  onChange: (days: DaySchedule[]) => void;
  inputClass: string;
}

export const WorkingHoursEditor: React.FC<Props> = ({ days, onChange, inputClass }) => {
  const { t } = useI18n();
  const enabledCount = days.filter((d) => d.enabled).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-faint">
          {t('profile.gymHours')} · {enabledCount}/7
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange(applyWeekdayPreset(days))}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25"
          >
            {t('gymStaff.schedulePresetWeekdays')}
          </button>
          <button
            type="button"
            onClick={() => onChange(apply24_7Preset())}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25"
          >
            {t('gymStaff.schedulePreset24_7')}
          </button>
          <button
            type="button"
            onClick={() => onChange(emptyDaySchedules())}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-elevated hover:bg-elevated-hover"
          >
            {t('gymStaff.schedulePresetClear')}
          </button>
        </div>
      </div>
      <div className="space-y-2 rounded-2xl border border-subtle p-3 bg-elevated/30">
        {days.map((day, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 text-sm flex-wrap rounded-xl px-2 py-1.5 ${day.enabled ? 'bg-primary/5' : ''}`}
          >
            <label className="flex items-center gap-2 min-w-[110px] cursor-pointer">
              <input
                type="checkbox"
                checked={day.enabled}
                onChange={(e) => {
                  const next = [...days];
                  next[idx] = { ...next[idx], enabled: e.target.checked };
                  onChange(next);
                }}
                className="rounded accent-primary"
              />
              <span className="text-xs font-medium">{t(`gymStaff.days.${idx}` as 'gymStaff.days.0')}</span>
            </label>
            <input
              type="time"
              value={day.start}
              disabled={!day.enabled}
              onChange={(e) => {
                const next = [...days];
                next[idx] = { ...next[idx], start: e.target.value };
                onChange(next);
              }}
              className="rounded-lg bg-elevated border border-subtle px-2 py-1 text-xs disabled:opacity-40"
            />
            <span className="text-muted">–</span>
            <input
              type="time"
              value={day.end}
              disabled={!day.enabled}
              onChange={(e) => {
                const next = [...days];
                next[idx] = { ...next[idx], end: e.target.value };
                onChange(next);
              }}
              className="rounded-lg bg-elevated border border-subtle px-2 py-1 text-xs disabled:opacity-40"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
