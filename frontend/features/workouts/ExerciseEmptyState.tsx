import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import {
  applyExerciseEmptyHintAction,
  buildExerciseEmptyStateHints,
} from './exerciseEmptyStateHints';
import { EMPTY_EXERCISE_FILTERS, type ExerciseLibraryFilters } from './exerciseLibraryFilters';

type Props = {
  filters: ExerciseLibraryFilters;
  searchActive: boolean;
  onChangeFilters: (next: ExerciseLibraryFilters) => void;
  onClearSearch?: () => void;
};

export function ExerciseEmptyState({
  filters,
  searchActive,
  onChangeFilters,
  onClearSearch,
}: Props) {
  const { t } = useI18n();
  const hints = buildExerciseEmptyStateHints(filters, searchActive);

  return (
    <div className="glass-panel rounded-2xl sm:rounded-3xl border border-dashed border-subtle px-5 py-8 sm:px-8 sm:py-10 text-center">
      <span className="material-symbols-outlined mb-3 text-4xl text-muted">fitness_center</span>
      <h3 className="text-base sm:text-lg font-black text-foreground">
        {searchActive ? t('exercises.emptySearchTitle') : t('exercises.emptyFilterTitle')}
      </h3>
      <p className="mt-2 text-sm text-muted leading-relaxed max-w-md mx-auto">
        {searchActive ? t('exercises.emptySearchBody') : t('exercises.emptyFilterBody')}
      </p>

      {hints.length > 0 ? (
        <ul className="mt-5 space-y-2 text-sm text-foreground/90 max-w-lg mx-auto text-start">
          {hints.map((hint) => (
            <li key={hint.key} className="flex items-start gap-2">
              <span className="material-symbols-outlined text-primary text-base mt-0.5 shrink-0">
                lightbulb
              </span>
              {hint.action ? (
                <button
                  type="button"
                  onClick={() => onChangeFilters(applyExerciseEmptyHintAction(filters, hint.action))}
                  className="text-start font-medium hover:text-primary transition-colors"
                >
                  {t(hint.key)}
                </button>
              ) : (
                <span>{t(hint.key)}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            onChangeFilters(EMPTY_EXERCISE_FILTERS);
            onClearSearch?.();
          }}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white"
        >
          {t('exercises.clearFilters')}
        </button>
        {searchActive ? (
          <button
            type="button"
            onClick={() => onClearSearch?.()}
            className="rounded-xl border border-subtle px-5 py-2.5 text-sm font-bold text-muted hover:text-foreground hover:bg-elevated"
          >
            {t('exercises.clearSearch')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
