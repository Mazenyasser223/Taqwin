type TranslateFn = (key: string, params?: Record<string, string>) => string;

export function formatVisitDuration(minutes: number, t: TranslateFn): string {
  if (minutes < 60) {
    return t('reception.durationMinutes', { minutes: String(minutes) });
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    return t('reception.durationHoursOnly', { hours: String(hours) });
  }
  return t('reception.durationHours', { hours: String(hours), minutes: String(remainder) });
}
