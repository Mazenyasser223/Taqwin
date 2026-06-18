import type { ProductTourStep } from '../../lib/productTour/types';
import { communityTourSteps } from './communityTourSteps';

/**
 * Tour order: home → my plans → AI → workouts → nutrition → gyms → shop
 * → compete → community (feed, profile, browse, groups, inbox, settings) → navigation.
 */
export const athleteAppTourSteps: ProductTourStep[] = [
  // —— Home: identity & daily metrics ——
  {
    id: 'home-profile',
    route: '/dashboard',
    sectionKey: 'tour.section.home',
    titleKey: 'tour.home.profileTitle',
    bodyKey: 'tour.home.profileBody',
    placement: 'bottom',
  },
  {
    id: 'home-fitness-score',
    route: '/dashboard',
    sectionKey: 'tour.section.home',
    titleKey: 'tour.home.fitnessScoreTitle',
    bodyKey: 'tour.home.fitnessScoreBody',
    placement: 'bottom',
  },
  {
    id: 'home-calories',
    route: '/dashboard',
    sectionKey: 'tour.section.home',
    titleKey: 'tour.home.caloriesTitle',
    bodyKey: 'tour.home.caloriesBody',
    placement: 'bottom',
  },
  {
    id: 'home-workout-kpi',
    route: '/dashboard',
    sectionKey: 'tour.section.home',
    titleKey: 'tour.home.workoutKpiTitle',
    bodyKey: 'tour.home.workoutKpiBody',
    placement: 'bottom',
  },
  {
    id: 'home-weight',
    route: '/dashboard',
    sectionKey: 'tour.section.home',
    titleKey: 'tour.home.weightTitle',
    bodyKey: 'tour.home.weightBody',
    placement: 'bottom',
  },
  {
    id: 'home-league',
    route: '/dashboard',
    sectionKey: 'tour.section.home',
    titleKey: 'tour.home.leagueTitle',
    bodyKey: 'tour.home.leagueBody',
    placement: 'bottom',
  },
  {
    id: 'home-challenge',
    route: '/dashboard',
    sectionKey: 'tour.section.home',
    titleKey: 'tour.home.challengeTitle',
    bodyKey: 'tour.home.challengeBody',
    placement: 'bottom',
  },
  {
    id: 'home-activity',
    route: '/dashboard',
    sectionKey: 'tour.section.home',
    titleKey: 'tour.home.activityTitle',
    bodyKey: 'tour.home.activityBody',
    placement: 'top',
  },
  {
    id: 'home-ai-summary',
    route: '/dashboard',
    sectionKey: 'tour.section.home',
    titleKey: 'tour.home.aiSummaryTitle',
    bodyKey: 'tour.home.aiSummaryBody',
    placement: 'left',
  },
  {
    id: 'home-readiness',
    route: '/dashboard',
    sectionKey: 'tour.section.home',
    titleKey: 'tour.home.readinessTitle',
    bodyKey: 'tour.home.readinessBody',
    placement: 'left',
  },
  {
    id: 'home-sleep',
    route: '/dashboard',
    sectionKey: 'tour.section.home',
    titleKey: 'tour.home.sleepTitle',
    bodyKey: 'tour.home.sleepBody',
    placement: 'left',
  },
  {
    id: 'home-hydration',
    route: '/dashboard',
    sectionKey: 'tour.section.home',
    titleKey: 'tour.home.hydrationTitle',
    bodyKey: 'tour.home.hydrationBody',
    placement: 'left',
  },

  // —— My Plans ——
  {
    id: 'plans-week',
    route: '/dashboard/plans',
    sectionKey: 'tour.section.plans',
    titleKey: 'tour.plans.weekTitle',
    bodyKey: 'tour.plans.weekBody',
    placement: 'bottom',
  },
  {
    id: 'plans-tabs',
    route: '/dashboard/plans',
    sectionKey: 'tour.section.plans',
    titleKey: 'tour.plans.tabsTitle',
    bodyKey: 'tour.plans.tabsBody',
    placement: 'bottom',
  },
  {
    id: 'plans-workout',
    route: '/dashboard/plans',
    sectionKey: 'tour.section.plans',
    titleKey: 'tour.plans.workoutTitle',
    bodyKey: 'tour.plans.workoutBody',
    placement: 'top',
  },
  {
    id: 'plans-diet',
    route: '/dashboard/plans',
    sectionKey: 'tour.section.plans',
    titleKey: 'tour.plans.dietTitle',
    bodyKey: 'tour.plans.dietBody',
    placement: 'top',
  },

  // —— AI Coach ——
  {
    id: 'ai-thread',
    route: '/ai-assistant',
    sectionKey: 'tour.section.ai',
    titleKey: 'tour.ai.threadTitle',
    bodyKey: 'tour.ai.threadBody',
    placement: 'bottom',
  },
  {
    id: 'ai-composer',
    route: '/ai-assistant',
    sectionKey: 'tour.section.ai',
    titleKey: 'tour.ai.composerTitle',
    bodyKey: 'tour.ai.composerBody',
    placement: 'top',
  },

  // —— Workouts & nutrition ——
  {
    id: 'workouts-hero',
    route: '/workouts',
    sectionKey: 'tour.section.workouts',
    titleKey: 'tour.workouts.heroTitle',
    bodyKey: 'tour.workouts.heroBody',
    placement: 'bottom',
  },
  {
    id: 'workouts-browse',
    route: '/workouts',
    sectionKey: 'tour.section.workouts',
    titleKey: 'tour.workouts.browseTitle',
    bodyKey: 'tour.workouts.browseBody',
    placement: 'top',
  },
  {
    id: 'nutrition-hero',
    route: '/nutrition',
    sectionKey: 'tour.section.nutrition',
    titleKey: 'tour.nutrition.heroTitle',
    bodyKey: 'tour.nutrition.heroBody',
    placement: 'bottom',
  },
  {
    id: 'nutrition-categories',
    route: '/nutrition',
    sectionKey: 'tour.section.nutrition',
    titleKey: 'tour.nutrition.categoriesTitle',
    bodyKey: 'tour.nutrition.categoriesBody',
    placement: 'top',
  },

  // —— Gyms ——
  {
    id: 'gyms-hero',
    route: '/gyms',
    sectionKey: 'tour.section.gyms',
    titleKey: 'tour.gyms.heroTitle',
    bodyKey: 'tour.gyms.heroBody',
    placement: 'bottom',
  },
  {
    id: 'gyms-controls',
    route: '/gyms',
    sectionKey: 'tour.section.gyms',
    titleKey: 'tour.gyms.controlsTitle',
    bodyKey: 'tour.gyms.controlsBody',
    placement: 'bottom',
  },
  {
    id: 'gyms-browse',
    route: '/gyms',
    sectionKey: 'tour.section.gyms',
    titleKey: 'tour.gyms.browseTitle',
    bodyKey: 'tour.gyms.browseBody',
    placement: 'top',
  },

  // —— Shop ——
  {
    id: 'shop-header',
    route: '/marketplace',
    sectionKey: 'tour.section.shop',
    titleKey: 'tour.shop.headerTitle',
    bodyKey: 'tour.shop.headerBody',
    placement: 'bottom',
  },
  {
    id: 'shop-search',
    route: '/marketplace',
    sectionKey: 'tour.section.shop',
    titleKey: 'tour.shop.searchTitle',
    bodyKey: 'tour.shop.searchBody',
    placement: 'bottom',
  },
  {
    id: 'shop-catalog',
    route: '/marketplace',
    sectionKey: 'tour.section.shop',
    titleKey: 'tour.shop.catalogTitle',
    bodyKey: 'tour.shop.catalogBody',
    placement: 'top',
  },

  // —— Compete ——
  {
    id: 'compete-hero',
    route: '/compete/league',
    sectionKey: 'tour.section.compete',
    titleKey: 'tour.compete.heroTitle',
    bodyKey: 'tour.compete.heroBody',
    placement: 'bottom',
  },
  {
    id: 'compete-scopes',
    route: '/compete/league',
    sectionKey: 'tour.section.compete',
    titleKey: 'tour.compete.scopesTitle',
    bodyKey: 'tour.compete.scopesBody',
    placement: 'bottom',
  },
  {
    id: 'compete-leaderboard',
    route: '/compete/league',
    sectionKey: 'tour.section.compete',
    titleKey: 'tour.compete.leaderboardTitle',
    bodyKey: 'tour.compete.leaderboardBody',
    placement: 'top',
  },

  // —— Community ——
  ...communityTourSteps,

  // —— Navigation (wrap up) ——
  {
    id: 'app-nav',
    sectionKey: 'tour.section.navigation',
    titleKey: 'tour.nav.title',
    bodyKey: 'tour.nav.body',
    placement: 'right',
  },
];
