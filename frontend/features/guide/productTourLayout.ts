import type { ProductTourStep } from '../../lib/productTour/types';

const SPOTLIGHT_PAD = 10;
const VIEWPORT_MARGIN = 16;
const GAP = 12;

export type ResolvedPlacement = 'top' | 'bottom' | 'left' | 'right';

export type TourLayout = {
  rect: DOMRect;
  spotlight: { top: number; left: number; width: number; height: number };
  tooltip: { top: number; left: number; width: number };
  placement: ResolvedPlacement;
  arrow: { top: number; left: number; rotate: number };
  mobileSheet: boolean;
};

type Bounds = { top: number; left: number; width: number; height: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function tooltipWidth(viewportW: number) {
  if (viewportW < 640) return viewportW - 24;
  if (viewportW < 1280) return Math.min(360, viewportW - 32);
  return Math.min(392, viewportW - 48);
}

/** Layout bounds correcting for CSS scale transforms (e.g. framer-motion reveal). */
export function getTourTargetBounds(el: HTMLElement): DOMRect | null {
  const rect = el.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (w <= 0 || h <= 0) return null;
  if (rect.width <= 1 || rect.height <= 1) return null;

  const scaleX = rect.width / w;
  const scaleY = rect.height / h;
  if (Math.abs(scaleX - 1) <= 0.02 && Math.abs(scaleY - 1) <= 0.02) return rect;

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return new DOMRect(cx - w / 2, cy - h / 2, w, h);
}

/** Spotlight wraps the full tour target with a small inset pad. */
function focusSpotlight(target: DOMRect): Bounds {
  return {
    top: target.top - SPOTLIGHT_PAD,
    left: target.left - SPOTLIGHT_PAD,
    width: target.width + SPOTLIGHT_PAD * 2,
    height: target.height + SPOTLIGHT_PAD * 2,
  };
}

function fits(
  placement: ResolvedPlacement,
  bounds: Bounds,
  tooltipW: number,
  tooltipH: number,
  vw: number,
  vh: number,
) {
  const bottom = bounds.top + bounds.height;
  const right = bounds.left + bounds.width;
  const m = VIEWPORT_MARGIN;
  if (placement === 'bottom') {
    return bottom + GAP + tooltipH <= vh - m;
  }
  if (placement === 'top') {
    return bounds.top - GAP - tooltipH >= m;
  }
  if (placement === 'right') {
    return right + GAP + tooltipW <= vw - m;
  }
  return bounds.left - GAP - tooltipW >= m;
}

function pickPlacement(
  preferred: ResolvedPlacement,
  bounds: Bounds,
  tooltipW: number,
  tooltipH: number,
  vw: number,
  vh: number,
): ResolvedPlacement {
  const order: ResolvedPlacement[] =
    preferred === 'left'
      ? ['left', 'right', 'bottom', 'top']
      : preferred === 'right'
        ? ['right', 'left', 'bottom', 'top']
        : preferred === 'top'
          ? ['top', 'bottom', 'left', 'right']
          : ['bottom', 'top', 'left', 'right'];

  for (const p of order) {
    if (fits(p, bounds, tooltipW, tooltipH, vw, vh)) return p;
  }
  return preferred;
}

export function computeTourLayout(
  target: DOMRect,
  step: ProductTourStep,
  tooltipH: number,
): TourLayout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tw = tooltipWidth(vw);
  const mobileSheet = vw < 640;

  const spotlight = focusSpotlight(target);

  if (mobileSheet) {
    const sheetH = Math.min(tooltipH + 28, vh * 0.38);
    return {
      rect: target,
      spotlight,
      tooltip: {
        top: vh - sheetH - VIEWPORT_MARGIN,
        left: VIEWPORT_MARGIN,
        width: vw - VIEWPORT_MARGIN * 2,
      },
      placement: 'top',
      arrow: { top: vh - sheetH - VIEWPORT_MARGIN - 6, left: vw / 2 - 6, rotate: 180 },
      mobileSheet: true,
    };
  }

  const preferred = step.placement ?? 'bottom';
  const placement = pickPlacement(preferred, spotlight, tw, tooltipH, vw, vh);

  let top = 0;
  let left = 0;
  let arrowTop = 0;
  let arrowLeft = 0;
  let arrowRotate = 0;

  const anchorX = spotlight.left + spotlight.width / 2;
  const anchorY = spotlight.top + spotlight.height / 2;

  if (placement === 'bottom') {
    top = spotlight.top + spotlight.height + GAP;
    left = anchorX - tw / 2;
    arrowTop = top - 6;
    arrowLeft = clamp(anchorX - 6, left + 20, left + tw - 32);
    arrowRotate = 0;
  } else if (placement === 'top') {
    top = spotlight.top - GAP - tooltipH;
    left = anchorX - tw / 2;
    arrowTop = top + tooltipH - 2;
    arrowLeft = clamp(anchorX - 6, left + 20, left + tw - 32);
    arrowRotate = 180;
  } else if (placement === 'left') {
    top = anchorY - tooltipH / 2;
    left = spotlight.left - GAP - tw;
    arrowTop = clamp(anchorY - 6, top + 20, top + tooltipH - 32);
    arrowLeft = left + tw - 2;
    arrowRotate = 90;
  } else {
    top = anchorY - tooltipH / 2;
    left = spotlight.left + spotlight.width + GAP;
    arrowTop = clamp(anchorY - 6, top + 20, top + tooltipH - 32);
    arrowLeft = left - 6;
    arrowRotate = -90;
  }

  return {
    rect: target,
    spotlight,
    tooltip: {
      top: clamp(top, VIEWPORT_MARGIN, vh - tooltipH - VIEWPORT_MARGIN),
      left: clamp(left, VIEWPORT_MARGIN, vw - tw - VIEWPORT_MARGIN),
      width: tw,
    },
    placement,
    arrow: { top: arrowTop, left: arrowLeft, rotate: arrowRotate },
    mobileSheet: false,
  };
}
