/** Static landing section config — copy comes from i18n keys. */
export type LandingPillar = {
  icon: string;
  titleKey:
    | 'landing.pillar1Title'
    | 'landing.pillar2Title'
    | 'landing.pillar3Title'
    | 'landing.pillar4Title'
    | 'landing.pillar5Title'
    | 'landing.pillar6Title';
  textKey:
    | 'landing.pillar1Text'
    | 'landing.pillar2Text'
    | 'landing.pillar3Text'
    | 'landing.pillar4Text'
    | 'landing.pillar5Text'
    | 'landing.pillar6Text';
  accent: string;
};

export const LANDING_PILLARS: LandingPillar[] = [
  {
    icon: 'psychology',
    titleKey: 'landing.pillar1Title',
    textKey: 'landing.pillar1Text',
    accent: 'text-primary',
  },
  {
    icon: 'restaurant',
    titleKey: 'landing.pillar2Title',
    textKey: 'landing.pillar2Text',
    accent: 'text-emerald-400',
  },
  {
    icon: 'fitness_center',
    titleKey: 'landing.pillar3Title',
    textKey: 'landing.pillar3Text',
    accent: 'text-sky-400',
  },
  {
    icon: 'monitoring',
    titleKey: 'landing.pillar4Title',
    textKey: 'landing.pillar4Text',
    accent: 'text-violet-400',
  },
  {
    icon: 'groups',
    titleKey: 'landing.pillar5Title',
    textKey: 'landing.pillar5Text',
    accent: 'text-rose-400',
  },
  {
    icon: 'shopping_bag',
    titleKey: 'landing.pillar6Title',
    textKey: 'landing.pillar6Text',
    accent: 'text-amber-400',
  },
];

export type LandingStep = {
  step: string;
  titleKey: 'landing.feature1Title' | 'landing.feature2Title' | 'landing.feature3Title';
  textKey: 'landing.feature1Text' | 'landing.feature2Text' | 'landing.feature3Text';
  icon: string;
};

export const LANDING_STEPS: LandingStep[] = [
  { step: '01', titleKey: 'landing.feature1Title', textKey: 'landing.feature1Text', icon: 'assignment' },
  { step: '02', titleKey: 'landing.feature2Title', textKey: 'landing.feature2Text', icon: 'auto_awesome' },
  { step: '03', titleKey: 'landing.feature3Title', textKey: 'landing.feature3Text', icon: 'trending_up' },
];

export type LandingWhyPoint = {
  icon: string;
  textKey:
    | 'landing.whyPoint1'
    | 'landing.whyPoint2'
    | 'landing.whyPoint3'
    | 'landing.whyPoint4';
};

export const LANDING_WHY_POINTS: LandingWhyPoint[] = [
  { icon: 'translate', textKey: 'landing.whyPoint1' },
  { icon: 'science', textKey: 'landing.whyPoint2' },
  { icon: 'shield_person', textKey: 'landing.whyPoint3' },
  { icon: 'all_inclusive', textKey: 'landing.whyPoint4' },
];
