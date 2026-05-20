import React from 'react';
import type { TranslationKey } from '../../lib/i18n/translations';
import { useI18n } from '../../lib/i18n/useI18n';
import type { MacroAmountBounds, MacroKey, MacroSortDirection } from './nutritionFilters';
import { NUTRITION_MACRO_COLORS, NUTRITION_MACRO_DOT_CLASS } from './nutritionMacroTheme';
import { NutritionMacroSortToggle } from './NutritionMacroSortToggle';

const inputClass =
  'w-11 h-8 rounded-lg border border-subtle bg-background text-foreground text-xs font-bold tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-accent/40 [color-scheme:dark]';

type AmountFieldProps = {
  value: number | '';
  step: number;
  macroColor: string;
  highlighted: boolean;
  label: string;
  ariaLabel: string;
  onChange: (raw: string) => void;
};

const AmountField: React.FC<AmountFieldProps> = ({
  value,
  step,
  macroColor,
  highlighted,
  label,
  ariaLabel,
  onChange,
}) => (
  <div className="flex flex-col items-center gap-0.5 shrink-0">
    <span className="text-[9px] font-black uppercase tracking-widest text-faint leading-none">
      {label}
    </span>
    <input
      type="number"
      min={0}
      step={step}
      inputMode="decimal"
      placeholder="0"
      value={value === '' ? '' : value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
      className={inputClass}
      style={highlighted ? { borderColor: `${macroColor}66` } : undefined}
    />
  </div>
);

type Props = {
  macroKey: MacroKey;
  label: TranslationKey;
  direction: MacroSortDirection;
  amounts: MacroAmountBounds;
  onDirectionChange: (dir: MacroSortDirection) => void;
  onAmountChange: (side: 'min' | 'max', raw: string) => void;
};

export const NutritionMacroFilterRow: React.FC<Props> = ({
  macroKey,
  label,
  direction,
  amounts,
  onDirectionChange,
  onAmountChange,
}) => {
  const { t } = useI18n();
  const macroColor = NUTRITION_MACRO_COLORS[macroKey];
  const isActive = direction !== 'off' || amounts.min !== '' || amounts.max !== '';
  const step = macroKey === 'calories' ? 1 : 0.1;
  const name = t(label);

  return (
    <div
      className={`px-2.5 py-2.5 rounded-xl transition-colors space-y-2 ${
        isActive ? 'bg-elevated' : 'hover:bg-elevated/80'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`size-2 rounded-full shrink-0 ${NUTRITION_MACRO_DOT_CLASS[macroKey]}`} aria-hidden />
        <span className="text-sm font-bold text-foreground">{name}</span>
      </div>

      <div className="flex items-end justify-end gap-1.5 flex-wrap">
        <NutritionMacroSortToggle
          direction={direction}
          onDirectionChange={onDirectionChange}
          active={direction !== 'off'}
          macroKey={macroKey}
        />
        <AmountField
          value={amounts.min}
          step={step}
          macroColor={macroColor}
          highlighted={amounts.min !== '' || direction === 'high'}
          label={t('nutrition.filterMinShort')}
          ariaLabel={`${name} ${t('nutrition.filterAmountMin')}`}
          onChange={(raw) => onAmountChange('min', raw)}
        />
        <AmountField
          value={amounts.max}
          step={step}
          macroColor={macroColor}
          highlighted={amounts.max !== '' || direction === 'low'}
          label={t('nutrition.filterMaxShort')}
          ariaLabel={`${name} ${t('nutrition.filterAmountMax')}`}
          onChange={(raw) => onAmountChange('max', raw)}
        />
      </div>
    </div>
  );
};
