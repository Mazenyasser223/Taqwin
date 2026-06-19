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

export type LandingShowcaseMockup =
  | 'ai'
  | 'nutrition'
  | 'workouts'
  | 'muscle-wiki'
  | 'cap-hema-eye'
  | 'dashboard'
  | 'tracking'
  | 'telegram'
  | 'league'
  | 'compete'
  | 'community'
  | 'marketplace'
  | 'gym';

export type LandingShowcaseBulletKey =
  | 'landing.showcaseAiBullet1'
  | 'landing.showcaseAiBullet2'
  | 'landing.showcaseAiBullet3'
  | 'landing.showcaseNutritionBullet1'
  | 'landing.showcaseNutritionBullet2'
  | 'landing.showcaseNutritionBullet3'
  | 'landing.showcaseWorkoutsBullet1'
  | 'landing.showcaseWorkoutsBullet2'
  | 'landing.showcaseWorkoutsBullet3'
  | 'landing.showcaseMuscleWikiBullet1'
  | 'landing.showcaseMuscleWikiBullet2'
  | 'landing.showcaseMuscleWikiBullet3'
  | 'landing.showcaseCapHemaEyeBullet1'
  | 'landing.showcaseCapHemaEyeBullet2'
  | 'landing.showcaseCapHemaEyeBullet3'
  | 'landing.showcaseDashboardBullet1'
  | 'landing.showcaseDashboardBullet2'
  | 'landing.showcaseDashboardBullet3'
  | 'landing.showcaseTrackingBullet1'
  | 'landing.showcaseTrackingBullet2'
  | 'landing.showcaseTrackingBullet3'
  | 'landing.showcaseTelegramBullet1'
  | 'landing.showcaseTelegramBullet2'
  | 'landing.showcaseTelegramBullet3'
  | 'landing.showcaseLeagueBullet1'
  | 'landing.showcaseLeagueBullet2'
  | 'landing.showcaseLeagueBullet3'
  | 'landing.showcaseCompeteBullet1'
  | 'landing.showcaseCompeteBullet2'
  | 'landing.showcaseCompeteBullet3'
  | 'landing.showcaseCommunityBullet1'
  | 'landing.showcaseCommunityBullet2'
  | 'landing.showcaseCommunityBullet3'
  | 'landing.showcaseMarketplaceBullet1'
  | 'landing.showcaseMarketplaceBullet2'
  | 'landing.showcaseMarketplaceBullet3'
  | 'landing.showcaseGymBullet1'
  | 'landing.showcaseGymBullet2'
  | 'landing.showcaseGymBullet3';

export type LandingShowcaseLayout =
  | 'hero-spotlight'
  | 'split-mock-left'
  | 'split-mock-right'
  | 'stack-mock-top'
  | 'stack-mock-bottom'
  | 'pair-widget'
  | 'wide'
  | 'asymmetric';

export type LandingShowcaseFeature = {
  id: string;
  icon: string;
  mockup: LandingShowcaseMockup;
  layout: LandingShowcaseLayout;
  titleKey:
    | 'landing.showcaseAiTitle'
    | 'landing.showcaseNutritionTitle'
    | 'landing.showcaseWorkoutsTitle'
    | 'landing.showcaseMuscleWikiTitle'
    | 'landing.showcaseCapHemaEyeTitle'
    | 'landing.showcaseDashboardTitle'
    | 'landing.showcaseTrackingTitle'
    | 'landing.showcaseTelegramTitle'
    | 'landing.showcaseLeagueTitle'
    | 'landing.showcaseCompeteTitle'
    | 'landing.showcaseCommunityTitle'
    | 'landing.showcaseMarketplaceTitle'
    | 'landing.showcaseGymTitle';
  textKey:
    | 'landing.showcaseAiText'
    | 'landing.showcaseNutritionText'
    | 'landing.showcaseWorkoutsText'
    | 'landing.showcaseMuscleWikiText'
    | 'landing.showcaseCapHemaEyeText'
    | 'landing.showcaseDashboardText'
    | 'landing.showcaseTrackingText'
    | 'landing.showcaseTelegramText'
    | 'landing.showcaseLeagueText'
    | 'landing.showcaseCompeteText'
    | 'landing.showcaseCommunityText'
    | 'landing.showcaseMarketplaceText'
    | 'landing.showcaseGymText';
  bulletKeys: [LandingShowcaseBulletKey, LandingShowcaseBulletKey, LandingShowcaseBulletKey];
  accent: string;
  ring: string;
};

export function getShowcaseFeature(id: string): LandingShowcaseFeature | undefined {
  return LANDING_SHOWCASE.find((f) => f.id === id);
}

