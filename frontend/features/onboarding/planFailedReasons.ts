import type { StepOption } from './types';
import type { AppLanguage } from '../../services/settingsService';

/** Shown when athlete answers Yes to past plan failure — high-signal for the coach agent. */
export const PLAN_FAILED_REASON_OPTIONS: StepOption[] = [
  { value: 'no_time', label: 'No time' },
  { value: 'inconsistent', label: "Couldn't stay consistent" },
  { value: 'diet_restrictive', label: 'Diet was too restrictive' },
  { value: 'no_results', label: 'No results' },
  { value: 'injury', label: 'Injury' },
  { value: 'lost_motivation', label: 'Lost motivation' },
  { value: 'other', label: 'Other' },
];

const PLAN_FAILED_REASON_AR: Record<string, string> = {
  no_time: 'مفيش وقت',
  inconsistent: 'مقدرتش ألتزم',
  diet_restrictive: 'الدايت كان قاسي أوي',
  no_results: 'مفيش نتائج',
  injury: 'إصابة',
  lost_motivation: 'فقدت الحماس',
  other: 'أخرى',
};

export function getPlanFailedReasonOptions(language: AppLanguage = 'en'): StepOption[] {
  if (language !== 'ar') return PLAN_FAILED_REASON_OPTIONS;
  return PLAN_FAILED_REASON_OPTIONS.map((o) => ({
    ...o,
    label: PLAN_FAILED_REASON_AR[o.value] ?? o.label,
  }));
}
