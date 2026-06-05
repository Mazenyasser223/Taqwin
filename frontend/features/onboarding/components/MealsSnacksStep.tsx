import React from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';
import type { OnboardingAnswers } from '../types';

const MEAL_COUNTS = ['2', '3', '4', '5'] as const;
const SNACK_COUNTS = ['0', '1', '2', '3', '4'] as const;

export interface MealsSnacksStepProps {
  mealsField?: string;
  snacksField?: string;
  answers: OnboardingAnswers;
  onAnswer: (key: string, value: string) => void;
  onContinue: () => void;
  hideContinue?: boolean;
  compact?: boolean;
}

function CountRow({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: readonly string[];
  selected: string | undefined;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5 shrink-0">
      <p className="text-xs sm:text-sm font-bold text-foreground px-0.5">{label}</p>
      <div
        className={`grid gap-1.5 ${
          values.length >= 5 ? 'grid-cols-5' : 'grid-cols-4'
        }`}
      >
        {values.map((value) => {
          const active = selected === value;
          return (
            <motion.button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              whileTap={{ scale: 0.97 }}
              className={`rounded-xl border py-2.5 sm:py-3 text-sm sm:text-base font-black tabular-nums transition-colors ${
                active
                  ? 'border-primary bg-primary/15 text-primary ring-1 ring-primary/30'
                  : 'border-subtle bg-surface/60 text-foreground hover:border-primary/35'
              }`}
            >
              {value}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export const MealsSnacksStep: React.FC<MealsSnacksStepProps> = ({
  mealsField = 'mealsPerDay',
  snacksField = 'snacksPerDay',
  answers,
  onAnswer,
  onContinue,
  hideContinue = false,
  compact = false,
}) => {
  const { t } = useI18n();
  const meals = answers[mealsField] != null ? String(answers[mealsField]) : '';
  const snacks =
    answers[snacksField] !== undefined && answers[snacksField] !== null
      ? String(answers[snacksField])
      : '';
  const canContinue = Boolean(meals) && snacks !== '';
  const total =
    canContinue ? String(Number(meals) + Number(snacks)) : null;

  return (
    <div
      className={`font-[Cairo,'Space_Grotesk',sans-serif] ${
        compact ? 'flex flex-col flex-1 min-h-0 gap-3' : 'space-y-4'
      }`}
    >
      <CountRow
        label={t('onboarding.mealsSnacks.mainMeals')}
        values={MEAL_COUNTS}
        selected={meals || undefined}
        onSelect={(value) => onAnswer(mealsField, value)}
      />
      <CountRow
        label={t('onboarding.mealsSnacks.snacks')}
        values={SNACK_COUNTS}
        selected={snacks || undefined}
        onSelect={(value) => onAnswer(snacksField, value)}
      />

      {total && (
        <p className="text-center text-[11px] sm:text-xs font-bold text-primary shrink-0">
          {t('onboarding.mealsSnacks.summary', { meals, snacks, total })}
        </p>
      )}

      {!hideContinue && (
        <motion.button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          whileTap={canContinue ? { scale: 0.98 } : undefined}
          className={`w-full rounded-2xl bg-primary text-white font-black text-sm disabled:opacity-40 shadow-lg shadow-primary/20 ${
            compact ? 'shrink-0 mt-auto py-3' : 'py-3.5'
          }`}
        >
          {t('common.continue')}
        </motion.button>
      )}
    </div>
  );
};
