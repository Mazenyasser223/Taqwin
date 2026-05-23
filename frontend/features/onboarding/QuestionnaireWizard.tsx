import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { clearOnboardingBackup } from '../../services/onboardingStorage';
import { getActiveStepsForFlow } from './flows';
import type { OnboardingAnswers, OnboardingSection, CatalogPickItem } from './types';
import { FLOW_SECTION_ORDER, FLOW_META, type QuestionnaireFlowId } from './flows/types';
import { OnboardingShell } from './components/OnboardingShell';
import { OnboardingCardShell } from './components/OnboardingCardShell';
import { OnboardingChatShell } from './components/OnboardingChatShell';
import { StepContent } from './components/StepContent';
import { buildChatHistory } from './buildChatHistory';
import { getStepPresentation } from './stepPresentation';
import {
  loadQuestionnaireState,
  persistQuestionnaireComplete,
  persistQuestionnaireProgress,
} from './persistQuestionnaire';

export interface QuestionnaireWizardProps {
  flow: QuestionnaireFlowId;
  /** Route after successful completion */
  completeTo: string;
  allowSkipAll?: boolean;
}

export const QuestionnaireWizard: React.FC<QuestionnaireWizardProps> = ({
  flow,
  completeTo,
  allowSkipAll = true,
}) => {
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

  const steps = useMemo(() => getActiveStepsForFlow(flow, answers, language), [flow, answers, language]);
  const step = steps[stepIndex];
  const presentation = step ? getStepPresentation(step) : 'card';
  const sectionOrder = FLOW_SECTION_ORDER[flow];

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
      const state = await loadQuestionnaireState(flow);
      if (cancelled) return;
      const active = getActiveStepsForFlow(flow, state.answers, language);
      const idx = Math.min(Math.max(0, state.stepIndex), active.length - 1);
      setAnswers(state.answers);
      setStepIndex(idx);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [flow, language]);

  const completedSections = useMemo(() => {
    const done = new Set<OnboardingSection>();
    const currentSection = step?.section;
    const currentIdx = currentSection ? sectionOrder.indexOf(currentSection) : 0;
    sectionOrder.forEach((sec, i) => {
      if (i < currentIdx) done.add(sec);
    });
    return done;
  }, [step?.section, sectionOrder]);

  const flushSave = useCallback(
    async (nextAnswers: OnboardingAnswers, index: number, stepId?: string) => {
      setSaveHint(t('onboarding.savingHint'));
      const result = await persistQuestionnaireProgress(flow, nextAnswers, index, stepId);
      if (result.ok) {
        setSaveHint(t('onboarding.savedHint'));
        setError(null);
      } else {
        setSaveHint(t('onboarding.offlineHint'));
        if (result.error) setError(result.error);
      }
      setTimeout(() => setSaveHint(null), 2000);
      return result.ok;
    },
    [flow, t],
  );

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
    (stepId: string, value: string | string[] | number | boolean | CatalogPickItem[]) => {
      setAnswers((prev) => {
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
    const activeSteps = getActiveStepsForFlow(flow, currentAnswers, language);
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
    const result = await persistQuestionnaireComplete(flow, currentAnswers);
    setIsSaving(false);

    if (!result.ok) {
      setError(result.error ?? 'Failed to save');
      return;
    }

    clearOnboardingBackup();
    await refreshUser();
    navigate(completeTo, { replace: true });
  }, [flow, flushSave, language, navigate, refreshUser, completeTo]);

  const goBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const skipAll = useCallback(async () => {
    if (!allowSkipAll) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setIsSaving(true);
    const result = await persistQuestionnaireComplete(flow, answersRef.current);
    setIsSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save');
      return;
    }
    clearOnboardingBackup();
    await refreshUser();
    navigate(completeTo, { replace: true });
  }, [allowSkipAll, flow, navigate, refreshUser, completeTo]);

  if (isLoading || !step) {
    return (
      <motion.div className="min-h-[100dvh] flex items-center justify-center bg-background text-muted">
        <p className="text-sm font-bold animate-pulse">{t('onboarding.loading')}</p>
      </motion.div>
    );
  }

  const flowTitle = FLOW_META[flow].titleAr;

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

  const skipProps = allowSkipAll
    ? {
        onSkipStep: () => void goNext(),
        onSkipAll: () => void skipAll(),
        skipDisabled: isSaving,
      }
    : {};

  if (presentation === 'card') {
    return (
      <OnboardingCardShell
        onBack={goBack}
        canGoBack={stepIndex > 0}
        subtitle={flowTitle}
        {...skipProps}
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
        canGoBack={stepIndex > 0}
        input={
          <>
            {stepContent}
            {statusFooter}
          </>
        }
        {...skipProps}
      />
    );
  }

  return (
    <OnboardingShell
      section={step.section}
      completedSections={completedSections}
      sectionOrder={sectionOrder}
      onBack={goBack}
      canGoBack={stepIndex > 0}
      showHero3D={false}
      headerTitle={flowTitle}
      {...skipProps}
    >
      {stepContent}
      {statusFooter}
    </OnboardingShell>
  );
};
