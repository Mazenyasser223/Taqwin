/** First + last initial from display name (fallback: email local part). */
export function profileInitials(displayName?: string | null, email?: string | null): string {
  const raw = (displayName || email?.split('@')[0] || '').trim();
  if (!raw) return '?';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  const word = parts[0];
  if (word.length >= 2) return word.slice(0, 2).toUpperCase();
  return word[0].toUpperCase();
}
