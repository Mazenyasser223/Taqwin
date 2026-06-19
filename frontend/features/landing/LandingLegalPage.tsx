import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '../../components/shared/Logo';
import { LanguageToggle } from '../../components/shared/LanguageToggle';
import { useI18n } from '../../lib/i18n/useI18n';
import { LANDING_CONTAINER, LANDING_H2, LANDING_BODY } from './landingUi';
import { LEGAL_PAGES, type LegalPageId } from './landingLegalContent';
import type { TranslationKey } from '../../lib/i18n/translations';
import { FOOTER_CONTACT } from './landingFooterContent';
import { LandingFooter } from './LandingFooter';
import { contentRevealVariants, staggerContainer } from '../../lib/motion';

type Props = {
  pageId: LegalPageId;
};

const PAGE_INTRO: Partial<Record<LegalPageId, TranslationKey>> = {
  about: 'legal.about.intro',
  privacy: 'legal.privacy.intro',
  partners: 'legal.partners.intro',
};

const PAGE_CONTACT_BOX: Partial<
  Record<LegalPageId, { titleKey: TranslationKey; bodyKey: TranslationKey; mailSubject: string }>
> = {
  about: {
    titleKey: 'legal.about.contactBoxTitle',
    bodyKey: 'legal.about.contactBoxBody',
    mailSubject: 'General Inquiry',
  },
  privacy: {
    titleKey: 'legal.privacy.contactBoxTitle',
    bodyKey: 'legal.privacy.contactBoxBody',
    mailSubject: 'Privacy Request',
  },
  partners: {
    titleKey: 'legal.partners.contactBoxTitle',
    bodyKey: 'legal.partners.contactBoxBody',
    mailSubject: 'Partnership Inquiry',
  },
};

export function LandingLegalPage({ pageId }: Props) {
  const { t, dir } = useI18n();
  const location = useLocation();
  const page = LEGAL_PAGES[pageId];

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (!hash) return;
    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [location.hash, pageId]);

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
          className="mx-auto max-w-3xl space-y-10"
        >
          <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#0a141c]/50 p-6 sm:p-8">
            <motion.h1 variants={contentRevealVariants} className={LANDING_H2}>
              {t(page.titleKey)}
            </motion.h1>
            {page.subtitleKey ? (
              <motion.p variants={contentRevealVariants} className={`${LANDING_BODY} text-slate-300 leading-relaxed`}>
                {t(page.subtitleKey)}
              </motion.p>
            ) : null}
            {PAGE_INTRO[pageId] ? (
              <motion.p variants={contentRevealVariants} className={`${LANDING_BODY} text-sm text-slate-400 leading-relaxed`}>
                {t(PAGE_INTRO[pageId]!)}
              </motion.p>
            ) : null}
            <motion.p variants={contentRevealVariants} className="text-xs font-semibold text-primary/80">
              {t(page.updatedKey)}
            </motion.p>
          </div>

          {pageId === 'contact' ? (
            <motion.div variants={contentRevealVariants} className="grid gap-3 sm:grid-cols-2">
              <a
                href={`mailto:${FOOTER_CONTACT.email}`}
                className="flex items-center gap-3 rounded-2xl border border-subtle bg-elevated/50 p-4 hover:border-primary/30 transition-colors"
              >
                <span className="material-symbols-outlined text-primary">mail</span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-faint">{t('legal.contact.emailLabel')}</p>
                  <p className="text-sm font-bold text-foreground">{FOOTER_CONTACT.email}</p>
                </div>
              </a>
              <a
                href={FOOTER_CONTACT.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-subtle bg-elevated/50 p-4 hover:border-primary/30 transition-colors"
              >
                <span className="material-symbols-outlined text-primary">chat</span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-faint">{t('legal.contact.whatsappLabel')}</p>
                  <p className="text-sm font-bold text-foreground">{t('legal.contact.whatsappCta')}</p>
                </div>
              </a>
            </motion.div>
          ) : null}

          <div className="space-y-5">
            {page.sections.map((section, index) => (
              <motion.section
                key={section.titleKey}
                id={pageId === 'contact' && index === 1 ? 'feedback' : undefined}
                variants={contentRevealVariants}
                className="scroll-mt-28 rounded-2xl border border-white/[0.06] bg-elevated/20 p-5 sm:p-6 lg:p-7"
              >
                <h2 className="mb-4 text-lg font-black text-white sm:text-xl">{t(section.titleKey)}</h2>
                <div className={`${LANDING_BODY} space-y-3 text-sm text-slate-400 sm:text-base leading-relaxed`}>
                  {t(section.bodyKey)
                    .split('\n\n')
                    .map((paragraph) => (
                      <p key={paragraph.slice(0, 48)} className="whitespace-pre-line">
                        {paragraph}
                      </p>
                    ))}
                </div>
              </motion.section>
            ))}
          </div>

          {PAGE_CONTACT_BOX[pageId] ? (
            <motion.div
              variants={contentRevealVariants}
              className="rounded-2xl border border-primary/20 bg-primary/10 p-5 sm:p-6"
            >
              <p className="text-sm font-bold text-white">{t(PAGE_CONTACT_BOX[pageId]!.titleKey)}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{t(PAGE_CONTACT_BOX[pageId]!.bodyKey)}</p>
              <a
                href={`mailto:${FOOTER_CONTACT.email}?subject=${encodeURIComponent(PAGE_CONTACT_BOX[pageId]!.mailSubject)}`}
                className="mt-4 inline-flex items-center gap-2 text-sm font-black text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-lg">mail</span>
                {FOOTER_CONTACT.email}
              </a>
            </motion.div>
          ) : null}

          <motion.div variants={contentRevealVariants} className="pt-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-black text-primary hover:underline"
            >
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
