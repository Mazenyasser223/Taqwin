import React, { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import type { UserRole } from '../../types';
import { isTourDone, markTourDone, resetTour } from '../../lib/productTour/storage';
import { tourRouteMatches } from '../../lib/productTour/routeMatch';
import { waitForTourTarget } from '../../lib/productTour/waitForTourTarget';
import {
  APP_ONBOARDING_TOUR_ID,
  GYM_ONBOARDING_TOUR_ID,
  useAppTourStore,
} from '../../store/useAppTourStore';
import { athleteAppTourSteps } from './appTourSteps';
import { gymAppTourSteps } from './gymAppTourSteps';
import { prepareTourStep } from './prepareTourStep';
import { scrollTourTargetIntoView, waitForTourScrollPaint } from '../../lib/productTour/scrollTourTarget';
import { ProductTourOverlay } from './ProductTourOverlay';

const BLOCKED_PREFIXES = ['/login', '/auth', '/onboarding'];

function isTourBlockedPath(pathname: string): boolean {
  return BLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function tourConfigForRole(role: UserRole | undefined) {
  if (role === 'athlete') {
    return {
      steps: athleteAppTourSteps,
      tourId: APP_ONBOARDING_TOUR_ID,
      startPaths: ['/dashboard'],
    };
  }
  if (role === 'gym') {
    return {
      steps: gymAppTourSteps,
      tourId: GYM_ONBOARDING_TOUR_ID,
      startPaths: ['/owner/dashboard', '/dashboard', '/profile'],
    };
  }
  return null;
}

function isTourStartPath(pathname: string, startPaths: string[]) {
  return startPaths.some((route) => tourRouteMatches(pathname, route));
}

function stripTourQuery(navigate: ReturnType<typeof useNavigate>) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('tour') !== '1') return;
  params.delete('tour');
  const search = params.toString();
  navigate({ pathname: window.location.pathname, search: search ? `?${search}` : '' }, { replace: true });
}

export const AppTourHost: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const authHydrated = useAuthStore((s) => s.authHydrated);
  const location = useLocation();
  const navigate = useNavigate();
  const startedRef = useRef(false);
  const forceStartRef = useRef(false);
  const lastReplayRef = useRef(0);

  const open = useAppTourStore((s) => s.open);
  const stepIndex = useAppTourStore((s) => s.stepIndex);
  const transitioning = useAppTourStore((s) => s.transitioning);
  const steps = useAppTourStore((s) => s.steps);
  const replayNonce = useAppTourStore((s) => s.replayNonce);
  const setSteps = useAppTourStore((s) => s.setSteps);
  const setOpen = useAppTourStore((s) => s.setOpen);
  const setStepIndex = useAppTourStore((s) => s.setStepIndex);
  const setTransitioning = useAppTourStore((s) => s.setTransitioning);
  const resetIndex = useAppTourStore((s) => s.resetIndex);

  const config = tourConfigForRole(user?.role);

  useEffect(() => {
    if (!config) return;
    setSteps(config.steps);
  }, [config, setSteps]);

  const finish = useCallback(() => {
    if (!config) return;
    markTourDone(user?.id, config.tourId);
    startedRef.current = false;
    forceStartRef.current = false;
    setOpen(false);
    setTransitioning(false);
    resetIndex();
  }, [config, resetIndex, setOpen, setTransitioning, user?.id]);

  const goToStep = useCallback(
    async (nextIndex: number) => {
      const activeSteps = steps.length > 0 ? steps : (config?.steps ?? []);
      const step = activeSteps[nextIndex];
      if (!step) {
        setTransitioning(false);
        return;
      }

      setTransitioning(true);
      try {
        if (step.route && !tourRouteMatches(location.pathname, step.route)) {
          navigate(step.route);
          await new Promise((r) => window.setTimeout(r, 700));
        } else {
          await new Promise((r) => window.setTimeout(r, 80));
        }

        prepareTourStep(step);
        await waitForTourTarget(step.id, 12000);
        scrollTourTargetIntoView(step.id);
        await waitForTourScrollPaint();
        scrollTourTargetIntoView(step.id);
        await new Promise((r) => window.setTimeout(r, 120));
        setStepIndex(nextIndex);
      } finally {
        setTransitioning(false);
      }
    },
    [config?.steps, location.pathname, navigate, setStepIndex, setTransitioning, steps],
  );

  const goToStepRef = useRef(goToStep);
  goToStepRef.current = goToStep;

  const beginTour = useCallback(() => {
    if (!user || !config) return;
    resetTour(user.id, config.tourId);
    setSteps(config.steps);
    resetIndex();
    startedRef.current = true;
    setOpen(true);
    void goToStepRef.current(0);
  }, [config, resetIndex, setOpen, setSteps, user]);

  const onNext = useCallback(async () => {
    const activeSteps = steps.length > 0 ? steps : (config?.steps ?? []);
    if (stepIndex >= activeSteps.length - 1) {
      finish();
      return;
    }
    await goToStep(stepIndex + 1);
  }, [config?.steps, finish, goToStep, stepIndex, steps.length]);

  const onBack = useCallback(async () => {
    if (stepIndex <= 0) return;
    await goToStep(stepIndex - 1);
  }, [goToStep, stepIndex]);

  const onSkip = useCallback(() => {
    finish();
  }, [finish]);

  useEffect(() => {
    if (!authHydrated || !user || !config) return;
    if (isTourBlockedPath(location.pathname)) return;

    const forceStart = new URLSearchParams(location.search).get('tour') === '1';

    if (forceStart) {
      if (forceStartRef.current) return;
      forceStartRef.current = true;
      resetTour(user.id, config.tourId);
      setSteps(config.steps);
      resetIndex();
      startedRef.current = true;
      setOpen(true);
      void goToStepRef.current(0).finally(() => stripTourQuery(navigate));
      return;
    }

    if (replayNonce > 0 && replayNonce !== lastReplayRef.current) {
      lastReplayRef.current = replayNonce;
      resetTour(user.id, config.tourId);
      setSteps(config.steps);
      resetIndex();
      startedRef.current = true;
      setOpen(true);
      void goToStepRef.current(0);
      return;
    }

    if (isTourDone(user.id, config.tourId)) return;

    const { open: tourOpen, stepIndex: currentStep } = useAppTourStore.getState();
    if (tourOpen || currentStep > 0) return;

    if (!isTourStartPath(location.pathname, config.startPaths)) return;
    if (startedRef.current) return;

    const timer = window.setTimeout(() => {
      if (isTourDone(user.id, config.tourId)) return;
      const state = useAppTourStore.getState();
      if (state.open || state.stepIndex > 0) return;
      beginTour();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    authHydrated,
    beginTour,
    config,
    location.pathname,
    location.search,
    navigate,
    replayNonce,
    user,
  ]);

  if (!user || !config) return null;

  const effectiveSteps = steps.length > 0 ? steps : config.steps;
  if (effectiveSteps.length === 0) return null;

  return (
    <ProductTourOverlay
      open={open}
      steps={effectiveSteps}
      stepIndex={stepIndex}
      transitioning={transitioning}
      onNext={() => void onNext()}
      onBack={() => void onBack()}
      onSkip={onSkip}
    />
  );
};
