import React from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';

export const TestimonialsPanel: React.FC = () => {
  const { t } = useI18n();
  const items = [
    { name: t('onboarding.testimonial.1.name'), result: t('onboarding.testimonial.1.result'), quote: t('onboarding.testimonial.1.quote') },
    { name: t('onboarding.testimonial.2.name'), result: t('onboarding.testimonial.2.result'), quote: t('onboarding.testimonial.2.quote') },
    { name: t('onboarding.testimonial.3.name'), result: t('onboarding.testimonial.3.result'), quote: t('onboarding.testimonial.3.quote') },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <p className="text-center text-xs font-bold text-muted uppercase tracking-wider">
        {t('onboarding.testimonial.heading')}
      </p>
      <motion.div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory custom-scrollbar">
        {items.map(item => (
          <article
            key={item.name}
            className="snap-center flex-shrink-0 w-[min(85vw,280px)] glass-panel rounded-2xl border border-subtle p-4 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-black text-sm">{item.name}</span>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {item.result}
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed line-clamp-4">&ldquo;{item.quote}&rdquo;</p>
            <motion.div className="flex gap-0.5 text-accent" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="material-symbols-outlined text-sm fill-current">
                  star
                </span>
              ))}
            </motion.div>
          </article>
        ))}
      </motion.div>
    </motion.div>
  );
};
