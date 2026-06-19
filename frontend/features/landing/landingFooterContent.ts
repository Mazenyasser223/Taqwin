import type { TranslationKey } from '../../lib/i18n/translations';

/** Public contact & social — update with real URLs when available. */
export const FOOTER_CONTACT = {
  email: 'support@taqwin.app',
  whatsapp: 'https://wa.me/201000000000',
  instagram: 'https://instagram.com/taqwin',
  facebook: 'https://facebook.com/taqwin',
  tiktok: 'https://tiktok.com/@taqwin',
  linkedin: 'https://linkedin.com/company/taqwin',
  telegram: 'https://t.me/taqwin',
  status: 'https://status.taqwin.app',
} as const;

export type FooterLinkItem = {
  labelKey: TranslationKey;
  /** In-app route, landing anchor id, or external/mailto URL */
  href: string;
  external?: boolean;
  anchor?: boolean;
};

export type FooterColumn = {
  titleKey: TranslationKey;
  links: FooterLinkItem[];
};

export const FOOTER_PRODUCT_LINKS: FooterLinkItem[] = [
  { labelKey: 'landing.footerProductPlatform', href: 'platform', anchor: true },
  { labelKey: 'landing.footerProductFeatures', href: 'features', anchor: true },
  { labelKey: 'landing.footerProductAiCoach', href: 'feature-ai-coach', anchor: true },
  { labelKey: 'landing.footerProductNutrition', href: 'feature-nutrition', anchor: true },
  { labelKey: 'landing.footerProductWorkouts', href: 'feature-workouts', anchor: true },
  { labelKey: 'landing.footerProductMuscleWiki', href: 'feature-muscle-wiki', anchor: true },
  { labelKey: 'landing.footerProductCommunity', href: 'feature-community', anchor: true },
  { labelKey: 'landing.footerProductMarketplace', href: 'feature-marketplace', anchor: true },
  { labelKey: 'landing.footerProductGymOwner', href: 'feature-gym-owner', anchor: true },
];

export const FOOTER_GET_STARTED_LINKS: FooterLinkItem[] = [
  { labelKey: 'landing.signUpNow', href: '/auth' },
  { labelKey: 'landing.signIn', href: '/auth?mode=signin' },
  { labelKey: 'landing.footerForGyms', href: 'feature-gym-owner', anchor: true },
  { labelKey: 'landing.footerPartners', href: '/partners' },
];

export const FOOTER_COMPANY_LINKS: FooterLinkItem[] = [
  { labelKey: 'landing.footerAbout', href: '/about' },
  { labelKey: 'landing.footerContact', href: '/contact' },
  { labelKey: 'landing.footerCareers', href: '/careers' },
];

export const FOOTER_HELP_LINKS: FooterLinkItem[] = [
  { labelKey: 'landing.footerFaq', href: '/faq' },
  { labelKey: 'landing.footerGettingStarted', href: '/faq' },
  { labelKey: 'landing.footerFeedback', href: '/contact' },
  { labelKey: 'landing.footerAccessibility', href: '/accessibility' },
  { labelKey: 'landing.footerPrivacy', href: '/privacy' },
  { labelKey: 'landing.footerTerms', href: '/terms' },
  { labelKey: 'landing.footerSecurity', href: '/security' },
  { labelKey: 'landing.footerCookies', href: '/cookies' },
];

export const FOOTER_COLUMNS: FooterColumn[] = [
  { titleKey: 'landing.footerProduct', links: FOOTER_PRODUCT_LINKS },
  { titleKey: 'landing.footerGetStarted', links: FOOTER_GET_STARTED_LINKS },
  { titleKey: 'landing.footerCompany', links: FOOTER_COMPANY_LINKS },
  { titleKey: 'landing.footerHelp', links: FOOTER_HELP_LINKS },
];
