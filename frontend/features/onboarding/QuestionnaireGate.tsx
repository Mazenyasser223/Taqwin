import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { useI18n } from '../../lib/i18n/useI18n';
import { isFlowCompleted, isFlowSubstantivelyComplete } from './questionnaireCompletion';
import { repairFlowCompletionFlag } from './persistQuestionnaire';
import { FLOW_META, type QuestionnaireFlowId } from './flows/types';

export interface QuestionnaireGateProps {
  flow: QuestionnaireFlowId;
  questionnairePath: string;
  children: React.ReactNode;
}

export const QuestionnaireGate: React.FC<QuestionnaireGateProps> = ({
  flow,
  questionnairePath,
  children,
}) => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const authHydrated = useAuthStore((s) => s.authHydrated);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const user = useAuthStore((s) => s.user);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (authHydrated) {
        await refreshUser();
      }
      if (!cancelled) setProfileReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [authHydrated, refreshUser, flow]);

  const data = user?.profile?.onboardingData as Record<string, unknown> | undefined;

  useEffect(() => {
    if (!profileReady || !data) return;
    if (data[FLOW_META[flow].completedKey]) return;
    if (!isFlowSubstantivelyComplete(data, flow)) return;
    void repairFlowCompletionFlag(flow);
  }, [profileReady, flow, data]);

  if (!authHydrated || !profileReady) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-muted text-sm font-bold animate-pulse">
        {t('onboarding.loading')}
      </div>
    );
  }

  if (isFlowCompleted(data, flow)) {
    return <>{children}</>;
  }

  const meta = FLOW_META[flow];
  const title = t(`questionnaire.gate.${flow}.title` as Parameters<typeof t>[0]) || meta.titleAr;
  const subtitle =
    t(`questionnaire.gate.${flow}.subtitle` as Parameters<typeof t>[0]) || meta.subtitleAr;
  const cta = t('questionnaire.gate.cta');

  return (
    <div className="relative min-h-[50vh]">
      <div className="pointer-events-none select-none opacity-[0.35] blur-[2px] max-h-[70vh] overflow-hidden">
        {children}
      </div>
      <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass-panel rounded-3xl border border-subtle p-8 text-center shadow-2xl"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-3">
            {t('questionnaire.gate.badge')}
          </p>
          <h2 className="text-xl font-black mb-2">{title}</h2>
          <p className="text-sm text-muted mb-6 leading-relaxed">{subtitle}</p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(questionnairePath)}
            className="w-full py-4 rounded-2xl bg-primary text-white font-black text-sm"
          >
            {cta}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};
