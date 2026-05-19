import React from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';

const CHECKLIST_KEYS = [
  'onboarding.planCheck.analysis',
  'onboarding.planCheck.calories',
  'onboarding.planCheck.workouts',
  'onboarding.planCheck.nutrition',
  'onboarding.planCheck.tasks',
] as const;

interface PlanPreviewPanelProps {
  progressPct: number;
}

export const PlanPreviewPanel: React.FC<PlanPreviewPanelProps> = ({ progressPct }) => {
  const { t } = useI18n();
  const activeCount = Math.ceil((progressPct / 100) * CHECKLIST_KEYS.length);

  return (
    <div className="glass-panel rounded-2xl border border-subtle p-5 space-y-4">
      <h3 className="text-sm font-black text-foreground">{t('onboarding.planPreview.title')}</h3>
      <ul className="space-y-2.5">
        {CHECKLIST_KEYS.map((key, i) => {
          const done = i < activeCount;
          return (
            <motion.li
              key={key}
              initial={false}
              animate={{ opacity: done ? 1 : 0.45 }}
              className="flex items-center gap-2.5 text-xs"
            >
              <span
                className={`size-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  done ? 'bg-primary text-white' : 'bg-border text-faint'
                }`}
              >
                {done ? (
                  <span className="material-symbols-outlined text-[14px]">check</span>
                ) : (
                  <span className="size-1.5 rounded-full bg-faint" />
                )}
              </span>
              <span className={done ? 'text-foreground font-medium' : 'text-muted'}>{t(key)}</span>
            </motion.li>
          );
        })}
      </ul>
      <p className="text-[10px] text-faint leading-relaxed border-t border-subtle pt-3">
        {t('onboarding.planPreview.trust')}
      </p>
    </div>
  );
};
