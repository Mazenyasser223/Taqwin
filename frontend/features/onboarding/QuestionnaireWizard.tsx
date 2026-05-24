import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { clearOnboardingBackup, saveOnboardingBackup } from '../../services/onboardingStorage';
import { getActiveStepsForFlow } from './flows';
import type { OnboardingAnswers, OnboardingSection, CatalogPickItem } from './types';
import { FLOW_SECTION_ORDER, FLOW_META, type QuestionnaireFlowId } from './flows/types';
import { OnboardingShell } from './components/OnboardingShell';
import { QuestionnaireStepShell } from './components/QuestionnaireStepShell';
import { StepContent } from './components/StepContent';
import { getStepPresentation } from './stepPresentation';
import {
  loadQuestionnaireState,
  persistQuestionnaireAbandoned,
  persistQuestionnaireComplete,
  persistQuestionnaireProgress,
} from './persistQuestionnaire';
import { getFlowCompletionStats, isFlowFullyAnswered } from './questionnaireCompletion';

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
  const [searchParams] = useSearchParams();
  const restartFromStart =
    searchParams.get('restart') === '1' || searchParams.get('restart') === 'true';
  const editStepId = restartFromStart ? null : searchParams.get('step');
  const { t, language } = useI18n();
  const { refreshUser } = useAuthStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [furthestStepIndex, setFurthestStepIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef(answers);
  const stepIndexRef = useRef(stepIndex);
  const furthestStepIndexRef = useRef(furthestStepIndex);

  answersRef.current = answers;
  stepIndexRef.current = stepIndex;
  furthestStepIndexRef.current = furthestStepIndex;

  const steps = useMemo(() => getActiveStepsForFlow(flow, answers, language), [flow, answers, language]);
  const step = steps[stepIndex];
  const presentation = step ? getStepPresentation(step) : 'card';
  const sectionOrder = FLOW_SECTION_ORDER[flow];

  const progressPct = useMemo(
    () => getFlowCompletionStats(answers, flow, language).percent,
    [answers, flow, language],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const state = await loadQuestionnaireState(flow);
      if (cancelled) return;
      const active = getActiveStepsForFlow(flow, state.answers, language);
      const savedProgress = restartFromStart
        ? 0
        : Math.min(Math.max(0, state.stepIndex), Math.max(0, active.length - 1));
      let idx = savedProgress;
      if (!restartFromStart && editStepId) {
        const stepIdx = active.findIndex((s) => s.id === editStepId);
        if (stepIdx >= 0) idx = stepIdx;
      }
      setAnswers(state.answers);
      setStepIndex(idx);
      setFurthestStepIndex(savedProgress);
      furthestStepIndexRef.current = savedProgress;
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [flow, language, editStepId, restartFromStart]);

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
    async (
      nextAnswers: OnboardingAnswers,
      index: number,
      stepId?: string,
      opts?: { quiet?: boolean },
    ) => {
      if (!opts?.quiet) setSaveHint(t('onboarding.savingHint'));
      const result = await persistQuestionnaireProgress(flow, nextAnswers, index, stepId);
      if (result.ok) {
        if (!opts?.quiet) {
          setSaveHint(t('onboarding.savedHint'));
          setTimeout(() => setSaveHint(null), 2000);
        } else {
          setSaveHint(null);
        }
        setError(null);
      } else {
        if (!opts?.quiet) {
          setSaveHint(t('onboarding.offlineHint'));
          setTimeout(() => setSaveHint(null), 2000);
        }
        if (result.error) setError(result.error);
      }
      return result.ok;
    },
    [flow, t],
  );

  const scheduleSave = useCallback(
    (nextAnswers: OnboardingAnswers, index: number, stepId?: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void flushSave(nextAnswers, index, stepId, { quiet: true });
      }, 400);
    },
    [flushSave],
  );

  const setAnswer = useCallback(
    (stepId: string, value: string | string[] | number | boolean | CatalogPickItem[]) => {
      setAnswers((prev) => {
        const next = { ...prev, [stepId]: value };
        answersRef.current = next;
        scheduleSave(next, stepIndexRef.current, stepId);
        return next;
      });
    },
    [scheduleSave],
  );

  const mergePendingAnswers = useCallback((pending?: OnboardingAnswers): OnboardingAnswers => {
    if (!pending || Object.keys(pending).length === 0) return answersRef.current;
    const next = { ...answersRef.current, ...pending };
    answersRef.current = next;
    setAnswers(next);
    return next;
  }, []);

  const goNext = useCallback(async (pending?: OnboardingAnswers) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);

    const currentAnswers = mergePendingAnswers(pending);
    const currentIndex = stepIndexRef.current;
    const activeSteps = getActiveStepsForFlow(flow, currentAnswers, language);
    const currentStep = activeSteps[currentIndex];
    const last = currentIndex >= activeSteps.length - 1;

    if (!last) {
      const nextIndex = currentIndex + 1;
      saveOnboardingBackup(currentAnswers, nextIndex);
      setStepIndex(nextIndex);
      setFurthestStepIndex((prev) => {
        const furthest = Math.max(prev, nextIndex);
        furthestStepIndexRef.current = furthest;
        return furthest;
      });
      void flushSave(currentAnswers, nextIndex, currentStep?.id, { quiet: true });
      return;
    }

    setIsSaving(true);
    setError(null);

    if (!isFlowFullyAnswered(currentAnswers, flow, language)) {
      const result = await persistQuestionnaireProgress(
        flow,
        currentAnswers,
        currentIndex,
        currentStep?.id,
      );
      setIsSaving(false);
      if (!result.ok) {
        setError(result.error ?? 'Failed to save');
        return;
      }
      setError(t('onboarding.questionnaire.incompleteHint'));
      return;
    }

    const result = await persistQuestionnaireComplete(flow, currentAnswers, language);
    setIsSaving(false);

    if (!result.ok) {
      setError(result.error ?? 'Failed to save');
      return;
    }

    clearOnboardingBackup();
    await refreshUser();
    navigate(completeTo, { replace: true });
  }, [flow, flushSave, language, mergePendingAnswers, navigate, refreshUser, completeTo]);

  const handleBack = useCallback(() => {
    if (stepIndexRef.current > 0) {
      setStepIndex((i) => i - 1);
      return;
    }
    if (restartFromStart) {
      navigate('/profile');
    }
  }, [restartFromStart, navigate]);

  const handleForward = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);

    const currentIndex = stepIndexRef.current;
    const furthest = furthestStepIndexRef.current;
    if (currentIndex >= furthest) return;

    const currentAnswers = answersRef.current;
    const activeSteps = getActiveStepsForFlow(flow, currentAnswers, language);
    const nextIndex = Math.min(currentIndex + 1, furthest, activeSteps.length - 1);
    const currentStep = activeSteps[currentIndex];

    saveOnboardingBackup(currentAnswers, nextIndex);
    setStepIndex(nextIndex);
    void flushSave(currentAnswers, nextIndex, currentStep?.id, { quiet: true });
  }, [flow, flushSave, language]);

  const canWizardGoBack = stepIndex > 0 || restartFromStart;
  const canWizardGoForward = stepIndex < furthestStepIndex;
  const backToProfileLabel =
    restartFromStart && stepIndex === 0 ? t('profile.dossier.backToProfile') : undefined;

  const skipAll = useCallback(async () => {
    if (!allowSkipAll) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setIsSaving(true);
    const result = await persistQuestionnaireAbandoned(
      flow,
      answersRef.current,
      stepIndexRef.current,
      step?.id,
    );
    setIsSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save');
      return;
    }
    clearOnboardingBackup();
    await refreshUser();
    navigate(completeTo, { replace: true });
  }, [allowSkipAll, flow, navigate, refreshUser, completeTo, step?.id]);

  if (isLoading || !step) {
    return (
      <motion.div className="min-h-[100dvh] flex items-center justify-center bg-background text-muted">
        <p className="text-sm font-bold animate-pulse">{t('onboarding.loading')}</p>
      </motion.div>
    );
  }

  const flowTitle = FLOW_META[flow].titleAr;

  const stepContent = (
    <StepContent
      key={step.id}
      step={step}
      answers={answers}
      mode={presentation === 'hero' ? 'hero' : 'card'}
      onAnswer={setAnswer}
      onContinue={goNext}
    />
  );

  const statusFooter = (
    <>
      {saveHint && <p className="text-faint text-xs text-center">{saveHint}</p>}
      {error && <p className="text-red-400 text-sm text-center px-2">{error}</p>}
      {isSaving && (
        <p className="text-primary text-sm text-center animate-pulse">{t('onboarding.saving')}</p>
      )}
    </>
  );

  const skipProps = allowSkipAll
    ? {
        onSkipStep: () => {
          const currentStep = steps[stepIndexRef.current];
          if (currentStep) {
            setAnswers((prev) => {
              const prevSkipped = Array.isArray(prev.skippedSteps)
                ? (prev.skippedSteps as string[])
                : [];
              if (prevSkipped.includes(currentStep.id)) return prev;
              const next = {
                ...prev,
                skippedSteps: [...prevSkipped, currentStep.id],
              };
              answersRef.current = next;
              scheduleSave(next, stepIndexRef.current, currentStep.id);
              return next;
            });
          }
          void goNext();
        },
        onSkipAll: () => void skipAll(),
        skipDisabled: isSaving,
      }
    : {};

  if (presentation === 'hero') {
    return (
      <OnboardingShell
        section={step.section}
        completedSections={completedSections}
        sectionOrder={sectionOrder}
        onBack={handleBack}
        canGoBack={canWizardGoBack}
        showHero3D={false}
        headerTitle={flowTitle}
        backLabel={backToProfileLabel}
        {...skipProps}
      >
        {stepContent}
        {statusFooter}
      </OnboardingShell>
    );
  }

  return (
    <QuestionnaireStepShell
      flow={flow}
      progressPct={progressPct}
      stepIndex={stepIndex}
      totalSteps={steps.length}
      stepKey={step.id}
      onBack={handleBack}
      canGoBack={canWizardGoBack}
      onForward={handleForward}
      canGoForward={canWizardGoForward}
      backLabel={backToProfileLabel}
      onSwipeNext={() => void goNext()}
      footer={statusFooter}
      {...skipProps}
    >
      {stepContent}
    </QuestionnaireStepShell>
  );
};
