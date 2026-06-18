import type { ProductTourStep } from '../../lib/productTour/types';

const GYM_DASH_SCROLL_STEPS = new Set([
  'gym-tour-dash-class-sessions',
  'gym-tour-dash-checkins',
  'gym-tour-dash-plan-chart',
  'gym-tour-dash-plans',
  'gym-tour-dash-staff',
  'gym-tour-dash-basic-sessions',
  'gym-tour-dash-classes',
]);

function scrollTourTarget(stepId: string, block: ScrollLogicalPosition = 'center') {
  const el = document.querySelector(`[data-tour="${stepId}"]`);
  el?.scrollIntoView({ behavior: 'instant', block, inline: 'nearest' });
}

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

  if (GYM_DASH_SCROLL_STEPS.has(step.id)) {
    scrollTourTarget(step.id);
  }
  if (step.id === 'gym-tour-reception-roster') {
    (
      document.querySelector('[data-tour="gym-tour-reception-roster"] button') as HTMLButtonElement | null
    )?.click();
    scrollTourTarget('gym-tour-reception-roster', 'nearest');
  }
  if (step.id === 'gym-tour-reception-members' || step.id === 'gym-tour-reception-detail') {
    scrollTourTarget(step.id, 'nearest');
  }
  if (step.id.startsWith('gym-tour-equipment-')) {
    scrollTourTarget(step.id, 'nearest');
  }
}
