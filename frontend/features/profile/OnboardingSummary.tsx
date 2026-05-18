import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { contentRevealVariants, staggerContainer } from '../../lib/motion';
import {
  athleteOnboardingGroups,
  onboardingMetaLine,
  roleWizardGroups,
} from './onboardingDisplay';

interface OnboardingSummaryProps {
  onboardingData: Record<string, unknown> | null | undefined;
  role: 'athlete' | 'trainer' | 'gym';
}

export const OnboardingSummary: React.FC<OnboardingSummaryProps> = ({ onboardingData, role }) => {
  const groups = useMemo(() => {
    if (!onboardingData) return [];
    if (role === 'athlete') return athleteOnboardingGroups(onboardingData);
    return roleWizardGroups(onboardingData);
  }, [onboardingData, role]);

  const meta = onboardingMetaLine(onboardingData);
  const isEmpty = groups.every((g) => g.rows.length === 0);

  if (!onboardingData || isEmpty) {
    return (
      <section className="glass-panel rounded-3xl p-6 md:p-8 border-white/10 space-y-3">
        <h2 className="text-lg font-black text-white">Onboarding answers</h2>
        <p className="text-sm text-slate-500">
          No onboarding data saved yet.{' '}
          <Link to="/onboarding" className="text-primary font-bold hover:underline">
            Complete setup
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel rounded-3xl p-6 md:p-8 border-white/10 space-y-6">
      <motion.div
        variants={staggerContainer(0.04)}
        initial="hidden"
        animate="visible"
        className="space-y-2"
      >
        <motion.h2 variants={contentRevealVariants} className="text-lg font-black text-white">
          Onboarding answers
        </motion.h2>
        {meta && (
          <motion.p variants={contentRevealVariants} className="text-xs text-slate-500 font-medium">
            {meta}
          </motion.p>
        )}
        <motion.p variants={contentRevealVariants} className="text-sm text-slate-500">
          Everything you entered in the setup wizard. Core fields above can be edited; full answers
          are kept here.
        </motion.p>
      </motion.div>

      <motion.div
        variants={staggerContainer(0.03)}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {groups.map((group) => (
          <div key={group.section}>
            <h3 className="text-[10px] font-black uppercase tracking-[0.35em] text-primary mb-4">
              {group.section}
            </h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {group.rows.map((row) => (
                <motion.div
                  key={row.key}
                  variants={contentRevealVariants}
                  className="border-b border-white/5 pb-3"
                >
                  <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                    {row.label}
                  </dt>
                  <dd className="text-sm font-bold text-white leading-snug">{row.value}</dd>
                </motion.div>
              ))}
            </dl>
          </div>
        ))}
      </motion.div>

      {!onboardingData.completedAt && role === 'athlete' && (
        <Link
          to="/onboarding"
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-lg">edit</span>
          Continue onboarding
        </Link>
      )}
    </section>
  );
};
