import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from '../../components/shared/Logo';
import { LanguageToggle } from '../../components/shared/LanguageToggle';
import { useI18n } from '../../lib/i18n/useI18n';
import { LANDING_CONTAINER, LANDING_H2, LANDING_BODY } from './landingUi';
import { LANDING_FAQ_ITEMS } from './landingLegalContent';
import { LandingFooter } from './LandingFooter';
import { contentRevealVariants, staggerContainer } from '../../lib/motion';

function FaqItem({
  id,
  question,
  answer,
  defaultOpen = false,
}: {
  id: string;
  question: string;
  answer: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.div id={id} className="scroll-mt-28 border-b border-subtle last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-4 text-start"
        aria-expanded={open}
      >
        <span className="font-bold text-foreground">{question}</span>
        <span className={`material-symbols-outlined shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className={`${LANDING_BODY} pb-4 text-muted`}>{answer}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export function LandingFaqPage() {
  const { t, dir } = useI18n();
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (!hash) return;
    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const el = document.getElementById(hash);
      el?.querySelector('button')?.click();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  return (
    <div dir={dir} className="standalone-page safe-top safe-bottom bg-background min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 border-b border-subtle bg-background/90 backdrop-blur-xl safe-top">
        <div className={`${LANDING_CONTAINER} flex items-center justify-between gap-4 py-4`}>
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <Logo size="sm" />
            <span className="hidden font-bold tracking-tight sm:inline">Taqwin</span>
          </Link>
          <LanguageToggle />
        </div>
      </header>

      <main className={`${LANDING_CONTAINER} flex-1 py-12 sm:py-16 lg:py-20`}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer(0.08, 0.1)}
          className="mx-auto max-w-3xl space-y-8"
        >
          <div className="space-y-3">
            <motion.h1 variants={contentRevealVariants} className={LANDING_H2}>
              {t('legal.faq.title')}
            </motion.h1>
            <motion.p variants={contentRevealVariants} className={`${LANDING_BODY} text-muted`}>
              {t('legal.faq.subtitle')}
            </motion.p>
          </div>

          <motion.div variants={contentRevealVariants} className="rounded-2xl border border-subtle bg-elevated/30 px-4 sm:px-6">
            {LANDING_FAQ_ITEMS.map((item) => (
              <FaqItem
                key={item.id}
                id={item.id}
                question={t(item.questionKey)}
                answer={t(item.answerKey)}
                defaultOpen={item.id === 'getting-started'}
              />
            ))}
          </motion.div>

          <motion.p variants={contentRevealVariants} className="text-sm text-muted">
            {t('legal.faq.moreHelp')}{' '}
            <Link to="/contact" className="font-bold text-primary hover:underline">
              {t('landing.footerContact')}
            </Link>
          </motion.p>

          <motion.div variants={contentRevealVariants}>
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-black text-primary hover:underline">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              {t('legal.backHome')}
            </Link>
          </motion.div>
        </motion.div>
      </main>

      <LandingFooter />
    </div>
  );
}
