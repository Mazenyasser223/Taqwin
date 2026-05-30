import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import type { AthleteHomeDashboard } from '../../services/dashboardService';
import { TrainingStreakPanel } from './TrainingStreakPanel';

type Props = {
  open: boolean;
  onClose: () => void;
  data: AthleteHomeDashboard;
};

export const TrainingStreakDetailsModal: React.FC<Props> = ({ open, onClose, data }) => {
  const { t, dir } = useI18n();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-background/95 p-0 sm:p-6 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-subtle p-5 sm:p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="training-streak-details-title"
            dir={dir}
          >
            <p id="training-streak-details-title" className="sr-only">
              {t('dashboard.streakHeatmap')}
            </p>
            <TrainingStreakPanel data={data} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
