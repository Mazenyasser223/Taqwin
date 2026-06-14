import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { composerToolbarBtn, composerToolbarBtnActive } from './communityFeedStyles';

export const defaultPollOptions = (): string[] => ['', ''];

export function validPollOptions(options: string[]): string[] {
  return options.map((o) => o.trim()).filter(Boolean).slice(0, 4);
}

interface PollComposerProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  options: string[];
  onOptionsChange: (options: string[]) => void;
  disabled?: boolean;
  variant?: 'checkbox' | 'toolbar';
  /** When false, only render the toggle (toolbar/checkbox), not the options panel. */
  showPanel?: boolean;
}

export const PollComposer: React.FC<PollComposerProps> = ({
  enabled,
  onEnabledChange,
  options,
  onOptionsChange,
  disabled = false,
  variant = 'checkbox',
  showPanel = true,
}) => {
  const { t } = useI18n();

  const updateOption = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    onOptionsChange(next);
  };

  const addOption = () => {
    if (options.length >= 4) return;
    onOptionsChange([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    onOptionsChange(options.filter((_, i) => i !== index));
  };

  const toggle = () => onEnabledChange(!enabled);

  return (
    <div className="space-y-2">
      {variant === 'checkbox' ? (
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
          />
          {t('community.addPoll')}
        </label>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={toggle}
          className={enabled ? composerToolbarBtnActive : composerToolbarBtn}
          title={t('community.addPoll')}
          aria-pressed={enabled}
        >
          <span className="material-symbols-outlined text-[1.2rem]">poll</span>
          <span className="hidden sm:inline text-xs font-semibold">{t('community.addPoll')}</span>
        </button>
      )}
      {enabled && showPanel && (
        <div className="space-y-2 rounded-2xl border border-white/[0.08] bg-black/20 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground/80">{t('community.addPoll')}</p>
            {variant === 'toolbar' && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onEnabledChange(false)}
                className="text-[11px] font-bold text-muted hover:text-red-400 transition-colors"
              >
                {t('support.removeImage')}
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted leading-relaxed">{t('community.pollHint')}</p>
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="shrink-0 size-6 rounded-full bg-primary/15 text-primary text-[11px] font-black flex items-center justify-center">
                {i + 1}
              </span>
              <input
                type="text"
                value={opt}
                disabled={disabled}
                maxLength={80}
                placeholder={t('community.pollOptionPlaceholder', { n: String(i + 1) })}
                onChange={(e) => updateOption(i, e.target.value)}
                className="flex-1 min-w-0 rounded-xl border border-white/[0.08] bg-background/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeOption(i)}
                  className="shrink-0 text-muted hover:text-red-400 p-1 rounded-lg hover:bg-white/5 transition-colors"
                  aria-label="Remove"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
            </div>
          ))}
          {options.length < 4 && (
            <button
              type="button"
              disabled={disabled}
              onClick={addOption}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline pt-1"
            >
              <span className="material-symbols-outlined text-base">add</span>
              {t('community.pollAddOption')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
