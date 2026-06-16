import React, { useId, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { MarketplaceSearchSuggestion } from './marketplaceSearchSuggestions';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onSuggestionSelect: (suggestion: MarketplaceSearchSuggestion) => void;
  onClear: () => void;
  suggestions: MarketplaceSearchSuggestion[];
  suggestionsLoading?: boolean;
  loading?: boolean;
};

export const MarketplaceSearchBar: React.FC<Props> = ({
  value,
  onChange,
  onSubmit,
  onSuggestionSelect,
  onClear,
  suggestions,
  suggestionsLoading = false,
  loading = false,
}) => {
  const { t } = useI18n();
  const inputId = useId();
  const listId = `${inputId}-suggestions`;
  const [focused, setFocused] = useState(false);

  const showSuggestions = focused && !value.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    onSubmit(q);
    setFocused(false);
  };

  return (
    <div className="relative min-w-0">
      <form onSubmit={handleSubmit} className="relative">
        <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted">
          <span className="material-symbols-outlined text-[22px]">search</span>
        </span>
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 120);
          }}
          placeholder={t('shop.searchPlaceholder')}
          autoComplete="off"
          aria-label={t('shop.searchPlaceholder')}
          aria-controls={showSuggestions ? listId : undefined}
          aria-expanded={showSuggestions}
          className="w-full min-h-12 rounded-2xl border border-subtle bg-elevated/80 py-3 ps-11 pe-11 text-sm font-semibold text-foreground placeholder:font-medium placeholder:text-faint outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
        />
        {loading ? (
          <span className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2">
            <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </span>
        ) : value ? (
          <button
            type="button"
            onClick={onClear}
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted transition hover:bg-elevated hover:text-foreground"
            aria-label={t('shop.clearSearch')}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        ) : null}
      </form>

      {showSuggestions ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-subtle bg-surface shadow-xl"
        >
          <p className="border-b border-subtle px-4 py-2 text-[10px] font-black uppercase tracking-widest text-faint">
            {t('shop.searchSuggestions')}
          </p>
          {suggestionsLoading ? (
            <p className="px-4 py-3 text-sm text-muted animate-pulse">{t('shop.loading')}</p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">{t('shop.searchSuggestionsEmpty')}</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto custom-scrollbar py-1">
              {suggestions.map((suggestion) => (
                <li key={suggestion.query}>
                  <button
                    type="button"
                    role="option"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-sm font-semibold text-foreground transition hover:bg-primary/10"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSuggestionSelect(suggestion);
                      setFocused(false);
                    }}
                  >
                    <span className="material-symbols-outlined text-base text-primary">search</span>
                    {suggestion.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};
