import type { AppLanguage } from '../../services/settingsService';
import type { OnboardingStep } from './types';
import { AR_ATHLETE_STEP_LOCALE } from './athleteStepLocale.ar';

type OptionLocale = Record<string, { label?: string; description?: string }>;
type LevelLocale = Record<string, string>;

export interface StepLocalePatch {
  title?: string;
  subtitle?: string;
  body?: string;
  cta?: string;
  statement?: string;
  placeholder?: string;
  chatMessage?: string;
  chatImageUrl?: string;
  encouragement?: string;
  options?: OptionLocale;
  levels?: LevelLocale;
}

function patchOptions<T extends { value: string; label: string; description?: string }>(
  options: T[],
  locale?: OptionLocale,
): T[] {
  if (!locale) return options;
  return options.map((opt) => ({
    ...opt,
    label: locale[opt.value]?.label ?? opt.label,
    description: locale[opt.value]?.description ?? opt.description,
  }));
}

function localizeStep(step: OnboardingStep, patch?: StepLocalePatch): OnboardingStep {
  if (!patch) return step;

  const base = {
    title: patch.title ?? step.title,
    subtitle: 'subtitle' in step && patch.subtitle !== undefined ? patch.subtitle : 'subtitle' in step ? step.subtitle : undefined,
    chatMessage: patch.chatMessage ?? ('chatMessage' in step ? step.chatMessage : undefined),
    chatImageUrl: patch.chatImageUrl ?? ('chatImageUrl' in step ? step.chatImageUrl : undefined),
    encouragement: patch.encouragement ?? ('encouragement' in step ? step.encouragement : undefined),
  };

  switch (step.type) {
    case 'single':
    case 'multi':
      return {
        ...step,
        ...base,
        options: patchOptions(step.options, patch.options),
      };
    case 'likert':
      return { ...step, ...base, statement: patch.statement ?? step.statement };
    case 'info':
    case 'hero':
      return {
        ...step,
        ...base,
        body: patch.body ?? step.body,
        cta: patch.cta ?? step.cta,
      };
    case 'number':
    case 'text':
      return {
        ...step,
        ...base,
        placeholder: patch.placeholder ?? step.placeholder,
      };
    case 'slider':
      return {
        ...step,
        ...base,
        levels: step.levels.map((l) => ({
          ...l,
          label: patch.levels?.[l.value] ?? l.label,
        })),
      };
    default:
      return { ...step, title: patch.title ?? step.title };
  }
}

export function localizeAthleteSteps(steps: OnboardingStep[], language: AppLanguage): OnboardingStep[] {
  if (language !== 'ar') return steps;
  return steps.map((step) => localizeStep(step, AR_ATHLETE_STEP_LOCALE[step.id]));
}
