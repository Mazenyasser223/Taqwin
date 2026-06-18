import { create } from 'zustand';
import type { ProductTourStep } from '../lib/productTour/types';

export const APP_ONBOARDING_TOUR_ID = 'app-onboarding-v6';
export const GYM_ONBOARDING_TOUR_ID = 'gym-onboarding-v6';

interface AppTourState {
  open: boolean;
  stepIndex: number;
  transitioning: boolean;
  steps: ProductTourStep[];
  replayNonce: number;
  setSteps: (steps: ProductTourStep[]) => void;
  setOpen: (open: boolean) => void;
  setStepIndex: (index: number) => void;
  setTransitioning: (transitioning: boolean) => void;
  resetIndex: () => void;
  requestReplay: () => void;
}

export const useAppTourStore = create<AppTourState>((set) => ({
  open: false,
  stepIndex: 0,
  transitioning: false,
  steps: [],
  replayNonce: 0,
  setSteps: (steps) => set({ steps }),
  setOpen: (open) => set({ open }),
  setStepIndex: (stepIndex) => set({ stepIndex }),
  setTransitioning: (transitioning) => set({ transitioning }),
  resetIndex: () => set({ stepIndex: 0 }),
  requestReplay: () =>
    set((s) => ({
      replayNonce: s.replayNonce + 1,
      open: false,
      stepIndex: 0,
      transitioning: false,
    })),
}));
