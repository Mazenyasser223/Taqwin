import type { OnboardingSection } from '../types';

export type QuestionnaireFlowId = 'core' | 'workout' | 'diet' | 'wellness';

export const FLOW_META: Record<
  QuestionnaireFlowId,
  { completedKey: string; progressKey: string; titleAr: string; subtitleAr: string }
> = {
  core: {
    completedKey: 'coreCompletedAt',
    progressKey: 'coreProgressStepIndex',
    titleAr: 'التسجيل الأساسي',
    subtitleAr: 'هويتك وجسمك وأهدافك',
  },
  workout: {
    completedKey: 'workoutPlanCompletedAt',
    progressKey: 'workoutProgressStepIndex',
    titleAr: 'خطة التمرين',
    subtitleAr: 'جدولك وتفضيلاتك في الجيم',
  },
  diet: {
    completedKey: 'dietPlanCompletedAt',
    progressKey: 'dietProgressStepIndex',
    titleAr: 'خطة الأكل',
    subtitleAr: 'تفضيلاتك الغذائية',
  },
  wellness: {
    completedKey: 'wellnessCompletedAt',
    progressKey: 'wellnessProgressStepIndex',
    titleAr: 'الصحة والمشاعر',
    subtitleAr: 'صحتك ودافعك',
  },
};

/** Section progress labels per flow */
export const FLOW_SECTION_ORDER: Record<QuestionnaireFlowId, OnboardingSection[]> = {
  core: ['profile', 'goals'],
  workout: ['fitness', 'training'],
  diet: ['health'],
  wellness: ['health', 'mindset'],
};
