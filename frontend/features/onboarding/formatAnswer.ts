import type { OnboardingAnswers, OnboardingStep } from './types';

export function formatAnswerText(step: OnboardingStep, answers: OnboardingAnswers): string | null {
  const raw = answers[step.id] ?? ('field' in step ? answers[step.field] : undefined);
  if (raw === undefined || raw === null || raw === '') return null;

  if (step.type === 'single' || step.type === 'multi') {
    const values = Array.isArray(raw) ? raw : [String(raw)];
    return values
      .map(v => step.options.find(o => o.value === v)?.label ?? v)
      .join('، ');
  }

  if (step.type === 'slider') {
    const level = step.levels.find(l => l.value === raw);
    return level?.label ?? String(raw);
  }

  if (step.type === 'number') {
    return step.unit ? `${raw} ${step.unit}` : String(raw);
  }

  if (step.type === 'likert') return String(raw);

  if (step.type === 'text') return String(raw);

  if (step.type === 'weightOptional') {
    return raw === 'unknown' ? "I don't know" : `${raw} kg`;
  }

  return String(raw);
}
