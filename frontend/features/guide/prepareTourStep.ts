import type { ProductTourStep } from '../../lib/productTour/types';
import { scrollTourTargetIntoView } from '../../lib/productTour/scrollTourTarget';

/** Switch tabs / UI state before a step target is resolved. */
export function prepareTourStep(step: ProductTourStep): void {
  if (step.id === 'plans-workout') {
    (document.querySelector('[data-tour="plans-tab-workout"]') as HTMLButtonElement | null)?.click();
  }
  if (step.id === 'plans-diet') {
    (document.querySelector('[data-tour="plans-tab-diet"]') as HTMLButtonElement | null)?.click();
  }
  if (step.id === 'gyms-browse') {
    (document.querySelector('[data-tour="gyms-view-map"]') as HTMLButtonElement | null)?.click();
  }
  if (step.id === 'community-inbox-conversations') {
    (document.querySelector('[data-tour="community-inbox-folders"] button') as HTMLButtonElement | null)?.click();
  }
  if (step.id === 'community-profile-tabs') {
    (document.querySelector('[data-tour="community-profile-tabs"] button') as HTMLButtonElement | null)?.click();
  }
  if (step.id === 'gym-tour-reception-roster') {
    (
      document.querySelector('[data-tour="gym-tour-reception-roster"] button') as HTMLButtonElement | null
    )?.click();
  }

  scrollTourTargetIntoView(step.id);
}