export const LANDING_SHOWCASE: LandingShowcaseFeature[] = [
  {
    id: 'ai-coach',
    icon: 'psychology',
    mockup: 'ai',
    titleKey: 'landing.showcaseAiTitle',
    textKey: 'landing.showcaseAiText',
    bulletKeys: ['landing.showcaseAiBullet1', 'landing.showcaseAiBullet2', 'landing.showcaseAiBullet3'],
    accent: 'text-primary',
    ring: 'ring-primary/30',
    layout: 'hero-spotlight',
  },
  {
    id: 'dashboard',
    icon: 'dashboard',
    mockup: 'dashboard',
    layout: 'split-mock-left',
    titleKey: 'landing.showcaseDashboardTitle',
    textKey: 'landing.showcaseDashboardText',
    bulletKeys: [
      'landing.showcaseDashboardBullet1',
      'landing.showcaseDashboardBullet2',
      'landing.showcaseDashboardBullet3',
    ],
    accent: 'text-violet-400',
    ring: 'ring-violet-400/30',
  },
  {
    id: 'nutrition',
    icon: 'restaurant',
    mockup: 'nutrition',
    layout: 'stack-mock-top',
    titleKey: 'landing.showcaseNutritionTitle',
    textKey: 'landing.showcaseNutritionText',
    bulletKeys: [
      'landing.showcaseNutritionBullet1',
      'landing.showcaseNutritionBullet2',
      'landing.showcaseNutritionBullet3',
    ],
    accent: 'text-emerald-400',
    ring: 'ring-emerald-400/30',
  },
  {
    id: 'workouts',
    icon: 'fitness_center',
    mockup: 'workouts',
    layout: 'stack-mock-bottom',
    titleKey: 'landing.showcaseWorkoutsTitle',
    textKey: 'landing.showcaseWorkoutsText',
    bulletKeys: [
      'landing.showcaseWorkoutsBullet1',
      'landing.showcaseWorkoutsBullet2',
      'landing.showcaseWorkoutsBullet3',
    ],
    accent: 'text-sky-400',
    ring: 'ring-sky-400/30',
  },
  {
    id: 'muscle-wiki',
    icon: 'accessibility_new',
    mockup: 'muscle-wiki',
    layout: 'split-mock-right',
    titleKey: 'landing.showcaseMuscleWikiTitle',
    textKey: 'landing.showcaseMuscleWikiText',
    bulletKeys: [
      'landing.showcaseMuscleWikiBullet1',
      'landing.showcaseMuscleWikiBullet2',
      'landing.showcaseMuscleWikiBullet3',
    ],
    accent: 'text-cyan-400',
    ring: 'ring-cyan-400/30',
  },
  {
    id: 'cap-hema-eye',
    icon: 'remove_red_eye',
    mockup: 'cap-hema-eye',
    layout: 'pair-widget',
    titleKey: 'landing.showcaseCapHemaEyeTitle',
    textKey: 'landing.showcaseCapHemaEyeText',
    bulletKeys: [
      'landing.showcaseCapHemaEyeBullet1',
      'landing.showcaseCapHemaEyeBullet2',
      'landing.showcaseCapHemaEyeBullet3',
    ],
    accent: 'text-teal-400',
    ring: 'ring-teal-400/30',
  },
  {
    id: 'tracking',
    icon: 'monitoring',
    mockup: 'tracking',
    layout: 'split-mock-left',
    titleKey: 'landing.showcaseTrackingTitle',
    textKey: 'landing.showcaseTrackingText',
    bulletKeys: [
      'landing.showcaseTrackingBullet1',
      'landing.showcaseTrackingBullet2',
      'landing.showcaseTrackingBullet3',
    ],
    accent: 'text-indigo-400',
    ring: 'ring-indigo-400/30',
  },
  {
    id: 'telegram',
    icon: 'send',
    mockup: 'telegram',
    layout: 'split-mock-right',
    titleKey: 'landing.showcaseTelegramTitle',
    textKey: 'landing.showcaseTelegramText',
    bulletKeys: [
      'landing.showcaseTelegramBullet1',
      'landing.showcaseTelegramBullet2',
      'landing.showcaseTelegramBullet3',
    ],
    accent: 'text-sky-400',
    ring: 'ring-sky-400/30',
  },
  {
    id: 'league',
    icon: 'emoji_events',
    mockup: 'league',
    layout: 'pair-widget',
    titleKey: 'landing.showcaseLeagueTitle',
    textKey: 'landing.showcaseLeagueText',
    bulletKeys: ['landing.showcaseLeagueBullet1', 'landing.showcaseLeagueBullet2', 'landing.showcaseLeagueBullet3'],
    accent: 'text-yellow-400',
    ring: 'ring-yellow-400/30',
  },
  {
    id: 'compete',
    icon: 'flag',
    mockup: 'compete',
    layout: 'pair-widget',
    titleKey: 'landing.showcaseCompeteTitle',
    textKey: 'landing.showcaseCompeteText',
    bulletKeys: [
      'landing.showcaseCompeteBullet1',
      'landing.showcaseCompeteBullet2',
      'landing.showcaseCompeteBullet3',
    ],
    accent: 'text-orange-400',
    ring: 'ring-orange-400/30',
  },
  {
    id: 'community',
    icon: 'groups',
    mockup: 'community',
    layout: 'wide',
    titleKey: 'landing.showcaseCommunityTitle',
    textKey: 'landing.showcaseCommunityText',
    bulletKeys: [
      'landing.showcaseCommunityBullet1',
      'landing.showcaseCommunityBullet2',
      'landing.showcaseCommunityBullet3',
    ],
    accent: 'text-rose-400',
    ring: 'ring-rose-400/30',
  },
  {
    id: 'marketplace',
    icon: 'shopping_bag',
    mockup: 'marketplace',
    layout: 'asymmetric',
    titleKey: 'landing.showcaseMarketplaceTitle',
    textKey: 'landing.showcaseMarketplaceText',
    bulletKeys: [
      'landing.showcaseMarketplaceBullet1',
      'landing.showcaseMarketplaceBullet2',
      'landing.showcaseMarketplaceBullet3',
    ],
    accent: 'text-amber-400',
    ring: 'ring-amber-400/30',
  },
  {
    id: 'gym-owner',
    icon: 'storefront',
    mockup: 'gym',
    layout: 'asymmetric',
    titleKey: 'landing.showcaseGymTitle',
    textKey: 'landing.showcaseGymText',
    bulletKeys: ['landing.showcaseGymBullet1', 'landing.showcaseGymBullet2', 'landing.showcaseGymBullet3'],
    accent: 'text-cyan-400',
    ring: 'ring-cyan-400/30',
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
