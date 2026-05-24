import type { TranslationKey } from '../../lib/i18n/translations';
import type { QuestionnaireFlowId } from './flows/types';

export interface FlowPreviewConfig {
  icon: string;
  accentClass: string;
  titleKey: TranslationKey;
  trustKey: TranslationKey;
  checklistKeys: readonly TranslationKey[];
}

export const FLOW_PREVIEW_CONFIG: Record<QuestionnaireFlowId, FlowPreviewConfig> = {
  core: {
    icon: 'person',
    accentClass: 'from-primary/20 to-accent/10',
    titleKey: 'onboarding.planPreview.core.title',
    trustKey: 'onboarding.planPreview.core.trust',
    checklistKeys: [
      'onboarding.planCheck.core.identity',
      'onboarding.planCheck.core.body',
      'onboarding.planCheck.core.goals',
      'onboarding.planCheck.core.activity',
      'onboarding.planCheck.core.personalize',
    ],
  },
  workout: {
    icon: 'fitness_center',
    accentClass: 'from-orange-500/20 to-primary/10',
    titleKey: 'onboarding.planPreview.workout.title',
    trustKey: 'onboarding.planPreview.workout.trust',
    checklistKeys: [
      'onboarding.planCheck.workout.schedule',
      'onboarding.planCheck.workout.split',
      'onboarding.planCheck.workout.exercises',
      'onboarding.planCheck.workout.strength',
      'onboarding.planCheck.workout.recovery',
    ],
  },
  diet: {
    icon: 'restaurant',
    accentClass: 'from-emerald-500/20 to-primary/10',
    titleKey: 'onboarding.planPreview.diet.title',
    trustKey: 'onboarding.planPreview.diet.trust',
    checklistKeys: [
      'onboarding.planCheck.diet.preferences',
      'onboarding.planCheck.diet.macros',
      'onboarding.planCheck.diet.meals',
      'onboarding.planCheck.diet.catalog',
      'onboarding.planCheck.diet.daily',
    ],
  },
  wellness: {
    icon: 'self_improvement',
    accentClass: 'from-violet-500/20 to-primary/10',
    titleKey: 'onboarding.planPreview.wellness.title',
    trustKey: 'onboarding.planPreview.wellness.trust',
    checklistKeys: [
      'onboarding.planCheck.wellness.health',
      'onboarding.planCheck.wellness.sleep',
      'onboarding.planCheck.wellness.motivation',
      'onboarding.planCheck.wellness.safety',
      'onboarding.planCheck.wellness.coach',
    ],
  },
};
