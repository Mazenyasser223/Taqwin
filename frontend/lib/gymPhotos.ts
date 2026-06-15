import type { Gym } from '../types';
import { resolveMediaUrl } from './mediaUrl';

const FALLBACK =
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600';

/** Cover + gallery photos, deduped, resolved for display. */
export function gymPhotoUrls(gym: Pick<Gym, 'imageUrl' | 'galleryUrls'>): string[] {
  const raw: string[] = [];
  if (gym.imageUrl?.trim()) raw.push(gym.imageUrl.trim());
  if (Array.isArray(gym.galleryUrls)) {
    for (const url of gym.galleryUrls) {
      if (typeof url === 'string' && url.trim()) raw.push(url.trim());
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of raw) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(resolveMediaUrl(url));
  }
  return out.length > 0 ? out : [FALLBACK];
}
