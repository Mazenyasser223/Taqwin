import React from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';
import { FLOW_PREVIEW_CONFIG } from '../planPreviewConfig';
import type { QuestionnaireFlowId } from '../flows/types';

interface PlanPreviewPanelProps {
  flow: QuestionnaireFlowId;
  progressPct: number;
  compact?: boolean;
}

export const PlanPreviewPanel: React.FC<PlanPreviewPanelProps> = ({
  flow,
  progressPct,
  compact = false,
}) => {
  const { t } = useI18n();
  const config = FLOW_PREVIEW_CONFIG[flow];
  const checklist = config.checklistKeys;
  const activeCount = Math.ceil((progressPct / 100) * checklist.length);

  if (compact) {
    return (
      <motion.div
        className={`rounded-xl border border-subtle p-3 bg-gradient-to-br ${config.accentClass} backdrop-blur-sm`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-primary text-lg">{config.icon}</span>
          <p className="text-[11px] sm:text-xs font-black text-foreground leading-tight flex-1 min-w-0 truncate">
            {t(config.titleKey)}
          </p>
        </div>
        <motion.div className="flex gap-1">
          {checklist.map((key, i) => (
            <motion.div
              key={key}
              initial={false}
              animate={{ opacity: i < activeCount ? 1 : 0.35 }}
              className={`h-1 flex-1 rounded-full ${i < activeCount ? 'bg-primary' : 'bg-border'}`}
              title={t(key)}
            />
          ))}
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4 sticky top-0">
      <motion.div
        className={`glass-panel rounded-2xl border border-subtle p-4 xl:p-5 space-y-4 bg-gradient-to-br ${config.accentClass}`}
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-2xl text-primary shrink-0">{config.icon}</span>
          <div>
            <h3 className="text-sm xl:text-base font-black text-foreground leading-snug">
              {t(config.titleKey)}
            </h3>
            <p className="text-[10px] xl:text-xs text-muted mt-1 leading-relaxed">{t(config.trustKey)}</p>
          </div>
        </div>

        <ul className="space-y-2 xl:space-y-2.5">
          {checklist.map((key, i) => {
            const done = i < activeCount;
            return (
              <motion.li
                key={key}
                initial={false}
                animate={{ opacity: done ? 1 : 0.45, x: done ? 0 : 2 }}
                transition={{ delay: done ? i * 0.04 : 0 }}
                className="flex items-center gap-2.5 text-xs"
              >
                <span
                  className={`size-5 xl:size-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    done ? 'bg-primary text-white shadow-sm shadow-primary/30' : 'bg-border text-faint'
                  }`}
                >
                  {done ? (
                    <span className="material-symbols-outlined text-[14px] xl:text-[16px]">check</span>
                  ) : (
                    <span className="size-1.5 rounded-full bg-faint" />
                  )}
                </span>
                <span className={done ? 'text-foreground font-medium' : 'text-muted'}>{t(key)}</span>
              </motion.li>
            );
          })}
        </ul>

        <div className="pt-2 border-t border-subtle/80">
          <div className="flex items-center justify-between text-[10px] text-faint mb-1.5">
            <span>{t('onboarding.planPreview.progress')}</span>
            <span className="font-black text-primary tabular-nums">{progressPct}%</span>
          </div>
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={false}
              animate={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
};
