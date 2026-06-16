import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import {
  EXTENDED_EQUIPMENT_FILTER_CATEGORIES,
  formatCategoryLabel,
  PRIMARY_EQUIPMENT_FILTER_CATEGORIES,
} from './exerciseCategories';
import {
  EXERCISE_MUSCLE_BROWSE_ZONES,
  exerciseMuscleBrowseKey,
  type ExerciseMuscleBrowseZone,
} from './exerciseMuscleBrowse';
import {
  EXERCISE_FITNESS_GOALS,
  formatFitnessGoalLabel,
} from './exerciseFitnessGoals';
import { localizeDifficultyLabel } from './exerciseLocale';
import type { ExerciseLibraryFilters } from './exerciseLibraryFilters';
import { WORKOUT_FILTER_BAR } from './workoutLayout';

type Props = {
  filters: ExerciseLibraryFilters;
  onChange: (next: ExerciseLibraryFilters) => void;
  difficulties: { difficulty: string; count: number }[];
  muscleCounts: Record<string, number> | null;
  categoryCounts: Record<string, number> | null;
  goalCounts: Record<string, number> | null;
  lockMuscle?: boolean;
  hideCounts?: boolean;
  className?: string;
};

type DropdownProps = {
  label: string;
  value: string;
  options: { value: string; label: string; count?: number }[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

type FilterMultiSelectProps = {
  label: string;
  selected: string[];
  options: { value: string; label: string; count?: number }[];
  extendedOptions?: { value: string; label: string; count?: number }[];
  onChange: (values: string[]) => void;
};

function FilterDropdown({ label, value, options, onChange, disabled }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex-1 min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-3.5 text-start transition-colors hover:bg-elevated/80 disabled:opacity-50 disabled:cursor-not-allowed min-h-[3.75rem]"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0">
          <span className="block text-[10px] sm:text-[11px] font-black uppercase tracking-[0.14em] text-muted leading-none mb-1">
            {label}
          </span>
          <span className="block text-sm font-bold text-foreground truncate">{selected?.label}</span>
        </span>
        <span
          className={`material-symbols-outlined text-muted text-xl shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-subtle bg-surface shadow-xl py-1 custom-scrollbar"
        >
          {options.map((opt) => (
            <li key={opt.value || '__all'} role="option" aria-selected={opt.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-start text-sm font-semibold transition-colors hover:bg-elevated ${
                  opt.value === value ? 'text-primary bg-primary/5' : 'text-foreground'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.count != null ? (
                  <span className="text-xs font-bold text-muted tabular-nums shrink-0">{opt.count}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FilterMultiSelect({
  label,
  selected,
  options,
  extendedOptions = [],
  onChange,
}: FilterMultiSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const summary =
    selected.length === 0
      ? t('exercises.filter.all')
      : selected.length === 1
        ? options.concat(extendedOptions).find((o) => o.value === selected[0])?.label ?? selected[0]
        : t('exercises.filter.selectedCount', { count: String(selected.length) });

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const renderOption = (opt: { value: string; label: string; count?: number }) => {
    const checked = selected.includes(opt.value);
    return (
      <li key={opt.value}>
        <button
          type="button"
          onClick={() => toggle(opt.value)}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm font-semibold text-foreground transition-colors hover:bg-elevated"
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
              checked ? 'border-primary bg-primary text-white' : 'border-subtle bg-surface'
            }`}
            aria-hidden
          >
            {checked ? (
              <span className="material-symbols-outlined text-[16px] leading-none">check</span>
            ) : null}
          </span>
          <span className="min-w-0 flex-1 truncate">{opt.label}</span>
          {opt.count != null ? (
            <span className="text-xs font-bold text-muted tabular-nums shrink-0">{opt.count}</span>
          ) : null}
        </button>
      </li>
    );
  };

  return (
    <div ref={rootRef} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-3.5 text-start transition-colors hover:bg-elevated/80 min-h-[3.75rem]"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0">
          <span className="block text-[10px] sm:text-[11px] font-black uppercase tracking-[0.14em] text-muted leading-none mb-1">
            {label}
          </span>
          <span className="block text-sm font-bold text-foreground truncate">{summary}</span>
        </span>
        <span
          className={`material-symbols-outlined text-muted text-xl shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-subtle bg-surface shadow-xl py-2 custom-scrollbar">
          {selected.length ? (
            <div className="px-4 pb-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs font-black uppercase tracking-widest text-primary hover:underline"
              >
                {t('exercises.clearFilters')}
              </button>
            </div>
          ) : null}
          <ul role="listbox" aria-multiselectable="true">
            {options.map(renderOption)}
          </ul>
          {extendedOptions.length ? (
            <>
              <div className="my-2 border-t border-subtle" />
              <ul role="listbox" aria-multiselectable="true">
                {extendedOptions.map(renderOption)}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const ExerciseFilterBar: React.FC<Props> = ({
  filters,
  onChange,
  difficulties,
  muscleCounts,
  categoryCounts,
  goalCounts,
  lockMuscle = false,
  hideCounts = false,
  className = '',
}) => {
  const { t, language } = useI18n();

  const primaryCategoryOptions = PRIMARY_EQUIPMENT_FILTER_CATEGORIES.map((cat) => ({
    value: cat,
    label: formatCategoryLabel(cat, t),
    count: hideCounts ? undefined : categoryCounts?.[cat],
  }));

  const extendedCategoryOptions = EXTENDED_EQUIPMENT_FILTER_CATEGORIES.filter(
    (cat) => hideCounts || (categoryCounts?.[cat] ?? 0) > 0,
  ).map((cat) => ({
    value: cat,
    label: formatCategoryLabel(cat, t),
    count: hideCounts ? undefined : categoryCounts?.[cat],
  }));

  const difficultyOptions = [
    { value: '', label: t('exercises.filter.all') },
    ...difficulties.map((d) => ({
      value: d.difficulty,
      label: localizeDifficultyLabel(d.difficulty, language),
      count: hideCounts ? undefined : d.count,
    })),
  ];

  const muscleOptions = [
    { value: '', label: t('exercises.filter.all') },
    ...EXERCISE_MUSCLE_BROWSE_ZONES.map((zone) => ({
      value: zone,
      label: t(exerciseMuscleBrowseKey(zone as ExerciseMuscleBrowseZone)),
      count: hideCounts ? undefined : muscleCounts?.[zone],
    })),
  ];

  const goalOptions = EXERCISE_FITNESS_GOALS.map((goal) => ({
    value: goal,
    label: formatFitnessGoalLabel(goal, t),
    count: hideCounts ? undefined : goalCounts?.[goal],
  }));

  const patch = (partial: Partial<ExerciseLibraryFilters>) => onChange({ ...filters, ...partial });

  return (
    <div className={`${WORKOUT_FILTER_BAR} shadow-sm ${className}`}>
      <FilterMultiSelect
        label={t('exercises.filter.category')}
        selected={filters.categories}
        options={primaryCategoryOptions}
        extendedOptions={extendedCategoryOptions}
        onChange={(categories) => patch({ categories })}
      />
      <FilterDropdown
        label={t('exercises.filter.difficulty')}
        value={filters.difficulty ?? ''}
        options={difficultyOptions}
        onChange={(v) => patch({ difficulty: v || null })}
      />
      <FilterDropdown
        label={t('exercises.filter.muscles')}
        value={filters.muscle ?? ''}
        options={muscleOptions}
        onChange={(v) => patch({ muscle: v || null })}
        disabled={lockMuscle}
      />
      <FilterMultiSelect
        label={t('exercises.filter.goals')}
        selected={filters.goals}
        options={goalOptions}
        onChange={(goals) => patch({ goals })}
      />
    </div>
  );
};
