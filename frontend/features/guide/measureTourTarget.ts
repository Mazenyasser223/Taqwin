import type { ProductTourStep } from '../../lib/productTour/types';
import { computeTourLayout, getTourTargetBounds, type TourLayout } from './productTourLayout';

/** Measure spotlight + tooltip layout for the current tour step target. */
export function measureTourStepLayout(
  step: ProductTourStep,
  tooltipH: number,
  scroll: boolean,
): TourLayout | null {
  const el = document.querySelector(`[data-tour="${step.id}"]`) as HTMLElement | null;
  if (!el) return null;

  if (scroll) {
    const tall = el.offsetHeight > window.innerHeight * 0.55;
    el.scrollIntoView({
      behavior: 'instant',
      block: tall ? 'nearest' : 'center',
      inline: 'nearest',
    });
  }

  const rect = getTourTargetBounds(el);
  if (!rect) return null;
  return computeTourLayout(rect, step, tooltipH);
}
