import type { UserRole } from '../../types';
import type { TranslationKey } from '../../lib/i18n/translations';

export type FaqItem = { q: TranslationKey; a: TranslationKey };

const ATHLETE_FAQ: FaqItem[] = [
  { q: 'support.faq1q', a: 'support.faq1a' },
  { q: 'support.faq2q', a: 'support.faq2a' },
  { q: 'support.faq3q', a: 'support.faq3a' },
  { q: 'support.faqAthlete4q', a: 'support.faqAthlete4a' },
  { q: 'support.faqAthlete5q', a: 'support.faqAthlete5a' },
  { q: 'support.faqAthlete6q', a: 'support.faqAthlete6a' },
];

const GYM_FAQ: FaqItem[] = [
  { q: 'support.faqGym1q', a: 'support.faqGym1a' },
  { q: 'support.faqGym2q', a: 'support.faqGym2a' },
  { q: 'support.faqGym3q', a: 'support.faqGym3a' },
  { q: 'support.faqGym4q', a: 'support.faqGym4a' },
  { q: 'support.faq1q', a: 'support.faq1a' },
  { q: 'support.faq3q', a: 'support.faq3a' },
];

export const SUPPORT_CATEGORIES = [
  'account',
  'booking',
  'membership',
  'payments',
  'technical',
  'other',
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export function getFaqForRole(role?: UserRole): FaqItem[] {
  if (role === 'gym') return GYM_FAQ;
  return ATHLETE_FAQ;
}
