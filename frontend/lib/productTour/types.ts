import type { TranslationKey } from '../i18n/translations';

export type ProductTourStep = {
  id: string;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  /** Pathname to navigate to before showing this step (exact or prefix match). */
  route?: string;
  /** Page badge shown above the step title. */
  sectionKey?: TranslationKey;
  placement?: 'top' | 'bottom' | 'left' | 'right';
};
