import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { isTourDone, markTourDone } from '../../lib/productTour/storage';
import type { ProductTourStep } from '../../lib/productTour/types';

export function useProductTour(tourId: string, steps: ProductTourStep[], enabled: boolean) {
  const userId = useAuthStore((s) => s.user?.id);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!enabled || !userId || isTourDone(userId, tourId)) return undefined;
    const timer = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(timer);
  }, [enabled, tourId, userId]);

  const finish = useCallback(() => {
    markTourDone(userId, tourId);
    setOpen(false);
    setStepIndex(0);
  }, [tourId, userId]);

  const onNext = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [finish, stepIndex, steps.length]);

  const onBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const onSkip = useCallback(() => {
    finish();
  }, [finish]);

  const restart = useCallback(() => {
    setStepIndex(0);
    setOpen(true);
  }, []);

  return { open, stepIndex, onNext, onBack, onSkip, restart, finish };
}
