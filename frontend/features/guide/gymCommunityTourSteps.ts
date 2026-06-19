import type { ProductTourStep } from '../../lib/productTour/types';

/** Short community intro for gym owners (feed only). */
export const gymCommunityTourSteps: ProductTourStep[] = [
  {
    id: 'community-tabs',
    route: '/community',
    sectionKey: 'tour.section.community',
    titleKey: 'tour.gym.communityTabsTitle',
    bodyKey: 'tour.gym.communityTabsBody',
    placement: 'bottom',
  },
  {
    id: 'community-composer',
    route: '/community',
    sectionKey: 'tour.section.community',
    titleKey: 'tour.gym.communityComposerTitle',
    bodyKey: 'tour.gym.communityComposerBody',
    placement: 'bottom',
  },
  {
    id: 'community-posts',
    route: '/community',
    sectionKey: 'tour.section.community',
    titleKey: 'tour.gym.communityPostsTitle',
    bodyKey: 'tour.gym.communityPostsBody',
    placement: 'top',
  },
];
