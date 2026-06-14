export type ExpiryDisplayUnit = 'days' | 'months' | 'years';

const STORAGE_KEY = 'taqwin.reception.expiryUnit';

type TranslateFn = (key: string, params?: Record<string, string>) => string;

export function loadExpiryDisplayUnit(): ExpiryDisplayUnit {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'days' || raw === 'months' || raw === 'years') return raw;
  } catch {
    /* ignore */
  }
  return 'days';
}

export function saveExpiryDisplayUnit(unit: ExpiryDisplayUnit) {
  try {
    localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    /* ignore */
  }
}

export function calendarMonthsUntil(expiresAt: Date, now = new Date()): number {
  let months = (expiresAt.getFullYear() - now.getFullYear()) * 12 + (expiresAt.getMonth() - now.getMonth());
  if (expiresAt.getDate() < now.getDate()) months -= 1;
  return Math.max(0, months);
}

export function calendarYearsUntil(expiresAt: Date, now = new Date()): number {
  let years = expiresAt.getFullYear() - now.getFullYear();
  if (
    expiresAt.getMonth() < now.getMonth() ||
    (expiresAt.getMonth() === now.getMonth() && expiresAt.getDate() < now.getDate())
  ) {
    years -= 1;
  }
  return Math.max(0, years);
}

export function formatMembershipRemaining(
  daysRemaining: number | null,
  expiresAt: string | null | undefined,
  unit: ExpiryDisplayUnit,
  t: TranslateFn,
): string {
  if (daysRemaining === null) return t('reception.noExpiry');
  if (daysRemaining <= 0) return t('reception.membershipExpired');

  if (unit === 'days') {
    if (daysRemaining === 1) return t('reception.daysRemainingOne');
    return t('reception.daysRemaining', { days: String(daysRemaining) });
  }

  const end = expiresAt ? new Date(expiresAt) : null;

  if (unit === 'months') {
    const months = end ? calendarMonthsUntil(end) : Math.floor(daysRemaining / 30);
    if (months <= 0) return t('reception.monthsRemainingLessThanOne');
    if (months === 1) return t('reception.monthsRemainingOne');
    return t('reception.monthsRemaining', { months: String(months) });
  }

  const years = end ? calendarYearsUntil(end) : Math.floor(daysRemaining / 365);
  if (years <= 0) return t('reception.yearsRemainingLessThanOne');
  if (years === 1) return t('reception.yearsRemainingOne');
  return t('reception.yearsRemaining', { years: String(years) });
}
