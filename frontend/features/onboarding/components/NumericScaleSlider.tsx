import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';
import { stopStepSwipe } from './stepSwipe';

const MIN = 1;
const MAX = 10;

function clampScale(n: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(n)));
}

function descriptorKey(stepId: string, value: number): string {
  const tier = value <= 3 ? 'low' : value <= 7 ? 'mid' : 'high';
  return `onboarding.scale.${stepId}.${tier}`;
}

function endpointKeys(stepId: string): { min: string; max: string } {
  return {
    min: `onboarding.scale.${stepId}.min`,
    max: `onboarding.scale.${stepId}.max`,
  };
}

export interface NumericScaleSliderProps {
  stepId: string;
  value: number;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  disabled?: boolean;
}

export const NumericScaleSlider: React.FC<NumericScaleSliderProps> = ({
  stepId,
  value,
  onChange,
  onCommit,
  disabled = false,
}) => {
  const { t } = useI18n();
  const safe = clampScale(value);
  const fillPct = ((safe - MIN) / (MAX - MIN)) * 100;

  const descriptor = useMemo(() => {
    const key = descriptorKey(stepId, safe) as Parameters<typeof t>[0];
    const text = t(key);
    return text === key ? null : text;
  }, [stepId, safe, t]);

  const endpoints = endpointKeys(stepId);
  const minLabel = t(endpoints.min as Parameters<typeof t>[0]);
  const maxLabel = t(endpoints.max as Parameters<typeof t>[0]);

  const icon =
    stepId === 'stressLevel'
      ? 'psychology'
      : stepId === 'energyLevel'
        ? 'bolt'
        : stepId === 'hungerScale'
          ? 'restaurant'
          : 'tune';

  const setValue = (n: number, commit = false) => {
    if (disabled) return;
    const v = String(clampScale(n));
    onChange(v);
    if (commit) onCommit(v);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5 shrink-0 w-full">
      <div className="relative rounded-2xl border border-subtle/80 bg-surface/40 px-4 py-5 sm:py-6 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5"
          aria-hidden
        />
        <div className="relative flex flex-col items-center gap-1.5">
          <span className="material-symbols-outlined text-3xl sm:text-4xl text-primary/80">{icon}</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={safe}
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="text-6xl sm:text-7xl font-black text-primary tabular-nums leading-none drop-shadow-[0_0_24px_rgba(26,138,138,0.35)]"
            >
              {safe}
            </motion.span>
          </AnimatePresence>
          {descriptor && (
            <motion.p
              key={`${stepId}-${descriptor}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm sm:text-base font-bold text-foreground/90 text-center px-2"
            >
              {descriptor}
            </motion.p>
          )}
        </div>
      </div>

      <div className="px-1 space-y-3">
        <div className="relative h-10 flex items-center">
          <div className="absolute inset-x-0 h-2.5 rounded-full bg-border/80 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-accent shadow-[0_0_12px_rgba(26,138,138,0.45)]"
              animate={{ width: `${fillPct}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={1}
            value={safe}
            disabled={disabled}
            onPointerDown={stopStepSwipe}
            onChange={(e) => setValue(Number(e.target.value))}
            onPointerUp={(e) => setValue(Number((e.target as HTMLInputElement).value), true)}
            className="numeric-scale-range relative z-10 w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-valuemin={MIN}
            aria-valuemax={MAX}
            aria-valuenow={safe}
          />
        </div>

        <div className="flex justify-between gap-2 text-[11px] sm:text-xs font-bold">
          <span className="text-muted text-start max-w-[42%] leading-snug">
            <span className="text-primary tabular-nums">{MIN}</span>
            <span className="mx-1 text-faint">·</span>
            {minLabel}
          </span>
          <span className="text-muted text-end max-w-[42%] leading-snug">
            <span className="text-primary tabular-nums">{MAX}</span>
            <span className="mx-1 text-faint">·</span>
            {maxLabel}
          </span>
        </div>

        <div className="flex justify-between gap-0.5 px-0.5" role="group" aria-label={t('onboarding.scale.ticks')}>
          {Array.from({ length: MAX - MIN + 1 }, (_, i) => {
            const n = i + MIN;
            const active = n === safe;
            const passed = n < safe;
            return (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => setValue(n, true)}
                className={`flex-1 min-w-0 flex flex-col items-center gap-1 py-1 rounded-lg transition-colors disabled:opacity-40 ${
                  active ? 'bg-primary/15' : 'hover:bg-surface/60'
                }`}
                aria-label={String(n)}
                aria-pressed={active}
              >
                <span
                  className={`block rounded-full transition-all ${
                    active
                      ? 'size-2.5 bg-primary ring-2 ring-primary/30'
                      : passed
                        ? 'size-1.5 bg-primary/60'
                        : 'size-1.5 bg-border'
                  }`}
                />
                <span
                  className={`text-[10px] font-bold tabular-nums ${
                    active ? 'text-primary' : 'text-faint'
                  }`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
