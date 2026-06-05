import type { TranslationKey } from '../../lib/i18n/translations';
import type { AppLanguage } from '../../services/settingsService';
import { getLocalizedQuestionnaireStep } from './flows/index';

const KNOWN_OPTION_STEP_IDS = [
  'primaryGoal',
  'fitnessLevel',
  'preferredSplit',
  'dietType',
  'sleep',
  'workoutLocation',
  'workoutTime',
  'mealsPerDay',
  'activityLevel',
  'physique',
  'gender',
  'ageRange',
  'trainingDaysPerWeek',
  'lastTraining',
  'bodyType',
  'water',
  'workoutDuration',
  'cardioPreference',
  'mealTiming',
  'cookingSkill',
  'groceryBudget',
  'stressLevel',
  'energyLevel',
  'pastTraining',
  'injuries',
  'pastActivities',
  'successMetrics',
  'goal12Week',
] as const;

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ');
}

function matchOptionLabel(
  stepId: string,
  raw: string,
  language: AppLanguage,
): string | null {
  const step = getLocalizedQuestionnaireStep(stepId, language);
  if (!step || (step.type !== 'single' && step.type !== 'multi')) return null;

  const norm = normalizeToken(raw);
  for (const opt of step.options) {
    if (opt.value === raw || normalizeToken(opt.value) === norm) return opt.label;
    if (normalizeToken(opt.label) === norm) return opt.label;
  }
  return null;
}

/** Localize a stored onboarding / profile enum value for display (Arabic UI). */
export function localizeOnboardingDisplayValue(
  stepId: string | null | undefined,
  raw: string | null | undefined,
  language: AppLanguage,
): string {
  if (!raw) return '';
  if (language !== 'ar') return raw;

  if (stepId) {
    const hit = matchOptionLabel(stepId, raw, language);
    if (hit) return hit;
  }

  for (const sid of KNOWN_OPTION_STEP_IDS) {
    const hit = matchOptionLabel(sid, raw, language);
    if (hit) return hit;
  }

  return raw;
}

/** Localize chip text from backend (e.g. "4 days / week", "Sleep: 7-8 hours"). */
export function localizePersonalizationChipLabel(
  label: string,
  language: AppLanguage,
  t: (key: TranslationKey, params?: Record<string, string>) => string,
): string {
  if (language !== 'ar') return label;

  const daysWeek = label.match(/^(\d+)\s+days?\s*\/\s*week$/i);
  if (daysWeek) {
    return t('dashboard.chipDaysPerWeek', { days: daysWeek[1] });
  }

  const sleep = label.match(/^Sleep:\s*(.+)$/i);
  if (sleep) {
    return t('dashboard.chipSleep', {
      value: localizeOnboardingDisplayValue('sleep', sleep[1].trim(), language),
    });
  }

  return localizeOnboardingDisplayValue(null, label, language);
}
