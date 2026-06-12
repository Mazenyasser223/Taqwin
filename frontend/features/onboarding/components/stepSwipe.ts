import type { PointerEvent as ReactPointerEvent } from 'react';

/** Prevent the questionnaire step swipe-drag layer from capturing button presses. */
export function stopStepSwipe(e: ReactPointerEvent) {
  e.stopPropagation();
}
