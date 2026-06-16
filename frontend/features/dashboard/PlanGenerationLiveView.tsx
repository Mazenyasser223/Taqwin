import React, { useCallback, useEffect, useRef, useState } from 'react';

import { motion } from 'framer-motion';

import { useI18n } from '../../lib/i18n/useI18n';

import type { AthletePersonalization } from '../../services/dashboardService';

import {

  clearPlanGenerationRequested,

  runOfficialPlanGeneration,

  type PlanGenTraceEvent,

  type PlanGenTraceStage,

} from '../../services/planGenerationPoll';

import { invalidateAthleteHomeCache } from '../../services/dashboardService';

import { emitDashboardRefresh } from './wellnessWidgets';

import { useAuthStore } from '../../store/useAuthStore';

import { usePlanGenerationSessionStore } from '../../store/usePlanGenerationSessionStore';

import { CoachTypingDots } from '../ai-chat/CoachTypingDots';

import { cn } from '../../lib/cn';

import type { TranslationKey } from '../../lib/i18n/translations';



const CARD =

  'rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]';



const PHASE_COUNT = 5;



const PHASE_KEYS: TranslationKey[] = [

  'dashboard.planGenPhase.profile',

  'dashboard.planGenPhase.macros',

  'dashboard.planGenPhase.workout',

  'dashboard.planGenPhase.nutrition',

  'dashboard.planGenPhase.finalize',

];



const STAGE_PHASE: Record<PlanGenTraceStage, number> = {

  check_existing: 0,

  sync_generate: 1,

  queue_generate: 2,

  poll_plan: 3,

  poll_job: 3,

  sync_fallback: 4,

  plan_ready: 4,

  failed: 4,

};



function interpolate(template: string, vars: Record<string, string | number>): string {

  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));

}



interface PlanGenerationLiveViewProps {

  personalization: AthletePersonalization;

  calorieTarget?: number;

  proteinTarget?: number;

  planGenerationRequestedAt?: string | null;

  onRefresh?: () => Promise<void>;

  onComplete?: () => void;

  className?: string;

}



