const FALLBACK =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=480&fm=webp';

/** Prefer WebP/smaller variants when the CDN supports query params. */
export function optimizeExerciseThumbnailUrl(raw: string | null | undefined): string {
  const url = String(raw || '').trim();
  if (!url) return FALLBACK;

  if (url.includes('images.unsplash.com')) {
    const base = url.split('?')[0];
    return `${base}?q=75&w=480&auto=format&fm=webp`;
  }

  return url;
}

export const EXERCISE_THUMB_FALLBACK = FALLBACK;

export type ExerciseThumbnailPriority = 'auto' | 'high' | 'low';

export function exerciseThumbnailProps(priority: ExerciseThumbnailPriority = 'auto') {
  return {
    loading: priority === 'high' ? ('eager' as const) : ('lazy' as const),
    decoding: 'async' as const,
    fetchPriority:
      priority === 'high' ? ('high' as const) : priority === 'low' ? ('low' as const) : ('auto' as const),
  };
}

export function exerciseThumbnailCandidates(raw: string | null | undefined): string[] {
  const url = String(raw || '').trim();
  if (!url) return [FALLBACK];

  const candidates: string[] = [];
  const optimized = optimizeExerciseThumbnailUrl(url);
  if (optimized !== url) candidates.push(optimized);
  if (/\.(jpe?g|png)(\?|$)/i.test(url)) {
    candidates.push(url.replace(/\.(jpe?g|png)(\?.*)?$/i, '.webp$2'));
  }
  candidates.push(url);
  candidates.push(FALLBACK);
  return [...new Set(candidates)];
}
