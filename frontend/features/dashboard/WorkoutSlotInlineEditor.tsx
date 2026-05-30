import React from 'react';
import { cn } from '../../lib/cn';
import { useI18n } from '../../lib/i18n/useI18n';
import type { WorkoutEditEntry } from './WorkoutExerciseChecklist.types';

export interface WorkoutSlotInlineEditorProps {
  entries: WorkoutEditEntry[];
  busyKey?: string | null;
  resolveName: (entry: WorkoutEditEntry) => string;
  onChangeSets: (key: string, sets: number) => void;
  onChangeReps: (key: string, reps: number) => void;
  onRemove: (key: string) => void;
  onAddFromLibrary: () => void;
}

export const WorkoutSlotInlineEditor: React.FC<WorkoutSlotInlineEditorProps> = ({
  entries,
  busyKey,
  resolveName,
  onChangeSets,
  onChangeReps,
  onRemove,
  onAddFromLibrary,
}) => {
  const { t } = useI18n();

  return (
    <div className="mt-2 space-y-2">
      <ul className="space-y-1.5">
        {entries.map((entry) => {
          const busy = busyKey === entry.key;
          return (
            <li
              key={entry.key}
              className="flex items-center justify-between gap-2 rounded-lg border border-brand-500/20 bg-brand-500/5 px-2 py-1.5 text-xs dark:bg-brand-500/10"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="material-symbols-outlined shrink-0 text-[14px] text-brand-500">fitness_center</span>
                <span className="truncate font-medium text-gray-800 dark:text-white/90">{resolveName(entry)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-1.5 py-0.5 dark:border-gray-700 dark:bg-gray-900">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={entry.sets}
                    disabled={busy}
                    onChange={(e) => onChangeSets(entry.key, Number(e.target.value))}
                    className="w-8 bg-transparent text-center text-[10px] font-semibold tabular-nums text-gray-900 outline-none dark:text-white"
                    aria-label={t('dashboard.editWorkoutSets')}
                  />
                  <span className="text-[10px] text-gray-400">×</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={entry.reps}
                    disabled={busy}
                    onChange={(e) => onChangeReps(entry.key, Number(e.target.value))}
                    className="w-10 bg-transparent text-center text-[10px] font-semibold tabular-nums text-gray-900 outline-none dark:text-white"
                    aria-label={t('dashboard.editWorkoutReps')}
                  />
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onRemove(entry.key)}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full border border-error-500/30 text-error-500 hover:bg-error-500/10 disabled:opacity-50'
                  )}
                  aria-label={t('dashboard.removeExercise')}
                >
                  {busy ? (
                    <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  )}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onAddFromLibrary}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-500/35 bg-brand-500/5 py-2 text-[11px] font-semibold text-brand-600 hover:bg-brand-500/10 dark:text-brand-400"
      >
        <span className="material-symbols-outlined text-base">add</span>
        {t('dashboard.addFromWorkouts')}
      </button>
    </div>
  );
};
