import type { CommunityAuthor, UserRole } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';

export function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}

export const fallbackAvatar = (id: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(id)}`;

export function displayName(author?: CommunityAuthor | null) {
  return author?.profile?.displayName ?? author?.email?.split('@')[0] ?? 'Member';
}

/** Own profile → Profile tab; other users → Browse (view profile). */
export function communityProfilePath(userId?: string | null) {
  const myId = useAuthStore.getState().user?.id;
  if (!userId || userId === myId) return '/community/profile';
  return `/community/browse/${userId}`;
}

export function roleLabel(role?: UserRole) {
  if (role === 'trainer') return 'COACH';
  if (role === 'gym') return 'GYM';
  return 'ATHLETE';
}

export { isVideoMediaFile } from '../../lib/mediaFile';

/** Best MIME type for MediaRecorder in this browser (inbox voice notes). */
export function pickVoiceRecorderMime(): { mime: string; ext: string } {
  const candidates: { mime: string; ext: string }[] = [
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
    { mime: 'audio/mp4', ext: 'm4a' },
    { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
  ];
  if (typeof MediaRecorder !== 'undefined') {
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    }
  }
  return { mime: 'audio/webm', ext: 'webm' };
}

export function isVideoMediaUrl(url?: string | null) {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}
