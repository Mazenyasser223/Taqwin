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
import { OnboardingCardShell } from './components/OnboardingCardShell';
import { OnboardingChatShell } from './components/OnboardingChatShell';
import { StepContent } from './components/StepContent';
import { buildChatHistory } from './buildChatHistory';
import { getStepPresentation } from './stepPresentation';
import {
  loadOnboardingState,
  persistOnboardingComplete,
  persistOnboardingProgress,
  persistOnboardingSkip,
} from './persistOnboarding';

export const AthleteOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useI18n();
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

  const steps = useMemo(() => getActiveSteps(answers, 'ar'), [answers]);
  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;
  const presentation = step ? getStepPresentation(step) : 'hero';

  const progressPct = useMemo(
    () => Math.round(((stepIndex + 1) / Math.max(steps.length, 1)) * 100),
    [stepIndex, steps.length],
  );

  const chatHistory = useMemo(
    () => buildChatHistory(steps, stepIndex, answers),
    [steps, stepIndex, answers],
  );

  const currentCoachMessage = useMemo(() => {
    if (!step || presentation !== 'chat') return undefined;
    if ('chatMessage' in step && step.chatMessage) return step.chatMessage;
    if (step.type === 'likert') return step.statement;
    return step.title;
  }, [step, presentation]);

  const currentCoachImageUrl = useMemo(() => {
    if (!step || presentation !== 'chat') return undefined;
    return 'chatImageUrl' in step ? step.chatImageUrl : undefined;
  }, [step, presentation]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const state = await loadOnboardingState();
      if (cancelled) return;
      const activeSteps = getActiveSteps(state.answers, 'ar');
      const idx = Math.min(Math.max(0, state.stepIndex), activeSteps.length - 1);
      setAnswers(state.answers);
      setStepIndex(idx);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [language]);

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
    setSaveHint(t('onboarding.savingHint'));
    const result = await persistOnboardingProgress(nextAnswers, index, stepId);
    if (result.ok) {
      setSaveHint(t('onboarding.savedHint'));
      setError(null);
    } else {
      setSaveHint(t('onboarding.offlineHint'));
      if (result.error) setError(result.error);
    }
    setTimeout(() => setSaveHint(null), 2000);
    return result.ok;
  }, [t]);

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
    const activeSteps = getActiveSteps(currentAnswers, 'ar');
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
  }, [flushSave, language, navigate, refreshUser]);

  const goBack = () => {
    if (stepIndex > 0) setStepIndex(i => i - 1);
  };

  const skipAll = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setIsSaving(true);
    setError(null);
    const result = await persistOnboardingSkip(answersRef.current);
    setIsSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save your profile');
      return;
    }
    clearOnboardingBackup();
    await refreshUser();
    navigate('/dashboard');
  }, [navigate, refreshUser]);

  if (isLoading || !step) {
    return (
      <motion.div className="min-h-[100dvh] flex items-center justify-center bg-background text-muted">
        <p className="text-sm font-bold animate-pulse">{t('onboarding.loading')}</p>
      </motion.div>
    );
  }

  const stepContent = (
    <AnimatePresence mode="wait">
      <StepContent
        key={step.id}
        step={step}
        answers={answers}
        mode={presentation}
        onAnswer={setAnswer}
        onContinue={goNext}
      />
    </AnimatePresence>
  );

  const statusFooter = (
    <>
      {saveHint && <p className="text-faint text-xs text-center mt-2">{saveHint}</p>}
      {error && <p className="text-red-400 text-sm text-center mt-4 px-4">{error}</p>}
      {isSaving && (
        <p className="text-primary text-sm text-center mt-4 animate-pulse">{t('onboarding.saving')}</p>
      )}
    </>
  );

  if (presentation === 'card') {
    return (
      <OnboardingCardShell
        onBack={goBack}
        canGoBack={stepIndex > 0}
        subtitle={t('onboarding.card.subtitle')}
        onSkipStep={step.type !== 'generating' ? () => void goNext() : undefined}
        onSkipAll={step.type !== 'generating' ? () => void skipAll() : undefined}
        skipDisabled={isSaving}
      >
        {stepContent}
        {statusFooter}
      </OnboardingCardShell>
    );
  }

  if (presentation === 'chat') {
    return (
      <OnboardingChatShell
        progressPct={progressPct}
        chatHistory={chatHistory}
        currentCoachMessage={currentCoachMessage}
        currentCoachImageUrl={currentCoachImageUrl}
        onBack={goBack}
        canGoBack={stepIndex > 0 && step.type !== 'generating'}
        input={
          <>
            {stepContent}
            {statusFooter}
          </>
        }
        onSkipStep={step.type !== 'generating' ? () => void goNext() : undefined}
        onSkipAll={step.type !== 'generating' ? () => void skipAll() : undefined}
        skipDisabled={isSaving}
      />
    );
  }

  const showHero3D = step.section === 'welcome' && stepIndex <= 1;
  const canSkip = step.type !== 'generating';

  return (
    <OnboardingShell
      section={step.section}
      completedSections={completedSections}
      onBack={goBack}
      canGoBack={stepIndex > 0 && step.type !== 'generating'}
      showHero3D={showHero3D && step.type !== 'hero'}
      onSkipStep={canSkip ? () => void goNext() : undefined}
      onSkipAll={canSkip ? () => void skipAll() : undefined}
      skipDisabled={isSaving}
    >
      {stepContent}
      {statusFooter}
    </OnboardingShell>
  );
};
