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
import {
  canProceedFromStep,
  getFlowCompletionStats,
  isFlowFullyAnswered,
} from './questionnaireCompletion';

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
  const { refreshUser, user } = useAuthStore();
  const profileGender = user?.profile?.gender;
  const [stepIndex, setStepIndex] = useState(0);
  const [furthestStepIndex, setFurthestStepIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [isSaving, setIsSaving] = useState(false);
  const navLockRef = useRef(false);
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

  const releaseNavLock = useCallback(() => {
    window.setTimeout(() => {
      navLockRef.current = false;
    }, 450);
  }, []);

  const steps = useMemo(
    () => getActiveStepsForFlow(flow, answers, language, profileGender),
    [flow, answers, language, profileGender],
  );
  const step = steps[stepIndex];
  const presentation = step ? getStepPresentation(step) : 'card';
  const sectionOrder = FLOW_SECTION_ORDER[flow];

  const progressPct = useMemo(
    () => getFlowCompletionStats(answers, flow, language).percent,
    [answers, flow, language],
  );

  useEffect(() => {
    setError(null);
  }, [step?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const state = await loadQuestionnaireState(flow);
      if (cancelled) return;
      const active = getActiveStepsForFlow(flow, state.answers, language, state.profile?.gender);
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
      let result: Awaited<ReturnType<typeof persistQuestionnaireProgress>>;
      try {
        result = await persistQuestionnaireProgress(flow, nextAnswers, index, stepId);
      } catch {
        saveOnboardingBackup(nextAnswers, index);
        if (!opts?.quiet) {
          setSaveHint(t('onboarding.offlineHint'));
          setTimeout(() => setSaveHint(null), 3000);
        }
        setError(t('onboarding.offlineHint'));
        return false;
      }
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
    if (navLockRef.current) return;
    navLockRef.current = true;

    const currentAnswers = mergePendingAnswers(pending);
    const currentIndex = stepIndexRef.current;
    const activeSteps = getActiveStepsForFlow(flow, currentAnswers, language, profileGender);
    const currentStep = activeSteps[currentIndex];
    const photosIdx = activeSteps.findIndex((s) => s.id === 'progressPhotos');
    const mustVisitPhotos =
      currentStep?.id === 'inbodyScan' && photosIdx > currentIndex;
    let last = currentIndex >= activeSteps.length - 1;

    if (mustVisitPhotos) {
      last = false;
    }

    if (!last) {
      const nextIndex = mustVisitPhotos ? photosIdx : currentIndex + 1;
      saveOnboardingBackup(currentAnswers, nextIndex);
      setStepIndex(nextIndex);
      setFurthestStepIndex((prev) => {
        const furthest = Math.max(prev, nextIndex);
        furthestStepIndexRef.current = furthest;
        return furthest;
      });
      void flushSave(currentAnswers, nextIndex, currentStep?.id, { quiet: true });
      releaseNavLock();
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (!isFlowFullyAnswered(currentAnswers, flow, language)) {
        const result = await persistQuestionnaireProgress(
          flow,
          currentAnswers,
          currentIndex,
          currentStep?.id,
        );
        if (!result.ok) {
          setError(result.error ?? 'Failed to save');
          return;
        }
        setError(t('onboarding.questionnaire.incompleteHint'));
        return;
      }

      if (flow === 'wellness') {
        setError(
          language === 'ar'
            ? 'جاري توليد خطتك المخصصة (Claude) — قد يستغرق بضع دقائق…'
            : 'Generating your personalized plan (Claude) — this may take a few minutes…',
        );
      }

      const result = await persistQuestionnaireComplete(flow, currentAnswers, language);

      if (!result.ok) {
        setError(result.error ?? (language === 'ar' ? 'تعذّر حفظ الاستبيان' : 'Failed to save'));
        return;
      }

      if (flow === 'wellness' && result.planReady === false) {
        setError(
          language === 'ar'
            ? 'تم الحفظ. الخطة ما زالت تُولَّد — ستظهر في لوحة التحكم خلال دقيقة.'
            : 'Saved. Your plan is still generating — it will appear on the dashboard shortly.',
        );
      } else {
        setError(null);
      }

      clearOnboardingBackup();
      await refreshUser();
      navigate(completeTo, { replace: true });
    } finally {
      setIsSaving(false);
      releaseNavLock();
    }
  }, [flow, flushSave, language, mergePendingAnswers, navigate, profileGender, refreshUser, completeTo, t, releaseNavLock]);

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
    const currentAnswers = answersRef.current;
    const activeSteps = getActiveStepsForFlow(flow, currentAnswers, language, profileGender);
    const currentStep = activeSteps[currentIndex];

    if (currentIndex < furthest) {
      const nextIndex = Math.min(currentIndex + 1, furthest, activeSteps.length - 1);
      saveOnboardingBackup(currentAnswers, nextIndex);
      setStepIndex(nextIndex);
      void flushSave(currentAnswers, nextIndex, currentStep?.id, { quiet: true });
      return;
    }

    if (currentStep && canProceedFromStep(currentStep, currentAnswers)) {
      void goNext();
    }
  }, [flow, flushSave, goNext, language, profileGender]);

  const canWizardGoBack = stepIndex > 0 || restartFromStart;
  const canWizardGoForward =
    stepIndex < furthestStepIndex ||
    (step ? canProceedFromStep(step, answers) : false);
  const backToProfileLabel =
    restartFromStart && stepIndex === 0 ? t('profile.dossier.backToProfile') : undefined;

  const skipAll = useCallback(async () => {
    if (!allowSkipAll) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setIsSaving(true);
    try {
      const result = await persistQuestionnaireAbandoned(
        flow,
        answersRef.current,
        stepIndexRef.current,
        step?.id,
      );
      if (!result.ok) {
        setError(result.error ?? 'Failed to save');
        return;
      }
      clearOnboardingBackup();
      await refreshUser();
      navigate(completeTo, { replace: true });
    } finally {
      setIsSaving(false);
    }
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
      continueLoading={isSaving}
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
      step={step}
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
