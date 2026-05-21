import type { CommunityAuthor, UserRole } from '../../types';

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

export function roleLabel(role?: UserRole) {
  if (role === 'trainer') return 'COACH';
  if (role === 'gym') return 'GYM';
  return 'ATHLETE';
}

export function isVideoMediaUrl(url?: string | null) {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}
