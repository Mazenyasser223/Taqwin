import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';

export type ExerciseLibraryView = 'browse' | 'saved';

type Props = {
  view: ExerciseLibraryView;
  onChange: (view: ExerciseLibraryView) => void;
  savedCount: number;
};

export function ExerciseLibraryViewTabs({ view, onChange, savedCount }: Props) {
  const { t } = useI18n();

  const tabs: { id: ExerciseLibraryView; label: string; icon: string; count?: number }[] = [
    { id: 'browse', label: t('exercises.view.browse'), icon: 'fitness_center' },
    { id: 'saved', label: t('exercises.view.saved'), icon: 'favorite', count: savedCount },
  ];

  return (
    <div
      className="flex shrink-0 rounded-2xl border border-subtle bg-surface p-1 shadow-sm w-full xl:w-auto"
      role="tablist"
      aria-label={t('exercises.view.label')}
    >
      {tabs.map((tab) => {
        const selected = view === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`flex flex-1 xl:flex-none items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 sm:px-5 sm:py-3 text-sm font-bold transition-colors min-h-[2.75rem] ${
              selected
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-foreground hover:bg-elevated/80'
            }`}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={tab.id === 'saved' && selected ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {tab.icon}
            </span>
            <span>{tab.label}</span>
            {tab.count != null && tab.count > 0 ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums ${
                  selected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                }`}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
