import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { buttonPress, contentRevealVariants, staggerContainer } from '../../lib/motion';
import { LANDING_CONTAINER, LANDING_EYEBROW } from './landingUi';
import type { TranslationKey } from '../../lib/i18n/translations';
import { FOOTER_COLUMNS, FOOTER_CONTACT, type FooterColumn } from './landingFooterContent';
import { FooterLink } from './FooterLink';
import { SocialBrandIcon, SOCIAL_BRAND_HOVER, type SocialBrand } from './SocialBrandIcon';

const COLUMN_ICONS: Partial<Record<FooterColumn['titleKey'], string>> = {
  'landing.footerProduct': 'apps',
  'landing.footerGetStarted': 'rocket_launch',
  'landing.footerCompany': 'apartment',
  'landing.footerHelp': 'support_agent',
};

const SOCIAL_LINKS: { href: string; brand: SocialBrand; labelKey: TranslationKey }[] = [
  { href: FOOTER_CONTACT.instagram, brand: 'instagram', labelKey: 'landing.footerSocialInstagram' },
  { href: FOOTER_CONTACT.facebook, brand: 'facebook', labelKey: 'landing.footerSocialFacebook' },
  { href: FOOTER_CONTACT.tiktok, brand: 'tiktok', labelKey: 'landing.footerSocialTiktok' },
  { href: FOOTER_CONTACT.linkedin, brand: 'linkedin', labelKey: 'landing.footerSocialLinkedin' },
  { href: FOOTER_CONTACT.telegram, brand: 'telegram', labelKey: 'landing.footerSocialTelegram' },
  { href: FOOTER_CONTACT.whatsapp, brand: 'whatsapp', labelKey: 'landing.footerSocialWhatsapp' },
];

function FooterColumnBlock({ column }: { column: FooterColumn }) {
  const { t } = useI18n();
  const icon = COLUMN_ICONS[column.titleKey] ?? 'link';

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2.5 sm:pb-3">
        <span className="flex size-6 sm:size-7 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
          <span className="material-symbols-outlined text-sm sm:text-base">{icon}</span>
        </span>
        <h4 className={`${LANDING_EYEBROW} !tracking-[0.14em] sm:!tracking-[0.22em] text-[9px] sm:text-[10px]`}>{t(column.titleKey)}</h4>
      </div>
      <nav className="flex flex-col gap-0.5 sm:gap-1" aria-label={t(column.titleKey)}>
        {column.links.map((link) => (
          <FooterLink key={`${column.titleKey}-${link.labelKey}`} item={link} />
        ))}
      </nav>
    </div>
  );
}

export function LandingFooter() {
  const { t, dir } = useI18n();
  const navigate = useNavigate();

  return (
    <footer dir={dir} className="relative mt-auto w-full min-w-0 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#060d12]/60 to-[#060d12]/95" />
      <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-[min(100%,640px)] -translate-x-1/2 rounded-full bg-primary/15 blur-[80px]" />

      <div className="relative border-t border-white/[0.08] bg-[#060d12]/70 backdrop-blur-2xl backdrop-saturate-150">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        {/* CTA band */}
        <div className={`${LANDING_CONTAINER} border-b border-white/[0.06] py-8 sm:py-10 md:py-12 lg:py-14`}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={staggerContainer(0.06, 0.08)}
            className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-10"
          >
            <motion.div variants={contentRevealVariants} className="space-y-3 sm:space-y-4 lg:col-span-7">
              <span className={LANDING_EYEBROW}>{t('landing.footerCtaEyebrow')}</span>
              <h2 className="text-xl font-black leading-tight text-white sm:text-2xl md:text-3xl lg:text-4xl">
                {t('landing.footerCtaTitle')}{' '}
                <span className="text-primary italic">{t('landing.footerCtaHighlight')}</span>
              </h2>
              <p className="max-w-lg text-sm leading-relaxed text-slate-300 sm:text-base">
                {t('landing.footerCtaSubtitle')}
              </p>
            </motion.div>

            <motion.div
              variants={contentRevealVariants}
              className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:justify-end"
            >
              <motion.button
                variants={buttonPress}
                whileHover="hover"
                whileTap="tap"
                type="button"
                onClick={() => navigate('/auth')}
                className="w-full rounded-2xl bg-primary px-8 py-4 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-primary/35 sm:w-auto sm:text-base"
              >
                {t('landing.signUpNow')}
              </motion.button>
              <motion.button
                variants={buttonPress}
                whileHover="hover"
                whileTap="tap"
                type="button"
                onClick={() => navigate('/auth?mode=signin')}
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-8 py-4 text-sm font-black uppercase tracking-wider text-white backdrop-blur-sm transition-colors hover:bg-white/10 sm:w-auto sm:text-base"
              >
                {t('landing.signIn')}
              </motion.button>
            </motion.div>
          </motion.div>
        </div>

        {/* Link columns */}
        <div className={`${LANDING_CONTAINER} py-8 sm:py-10 md:py-12 lg:py-14`}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={staggerContainer(0.05, 0.06)}
            className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-8 md:gap-10 lg:grid-cols-4"
          >
            {FOOTER_COLUMNS.map((column) => (
              <motion.div key={column.titleKey} variants={contentRevealVariants}>
                <FooterColumnBlock column={column} />
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.06] bg-black/20">
          <div className={`${LANDING_CONTAINER} py-6 sm:py-8`}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1 text-center lg:text-start">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  {t('landing.copyright')}
                </p>
                <p className="text-xs font-semibold text-slate-400">{t('landing.footerLegalEntity')}</p>
                <p className="text-[11px] text-slate-500">{t('landing.footerRegion')}</p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {SOCIAL_LINKS.map((social) => (
                  <a
                    key={social.labelKey}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 transition-all hover:shadow-lg ${SOCIAL_BRAND_HOVER[social.brand]}`}
                    aria-label={t(social.labelKey)}
                  >
                    <SocialBrandIcon
                      brand={social.brand}
                      className="size-[18px] transition-transform group-hover:scale-110"
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
