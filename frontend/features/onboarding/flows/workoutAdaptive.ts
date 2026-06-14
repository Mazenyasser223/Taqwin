import type { OnboardingStep } from '../types';

function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

export function normalizeWorkoutLocation(v: unknown): 'home' | 'gym' | 'mixed' {
  const s = String(v ?? '').toLowerCase();
  if (s.includes('home') && !s.includes('gym')) return 'home';
  if (s.includes('gym') && !s.includes('home') && !s.includes('mix')) return 'gym';
  if (s.includes('mix')) return 'mixed';
  if (s === 'home') return 'home';
  if (s === 'gym') return 'gym';
  return 'mixed';
}

export function trainingDaysCount(v: unknown): number {
  const m = String(v ?? '').match(/(\d+)/);
  if (!m) return 0;
  return Math.min(6, Math.max(2, Number(m[1])));
}

/** Sun–Sat keys aligned with plan dayIndex (Sun=1 … Sat=7). */
export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function restDaysNeededFromTraining(trainingDaysPerWeek: unknown): number {
  const train = trainingDaysCount(trainingDaysPerWeek) || 4;
  return Math.max(0, 7 - train);
}

export function hasActiveInjuries(answers: Record<string, unknown>): boolean {
  const injuries = arr(answers.injuries).filter((i) => i !== 'none');
  return injuries.length > 0;
}

export function hasBackInjury(answers: Record<string, unknown>): boolean {
  return arr(answers.injuries).some((i) =>
    ['back', 'lower_back', 'upper_back'].includes(i),
  );
}

export function hasKneeInjury(answers: Record<string, unknown>): boolean {
  return arr(answers.injuries).some((i) => ['knees', 'ankles'].includes(i));
}

export function isBeginnerOrNever(answers: Record<string, unknown>): boolean {
  const level = String(answers.fitnessLevel ?? '').toLowerCase();
  const last = String(answers.lastTraining ?? '');
  return level.includes('beginner') || last === 'never';
}

export function isIntermediateOrAdvanced(answers: Record<string, unknown>): boolean {
  const level = String(answers.fitnessLevel ?? '').toLowerCase();
  return level.includes('intermediate') || level.includes('advanced');
}

export function isCurrentlyTraining(answers: Record<string, unknown>): boolean {
  return String(answers.lastTraining ?? '') === 'current';
}

export function strengthEquipmentList(answers: Record<string, unknown>): string[] {
  return arr(answers.strengthEquipment);
}

export function isBodyweightOnly(answers: Record<string, unknown>): boolean {
  const eq = strengthEquipmentList(answers);
  return eq.length === 1 && eq[0] === 'bodyweight';
}

export function hasStrengthGearForBench(answers: Record<string, unknown>): boolean {
  const eq = strengthEquipmentList(answers);
  if (!eq.length) return false;
  if (isBodyweightOnly(answers)) return false;
  return eq.some((x) => ['barbell', 'machines', 'dumbbells', 'cables'].includes(x));
}

export function hasBarbellForDeadlift(answers: Record<string, unknown>): boolean {
  return strengthEquipmentList(answers).includes('barbell');
}

export function hasPullupCapability(answers: Record<string, unknown>): boolean {
  const loc = normalizeWorkoutLocation(answers.workoutLocation);
  if (loc === 'gym' || loc === 'mixed') return true;
  const eq = strengthEquipmentList(answers);
  return eq.some((x) => ['cables', 'machines', 'barbell'].includes(x));
}

export function shouldShowBenchMax(answers: Record<string, unknown>): boolean {
  const loc = normalizeWorkoutLocation(answers.workoutLocation);
  if (loc === 'home') return false;
  if (isBeginnerOrNever(answers)) return false;
  if (!isCurrentlyTraining(answers)) return false;
  if (!isIntermediateOrAdvanced(answers)) return false;
  return hasStrengthGearForBench(answers);
}

export function shouldShowDeadliftMax(answers: Record<string, unknown>): boolean {
  if (!shouldShowBenchMax(answers)) return false;
  if (!hasBarbellForDeadlift(answers)) return false;
  if (hasBackInjury(answers)) return false;
  return true;
}

export function shouldShowLiftExperience(answers: Record<string, unknown>): boolean {
  if (isIntermediateOrAdvanced(answers) && isCurrentlyTraining(answers)) return true;
  return shouldShowBenchMax(answers) || shouldShowDeadliftMax(answers);
}

const SPLIT_BY_DAYS: Record<number, Set<string>> = {
  2: new Set(['full_body', 'coach']),
  3: new Set(['full_body', 'ppl', 'coach']),
  4: new Set(['upper_lower', 'full_body', 'coach']),
  5: new Set(['ppl', 'bro', 'upper_lower', 'coach']),
  6: new Set(['ppl', 'bro', 'upper_lower', 'coach']),
};

const CARDIO_BLOCKED_BY_INJURY: Record<string, string[]> = {
  rower: ['back', 'lower_back', 'upper_back'],
  stepper: ['knees', 'ankles'],
};

export function shouldSkipWorkoutStep(
  stepId: string,
  answers: Record<string, unknown>,
): boolean {
  const loc = normalizeWorkoutLocation(answers.workoutLocation);

  switch (stepId) {
    case 'gymLink':
      return loc !== 'gym';
    case 'equipment':
      return answers.addCardio !== 'yes';
    case 'pullups':
      return !hasPullupCapability(answers);
    case 'benchMax':
      return !shouldShowBenchMax(answers);
    case 'deadliftMax':
      return !shouldShowDeadliftMax(answers);
    case 'liftExperience':
      return !shouldShowLiftExperience(answers);
    default:
      return false;
  }
}

function filterSplitOptions(step: OnboardingStep, answers: Record<string, unknown>): OnboardingStep {
  if (step.type !== 'single' || step.id !== 'preferredSplit') return step;
  const days = trainingDaysCount(answers.trainingDaysPerWeek);
  const allowed = SPLIT_BY_DAYS[days] ?? SPLIT_BY_DAYS[4];
  return {
    ...step,
    options: step.options.filter((o) => allowed.has(o.value)),
  };
}

function filterCardioEquipment(step: OnboardingStep, answers: Record<string, unknown>): OnboardingStep {
  if (step.type !== 'single' || step.id !== 'equipment') return step;
  const injuries = arr(answers.injuries).filter((i) => i !== 'none' && i !== 'other');
  return {
    ...step,
    options: step.options.filter((opt) => {
      const blocked = CARDIO_BLOCKED_BY_INJURY[opt.value];
      if (!blocked) return true;
      return !blocked.some((inj) => injuries.includes(inj));
    }),
  };
}

export function splitSuggestionForDays(days: number): string | null {
  switch (days) {
    case 2:
      return 'With 2 days, we’ll shape a full-body plan around your week.';
    case 3:
      return 'With 3 days, full-body or upper/lower rotations fit well.';
    case 4:
      return 'With 4 days, an upper/lower split is a strong match.';
    case 5:
    case 6:
      return 'With 5–6 days, PPL or hybrid splits give you more room to progress.';
    default:
      return null;
  }
}

export function adaptWorkoutStep(
  step: OnboardingStep,
  answers: Record<string, unknown>,
): OnboardingStep {
  let adapted = filterSplitOptions(step, answers);
  adapted = filterCardioEquipment(adapted, answers);

  if (step.id === 'preferredSplit' && adapted.type === 'single') {
    const days = trainingDaysCount(answers.trainingDaysPerWeek);
    const hint = splitSuggestionForDays(days);
    if (hint) {
      return { ...adapted, subtitle: hint };
    }
  }

  return adapted;
}
