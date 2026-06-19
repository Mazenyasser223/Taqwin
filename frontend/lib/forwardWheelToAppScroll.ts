import type { WheelEvent } from 'react';

/** Recharts captures wheel events; forward them to the app main scroller. */
export function forwardWheelToAppScroll(e: WheelEvent<HTMLElement>) {
  const scroller = e.currentTarget.closest('.app-scroll');
  if (!(scroller instanceof HTMLElement)) return;
  scroller.scrollTop += e.deltaY;
  e.preventDefault();
}