export const PlanGenerationLiveView: React.FC<PlanGenerationLiveViewProps> = ({

  planGenerationRequestedAt,

  onRefresh,

  onComplete,

  className,

}) => {

  const { t, language } = useI18n();

  const isAr = language === 'ar';

  const refreshUser = useAuthStore((s) => s.refreshUser);

  const onRefreshRef = useRef(onRefresh);

  const onCompleteRef = useRef(onComplete);

  onRefreshRef.current = onRefresh;

  onCompleteRef.current = onComplete;



  const {

    startedAt,

    overallProgress,

    phaseDisplay,

    traceLines,

    activeTrace,

    done,

    failed,

    failureDetail,

    ensureStartedAt,

    bumpProgress,

    tickElapsed,

    setActiveTrace,

    appendTraceLine,

    setLastTraceKey,

    markDone,

    markFailed,

    reset,

  } = usePlanGenerationSessionStore();



  const [runId, setRunId] = useState(0);

  const [kickOff, setKickOff] = useState(false);

  const [elapsedSec, setElapsedSec] = useState(0);

  const handleTraceRef = useRef<(event: PlanGenTraceEvent) => void>(() => {});



  const formatTrace = useCallback(

    (event: PlanGenTraceEvent): string => {

      const key = `dashboard.planGenTrace.${event.messageKey}` as TranslationKey;

      const template = t(key);

      const line = event.vars ? interpolate(template, event.vars) : template;

      return event.detail ? `${line} — ${event.detail}` : line;

    },

    [t],

  );



  const handleTrace = useCallback(

    (event: PlanGenTraceEvent) => {

      const lastTraceKey = usePlanGenerationSessionStore.getState().lastTraceKey;

      const dedupeKey = `${event.stage}:${event.messageKey}:${event.vars?.attempt ?? ''}`;

      if (event.messageKey === 'pollPlan' && dedupeKey === lastTraceKey) {

        setActiveTrace(formatTrace(event));

        const phase = STAGE_PHASE[event.stage];

        bumpProgress(Math.min(99, 12 + phase * 18 + Number(event.vars?.attempt ?? 0)));

        return;

      }

      setLastTraceKey(dedupeKey);



      const text = formatTrace(event);

      setActiveTrace(text);



      const phase = STAGE_PHASE[event.stage];

      bumpProgress(Math.min(99, 15 + phase * 17));



      if (event.stage === 'plan_ready') {

        appendTraceLine({ text, tone: 'ok' });

        setActiveTrace(null);

        return;

      }

      if (event.stage === 'failed') {

        appendTraceLine({ text, tone: event.messageKey === 'pendingContact' ? 'info' : 'warn' });

        return;

      }

      appendTraceLine({ text, tone: 'info' });

    },

    [appendTraceLine, bumpProgress, formatTrace, setActiveTrace, setLastTraceKey],

  );

  handleTraceRef.current = handleTrace;



  const completeGeneration = async () => {

    markDone();

    invalidateAthleteHomeCache();

    emitDashboardRefresh();

    await clearPlanGenerationRequested(

      useAuthStore.getState().user?.profile?.onboardingData as

        | Record<string, unknown>

        | undefined,

    );

    await refreshUser();

    await onRefreshRef.current?.();

    onCompleteRef.current?.();

  };



  useEffect(() => {

    ensureStartedAt(planGenerationRequestedAt);

    const anchor = usePlanGenerationSessionStore.getState().startedAt;

    if (anchor) {

      setElapsedSec(Math.floor((Date.now() - anchor) / 1000));

    }

  }, [ensureStartedAt, planGenerationRequestedAt]);



  useEffect(() => {

    let cancelled = false;

    void (async () => {

      const result = await runOfficialPlanGeneration({

        locale: isAr ? 'ar' : 'en',

        reason: kickOff ? 'dashboard_live_retry' : 'dashboard_live_watch',

        preferSync: kickOff,

        kickOff,

        forceRestart: kickOff,

        maxMs: 5 * 60 * 1000,

        intervalMs: 2000,

        waitStartedAt:
          usePlanGenerationSessionStore.getState().startedAt ??
          (planGenerationRequestedAt ? Date.parse(planGenerationRequestedAt) : undefined) ??
          Date.now(),

        onTrace: (event) => {

          if (!cancelled) handleTraceRef.current(event);

        },

      });

      if (cancelled) return;

      if (result.ok) {

        await completeGeneration();

        return;

      }

      if (result.pending) {
        markFailed('pending', result.error ?? null);
        await clearPlanGenerationRequested(
          useAuthStore.getState().user?.profile?.onboardingData as
            | Record<string, unknown>
            | undefined,
        );
        await refreshUser();
        usePlanGenerationSessionStore.getState().reset();
        return;
      }

      markFailed(result.timedOut ? 'timeout' : 'error', result.error ?? null);
      await clearPlanGenerationRequested(
        useAuthStore.getState().user?.profile?.onboardingData as
          | Record<string, unknown>
          | undefined,
      );
      await refreshUser();
      usePlanGenerationSessionStore.getState().reset();

    })();

    return () => {

      cancelled = true;

    };

  }, [isAr, runId, kickOff, markFailed, planGenerationRequestedAt]);



  useEffect(() => {

    const tick = window.setInterval(() => {

      if (done || failed) return;

      tickElapsed();

      const anchor = usePlanGenerationSessionStore.getState().startedAt;

      if (anchor) {

        setElapsedSec(Math.floor((Date.now() - anchor) / 1000));

      }

    }, 800);

    return () => window.clearInterval(tick);

  }, [done, failed, tickElapsed]);



  const handleRetry = () => {

    reset();

    setElapsedSec(0);

    setKickOff(true);

    setRunId((id) => id + 1);

  };



  const activePhaseIndex = done

    ? PHASE_COUNT - 1

    : Math.min(

        PHASE_COUNT - 1,

        phaseDisplay.findIndex((pct) => pct < 100) === -1

          ? PHASE_COUNT - 1

          : phaseDisplay.findIndex((pct) => pct < 100),

      );



  const showTyping = !done && !failed;



  return (

    <div className={cn(CARD, 'flex min-h-[320px] flex-col p-6 sm:p-8', className)}>

      <div className="mb-5 flex items-start gap-3">

        <span className="material-symbols-outlined text-3xl text-brand-500">auto_awesome</span>

        <div className="min-w-0 flex-1">

          <h3 className="text-lg font-bold text-gray-800 dark:text-white/90">

            {t('dashboard.planGenLiveTitle')}

          </h3>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">

            {t('dashboard.planGenLiveSubtitle')}

          </p>

          {showTyping && startedAt ? (

            <p className="mt-1 text-[11px] tabular-nums text-gray-400">

              {t('dashboard.planGenTrace.elapsed', { sec: String(elapsedSec) })}

            </p>

          ) : null}

        </div>

        {showTyping ? <CoachTypingDots size="sm" /> : null}

      </div>



      <div className="mb-5 space-y-3">

        {PHASE_KEYS.map((key, i) => {

          const pct = phaseDisplay[i] ?? 0;

          const active = i === activePhaseIndex && !done;

          const complete = pct >= 100 || (done && i <= activePhaseIndex);

          return (

            <div key={key}>

              <div className="mb-1 flex justify-between text-xs">

                <span

                  className={cn(

                    'font-semibold',

                    complete || active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400',

                  )}

                >

                  {t(key)}

                </span>

                <span className="tabular-nums text-gray-400">{Math.round(pct)}%</span>

              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">

                <motion.div

                  className={cn(

                    'h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500',

                    active && !done && 'animate-pulse',

                  )}

                  initial={false}

                  animate={{ width: `${pct}%` }}

                  transition={{ duration: 0.35, ease: 'easeOut' }}

                />

              </div>

            </div>

          );

        })}

      </div>



      <div

        className="min-h-[160px] max-h-[220px] flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/80 p-4 font-mono text-xs leading-relaxed dark:border-gray-800 dark:bg-black/20 custom-scrollbar"

        dir={isAr ? 'rtl' : 'ltr'}

        aria-live="polite"

      >

        {traceLines.map((line, i) => (

          <p

            key={`trace-${i}`}

            className={cn(

              line.tone === 'ok' && 'text-emerald-600 dark:text-emerald-400',

              line.tone === 'warn' && 'text-amber-600 dark:text-amber-400',

              line.tone === 'info' && 'text-gray-600 dark:text-gray-300',

            )}

          >

            <span className="text-gray-400 select-none">&gt; </span>

            {line.text}

          </p>

        ))}

        {activeTrace && !done && (

          <p className="text-gray-800 dark:text-gray-100">

            <span className="text-gray-400 select-none">&gt; </span>

            {activeTrace}

            <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-brand-500 align-middle" />

          </p>

        )}

        {done && (

          <p className="mt-2 font-sans text-sm font-semibold text-brand-600 dark:text-brand-400">

            {t('dashboard.planGenComplete')}

          </p>

        )}

        {failed && (

          <p
            className={cn(
              'mt-2 font-sans text-sm font-semibold',
              failed === 'pending'
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-amber-600 dark:text-amber-400',
            )}
          >

            {failed === 'pending'
              ? t('dashboard.planGenPendingTitle')
              : failed === 'timeout'
                ? t('dashboard.planGenTimedOut')
                : t('dashboard.planGenFailed')}

            {failed === 'pending' ? (
              <span className="mt-2 block text-xs font-normal text-gray-600 dark:text-gray-300">
                {t('dashboard.planGenPendingBody')}
              </span>
            ) : failureDetail ? (

              <span className="mt-1 block text-xs font-normal text-amber-700/90 dark:text-amber-300/90">

                {failureDetail}

              </span>

            ) : null}

          </p>

        )}

      </div>



      {failed && failed !== 'pending' ? (

        <button

          type="button"

          onClick={handleRetry}

          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"

        >

          <span className="material-symbols-outlined text-lg">refresh</span>

          {t('dashboard.planGenRetry')}

        </button>

      ) : null}



      <p className="mt-4 text-center text-[11px] text-gray-400">

        {failed === 'pending'
          ? t('dashboard.planGenPendingHint')
          : failed
            ? t('dashboard.planGenRetryHint')
            : t('dashboard.plansGeneratingHint')}

      </p>

    </div>

  );

};


