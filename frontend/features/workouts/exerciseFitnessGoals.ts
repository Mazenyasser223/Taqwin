import type { TranslationKey } from '../../lib/i18n/translations';

/** Fitness goal filter ids — keep in sync with backend exerciseFitnessGoals.js */
export const EXERCISE_FITNESS_GOALS = ['lose-weight', 'gain-strength', 'gain-muscle'] as const;

export type ExerciseFitnessGoal = (typeof EXERCISE_FITNESS_GOALS)[number];

const GOAL_KEYS: Record<ExerciseFitnessGoal, TranslationKey> = {
  'lose-weight': 'exercises.goal.loseWeight',
  'gain-strength': 'exercises.goal.gainStrength',
  'gain-muscle': 'exercises.goal.gainMuscle',
};

export function exerciseFitnessGoalKey(goal: string): TranslationKey {
  return GOAL_KEYS[goal as ExerciseFitnessGoal] ?? 'exercises.goal.gainMuscle';
}

export function formatFitnessGoalLabel(
  goal: string,
  t: (key: TranslationKey) => string,
): string {
  return t(exerciseFitnessGoalKey(goal));
}
