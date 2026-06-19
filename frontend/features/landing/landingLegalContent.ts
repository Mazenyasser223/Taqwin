import type { TranslationKey } from '../../lib/i18n/translations';

export type LegalSection = {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
};

export type LegalPageConfig = {
  titleKey: TranslationKey;
  subtitleKey?: TranslationKey;
  updatedKey: TranslationKey;
  sections: LegalSection[];
};

export type LegalPageId =
  | 'about'
  | 'contact'
  | 'careers'
  | 'partners'
  | 'privacy'
  | 'terms'
  | 'security'
  | 'accessibility'
  | 'cookies';

export const LEGAL_PAGES: Record<LegalPageId, LegalPageConfig> = {
  about: {
    titleKey: 'legal.about.title',
    subtitleKey: 'legal.about.subtitle',
    updatedKey: 'legal.about.updated',
    sections: [
      { titleKey: 'legal.about.s1Title', bodyKey: 'legal.about.s1Body' },
      { titleKey: 'legal.about.s2Title', bodyKey: 'legal.about.s2Body' },
      { titleKey: 'legal.about.s3Title', bodyKey: 'legal.about.s3Body' },
      { titleKey: 'legal.about.s4Title', bodyKey: 'legal.about.s4Body' },
      { titleKey: 'legal.about.s5Title', bodyKey: 'legal.about.s5Body' },
      { titleKey: 'legal.about.s6Title', bodyKey: 'legal.about.s6Body' },
      { titleKey: 'legal.about.s7Title', bodyKey: 'legal.about.s7Body' },
    ],
  },
  contact: {
    titleKey: 'legal.contact.title',
    subtitleKey: 'legal.contact.subtitle',
    updatedKey: 'legal.contact.updated',
    sections: [
      { titleKey: 'legal.contact.s1Title', bodyKey: 'legal.contact.s1Body' },
      { titleKey: 'legal.contact.s2Title', bodyKey: 'legal.contact.s2Body' },
    ],
  },
  careers: {
    titleKey: 'legal.careers.title',
    subtitleKey: 'legal.careers.subtitle',
    updatedKey: 'legal.careers.updated',
    sections: [
      { titleKey: 'legal.careers.s1Title', bodyKey: 'legal.careers.s1Body' },
      { titleKey: 'legal.careers.s2Title', bodyKey: 'legal.careers.s2Body' },
    ],
  },
  partners: {
    titleKey: 'legal.partners.title',
    subtitleKey: 'legal.partners.subtitle',
    updatedKey: 'legal.partners.updated',
    sections: [
      { titleKey: 'legal.partners.s1Title', bodyKey: 'legal.partners.s1Body' },
      { titleKey: 'legal.partners.s2Title', bodyKey: 'legal.partners.s2Body' },
      { titleKey: 'legal.partners.s3Title', bodyKey: 'legal.partners.s3Body' },
      { titleKey: 'legal.partners.s4Title', bodyKey: 'legal.partners.s4Body' },
      { titleKey: 'legal.partners.s5Title', bodyKey: 'legal.partners.s5Body' },
      { titleKey: 'legal.partners.s6Title', bodyKey: 'legal.partners.s6Body' },
      { titleKey: 'legal.partners.s7Title', bodyKey: 'legal.partners.s7Body' },
    ],
  },
  privacy: {
    titleKey: 'legal.privacy.title',
    subtitleKey: 'legal.privacy.subtitle',
    updatedKey: 'legal.privacy.updated',
    sections: [
      { titleKey: 'legal.privacy.s1Title', bodyKey: 'legal.privacy.s1Body' },
      { titleKey: 'legal.privacy.s2Title', bodyKey: 'legal.privacy.s2Body' },
      { titleKey: 'legal.privacy.s3Title', bodyKey: 'legal.privacy.s3Body' },
      { titleKey: 'legal.privacy.s4Title', bodyKey: 'legal.privacy.s4Body' },
      { titleKey: 'legal.privacy.s5Title', bodyKey: 'legal.privacy.s5Body' },
      { titleKey: 'legal.privacy.s6Title', bodyKey: 'legal.privacy.s6Body' },
      { titleKey: 'legal.privacy.s7Title', bodyKey: 'legal.privacy.s7Body' },
      { titleKey: 'legal.privacy.s8Title', bodyKey: 'legal.privacy.s8Body' },
      { titleKey: 'legal.privacy.s9Title', bodyKey: 'legal.privacy.s9Body' },
      { titleKey: 'legal.privacy.s10Title', bodyKey: 'legal.privacy.s10Body' },
    ],
  },
  terms: {
    titleKey: 'legal.terms.title',
    subtitleKey: 'legal.terms.subtitle',
    updatedKey: 'legal.terms.updated',
    sections: [
      { titleKey: 'legal.terms.s1Title', bodyKey: 'legal.terms.s1Body' },
      { titleKey: 'legal.terms.s2Title', bodyKey: 'legal.terms.s2Body' },
      { titleKey: 'legal.terms.s3Title', bodyKey: 'legal.terms.s3Body' },
      { titleKey: 'legal.terms.s4Title', bodyKey: 'legal.terms.s4Body' },
    ],
  },
  security: {
    titleKey: 'legal.security.title',
    subtitleKey: 'legal.security.subtitle',
    updatedKey: 'legal.security.updated',
    sections: [
      { titleKey: 'legal.security.s1Title', bodyKey: 'legal.security.s1Body' },
      { titleKey: 'legal.security.s2Title', bodyKey: 'legal.security.s2Body' },
      { titleKey: 'legal.security.s3Title', bodyKey: 'legal.security.s3Body' },
    ],
  },
  accessibility: {
    titleKey: 'legal.accessibility.title',
    subtitleKey: 'legal.accessibility.subtitle',
    updatedKey: 'legal.accessibility.updated',
    sections: [
      { titleKey: 'legal.accessibility.s1Title', bodyKey: 'legal.accessibility.s1Body' },
      { titleKey: 'legal.accessibility.s2Title', bodyKey: 'legal.accessibility.s2Body' },
    ],
  },
  cookies: {
    titleKey: 'legal.cookies.title',
    subtitleKey: 'legal.cookies.subtitle',
    updatedKey: 'legal.cookies.updated',
    sections: [
      { titleKey: 'legal.cookies.s1Title', bodyKey: 'legal.cookies.s1Body' },
      { titleKey: 'legal.cookies.s2Title', bodyKey: 'legal.cookies.s2Body' },
      { titleKey: 'legal.cookies.s3Title', bodyKey: 'legal.cookies.s3Body' },
    ],
  },
};

export const LANDING_FAQ_ITEMS: { id: string; questionKey: TranslationKey; answerKey: TranslationKey }[] = [
  { id: 'getting-started', questionKey: 'legal.faq.q1', answerKey: 'legal.faq.a1' },
  { id: 'free', questionKey: 'legal.faq.q2', answerKey: 'legal.faq.a2' },
  { id: 'arabic', questionKey: 'legal.faq.q3', answerKey: 'legal.faq.a3' },
  { id: 'gyms', questionKey: 'legal.faq.q4', answerKey: 'legal.faq.a4' },
  { id: 'data', questionKey: 'legal.faq.q5', answerKey: 'legal.faq.a5' },
  { id: 'cancel', questionKey: 'legal.faq.q6', answerKey: 'legal.faq.a6' },
];
