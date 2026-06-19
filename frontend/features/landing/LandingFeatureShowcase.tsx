import React from 'react';
import { motion } from 'framer-motion';
import { getShowcaseFeature } from './landingContent';
import {
  HeroSpotlightBlock,
  FeatureSplitRow,
  FeatureStackRow,
  DualFeatureRow,
  CommunityFeatureRow,
  DuoOverlapRow,
  CtaBandBlock,
} from './LandingFeatureLayouts';
import { LandingSectionHeader } from './LandingSectionHeader';
import { LANDING_CONTAINER, LANDING_SCROLL_MT, LANDING_SECTION_PY } from './landingUi';
import { useI18n } from '../../lib/i18n/useI18n';
export function LandingFeatureShowcase() {
  const { t } = useI18n();

  const features = {
    aiCoach: getShowcaseFeature('ai-coach'),
    dashboard: getShowcaseFeature('dashboard'),
    nutrition: getShowcaseFeature('nutrition'),
    workouts: getShowcaseFeature('workouts'),
    muscleWiki: getShowcaseFeature('muscle-wiki'),
    league: getShowcaseFeature('league'),
    compete: getShowcaseFeature('compete'),
    community: getShowcaseFeature('community'),
    marketplace: getShowcaseFeature('marketplace'),
    gymOwner: getShowcaseFeature('gym-owner'),
  };

  if (Object.values(features).some((f) => !f)) return null;

  const {
    aiCoach,
    dashboard,
    nutrition,
    workouts,
    muscleWiki,
    league,
    compete,
    community,
    marketplace,
    gymOwner,
  } = features as Record<string, NonNullable<(typeof features)[keyof typeof features]>>;

  return (
    <section id="features" className={`relative w-full min-w-0 overflow-x-clip ${LANDING_SCROLL_MT}`}>
      <div className="absolute inset-0 bg-[#060d12] pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className={`relative z-10 ${LANDING_CONTAINER} ${LANDING_SECTION_PY}`}>
        <LandingSectionHeader
          eyebrow={t('landing.showcaseLabel')}
          title={t('landing.showcaseTitle')}
          subtitle={t('landing.showcaseSubtitle')}
          className="pt-4 sm:pt-8"
        />
        <HeroSpotlightBlock feature={aiCoach} />
        <FeatureSplitRow feature={dashboard} />
        <FeatureSplitRow feature={nutrition} reverse />
        <FeatureStackRow feature={workouts} mockFirst={false} />
        <FeatureSplitRow feature={muscleWiki} reverse />
        <DualFeatureRow features={[league, compete]} />
        <CommunityFeatureRow feature={community} />
        <DuoOverlapRow features={[marketplace, gymOwner]} />
        <CtaBandBlock />
      </div>
    </section>
  );
}