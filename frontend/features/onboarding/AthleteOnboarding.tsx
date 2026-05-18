import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { clearOnboardingBackup } from '../../services/onboardingStorage';
import { getActiveSteps } from './athleteSteps';
import type { OnboardingAnswers, OnboardingSection } from './types';
import { SECTION_ORDER } from './types';
import { OnboardingShell } from './components/OnboardingShell';
import { StepContent } from './components/StepContent';
import {
  loadOnboardingState,
  persistOnboardingComplete,
  persistOnboardingProgress,
} from './persistOnboarding';

export const AthleteOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { refreshUser } = useAuthStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef(answers);
  const stepIndexRef = useRef(stepIndex);

  answersRef.current = answers;
  stepIndexRef.current = stepIndex;

  const steps = useMemo(() => getActiveSteps(answers), [answers]);
  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const state = await loadOnboardingState();
      if (cancelled) return;
      const activeSteps = getActiveSteps(state.answers);
      const idx = Math.min(Math.max(0, state.stepIndex), activeSteps.length - 1);
      setAnswers(state.answers);
      setStepIndex(idx);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completedSections = useMemo(() => {
    const done = new Set<OnboardingSection>();
    const currentSection = step?.section;
    const currentIdx = currentSection ? SECTION_ORDER.indexOf(currentSection) : 0;
    SECTION_ORDER.forEach((sec, i) => {
      if (i < currentIdx) done.add(sec);
    });
    return done;
  }, [step?.section]);

  const flushSave = useCallback(async (nextAnswers: OnboardingAnswers, index: number, stepId?: string) => {
    setSaveHint('Savingâ€¦');
    const result = await persistOnboardingProgress(nextAnswers, index, stepId);
    if (result.ok) {
      setSaveHint('Saved');
      setError(null);
    } else {
      setSaveHint('Saved locally â€” will sync when online');
      if (result.error) setError(result.error);
    }
    setTimeout(() => setSaveHint(null), 2000);
    return result.ok;
  }, []);

  const scheduleSave = useCallback(
    (nextAnswers: OnboardingAnswers, index: number, stepId?: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void flushSave(nextAnswers, index, stepId);
      }, 400);
    },
    [flushSave],
  );

  const setAnswer = useCallback(
    (stepId: string, value: string | string[] | number | boolean) => {
      setAnswers(prev => {
        const next = { ...prev, [stepId]: value };
        scheduleSave(next, stepIndexRef.current, stepId);
        return next;
      });
    },
    [scheduleSave],
  );

  const goNext = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);

    const currentAnswers = answersRef.current;
    const currentIndex = stepIndexRef.current;
    const activeSteps = getActiveSteps(currentAnswers);
    const currentStep = activeSteps[currentIndex];
    const last = currentIndex >= activeSteps.length - 1;

    if (!last) {
      const nextIndex = currentIndex + 1;
      await flushSave(currentAnswers, nextIndex, currentStep?.id);
      setStepIndex(nextIndex);
      return;
    }

    setIsSaving(true);
    setError(null);
    const result = await persistOnboardingComplete(currentAnswers);
    setIsSaving(false);

    if (!result.ok) {
      setError(result.error ?? 'Failed to save your profile');
      return;
    }

    clearOnboardingBackup();
    await refreshUser();
    navigate('/dashboard');
  }, [flushSave, isLast, navigate, refreshUser]);

  const goBack = () => {
    if (stepIndex > 0) setStepIndex(i => i - 1);
  };

  if (isLoading || !step) {
    return (
      <motion.div className="min-h-[100dvh] flex items-center justify-center bg-background text-muted">
        <p className="text-sm font-bold animate-pulse">{t('onboarding.loading')}</p>
      </motion.div>
    );
  }

  const showHero3D = step.section === 'pre' && stepIndex <= 1;

  return (
    <OnboardingShell
      section={step.section}
      completedSections={completedSections}
      onBack={goBack}
      canGoBack={stepIndex > 0 && step.type !== 'generating'}
      showHero3D={showHero3D && step.type !== 'hero'}
    >
      <AnimatePresence mode="wait">
        <StepContent
          key={step.id}
          step={step}
          answers={answers}
          onAnswer={setAnswer}
          onContinue={goNext}
        />
      </AnimatePresence>

      {saveHint && (
        <p className="text-faint text-xs text-center mt-2">{saveHint}</p>
      )}
      {error && (
        <p className="text-red-400 text-sm text-center mt-4 px-4">{error}</p>
      )}
      {isSaving && (
        <p className="text-primary text-sm text-center mt-4 animate-pulse">Saving your profileâ€¦</p>
      )}

      {stepIndex > 0 && (
        <div className="text-center pt-6 pb-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="text-xs text-faint hover:text-muted font-bold"
          >
            Skip for now
          </button>
        </div>
      )}
    </OnboardingShell>
  );
};
