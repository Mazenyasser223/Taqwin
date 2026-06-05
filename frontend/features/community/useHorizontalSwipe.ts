import { useRef } from 'react';

const SWIPE_THRESHOLD = 48;
const MAX_MS = 450;

type SwipeHandlers = {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
};

export function useHorizontalSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  enabled = true,
): SwipeHandlers {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 1) return;
      start.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        t: Date.now(),
      };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!enabled || !start.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.current.x;
      const dy = touch.clientY - start.current.y;
      const dt = Date.now() - start.current.t;
      start.current = null;

      if (dt > MAX_MS) return;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (Math.abs(dy) > Math.abs(dx)) return;

      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    },
  };
}
