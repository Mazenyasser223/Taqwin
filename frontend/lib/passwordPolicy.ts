import type { TranslationKey } from './i18n/translations';

export type PasswordRuleId = 'length' | 'upper' | 'lower' | 'number' | 'special';

export interface PasswordRule {
  id: PasswordRuleId;
  i18nKey: TranslationKey;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', i18nKey: 'auth.pwRuleLength', test: (p) => p.length >= 8 },
  { id: 'upper', i18nKey: 'auth.pwRuleUpper', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', i18nKey: 'auth.pwRuleLower', test: (p) => /[a-z]/.test(p) },
  { id: 'number', i18nKey: 'auth.pwRuleNumber', test: (p) => /\d/.test(p) },
  { id: 'special', i18nKey: 'auth.pwRuleSpecial', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function getPasswordRuleStatus(password: string): { id: PasswordRuleId; met: boolean }[] {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, met: rule.test(password) }));
}

export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
