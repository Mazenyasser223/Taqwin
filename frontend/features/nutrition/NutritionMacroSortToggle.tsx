import React, { useCallback } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { MacroKey, MacroSortDirection } from './nutritionFilters';
import { NUTRITION_MACRO_COLORS } from './nutritionMacroTheme';

export type { MacroSortDirection };

type Props = {
  direction: MacroSortDirection;
  onDirectionChange: (next: MacroSortDirection) => void;
  active?: boolean;
  macroKey: MacroKey;
};

export const NutritionMacroSortToggle: React.FC<Props> = ({
  direction,
  onDirectionChange,
  active = false,
  macroKey,
}) => {
  const { t, isRtl } = useI18n();
  const macroColor = NUTRITION_MACRO_COLORS[macroKey];

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const pos = isRtl ? 1 - ratio : ratio;

      if (pos < 0.38) {
        onDirectionChange(direction === 'low' ? 'off' : 'low');
      } else if (pos > 0.62) {
        onDirectionChange(direction === 'high' ? 'off' : 'high');
      } else {
        onDirectionChange('off');
      }
    },
    [direction, isRtl, onDirectionChange]
  );

  const thumbPosition =
    direction === 'off'
      ? 'start-1/2 -translate-x-1/2'
      : direction === 'low'
        ? 'start-0.5'
        : 'end-0.5';

  const lowLabelClass =
    direction === 'low'
      ? 'text-foreground font-black'
      : 'text-muted font-bold';
  const highLabelClass =
    direction === 'high'
      ? 'text-foreground font-black'
      : 'text-muted font-bold';

  return (
    <div
      role="group"
      aria-label={t('nutrition.sortToggleAria')}
      className={`relative shrink-0 w-[6.75rem] h-9 rounded-full border p-0.5 transition-colors ${
        active ? 'border-subtle bg-background' : 'border-subtle bg-background/90'
      }`}
      style={active ? { borderColor: `${macroColor}66`, backgroundColor: '#0a1218' } : undefined}
      onClick={handleTrackClick}
    >
      <span
        className={`absolute inset-y-0 start-1.5 flex items-center text-[10px] uppercase tracking-wide pointer-events-none z-[1] transition-colors ${lowLabelClass}`}
        style={direction === 'low' ? { color: macroColor } : undefined}
      >
        {t('nutrition.sortLow')}
      </span>
      <span
        className={`absolute inset-y-0 end-1.5 flex items-center text-[10px] uppercase tracking-wide pointer-events-none z-[1] transition-colors ${highLabelClass}`}
        style={direction === 'high' ? { color: macroColor } : undefined}
      >
        {t('nutrition.sortHigh')}
      </span>

      <span
        aria-hidden
        className={`absolute top-1/2 -translate-y-1/2 size-7 rounded-full shadow-md transition-all duration-200 ease-out z-[2] ${thumbPosition} ${
          direction === 'off' ? 'bg-faint/50' : ''
        }`}
        style={
          direction === 'off'
            ? undefined
            : {
                backgroundColor: macroColor,
                boxShadow: `0 4px 14px ${macroColor}66`,
              }
        }
      />
    </div>
  );
};
