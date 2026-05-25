import React from 'react';
import type { CommunityAuthor } from '../../types';
import { useI18n } from '../../lib/i18n/useI18n';
import { timeAgo } from './communityUtils';

export function hasVisiblePresence(author: CommunityAuthor | null | undefined): boolean {
  if (!author) return false;
  return author.isOnline !== undefined || author.lastSeenAt !== undefined;
}

export function resolvePresence(author: CommunityAuthor | null | undefined) {
  if (!author || !hasVisiblePresence(author)) return null;
  const isOnline = author.isOnline === true;
  const hasLastSeen = Boolean(author.lastSeenAt);
  return { isOnline, hasLastSeen };
}

export function presenceStatusText(
  author: CommunityAuthor | null | undefined,
  t: (key: 'community.online' | 'community.offline' | 'community.lastSeen', params?: Record<string, string>) => string,
): string | null {
  if (!author || !hasVisiblePresence(author)) return null;
  const { isOnline, hasLastSeen } = resolvePresence(author) ?? { isOnline: false, hasLastSeen: false };
  if (isOnline) return t('community.online');
  if (hasLastSeen) return t('community.lastSeen', { time: timeAgo(author.lastSeenAt!) });
  return t('community.offline');
}

interface PresenceAvatarDotProps {
  isOnline?: boolean;
  className?: string;
  hidden?: boolean;
}

export const PresenceAvatarDot: React.FC<PresenceAvatarDotProps> = ({ isOnline, className = '', hidden }) => {
  if (hidden || isOnline !== true) return null;
  return (
    <span
      className={`absolute bottom-0 right-0 z-20 size-3.5 rounded-full border-2 border-surface pointer-events-none bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.65)] ${className}`}
      aria-hidden
    />
  );
};

interface PresenceStatusLabelProps {
  author?: CommunityAuthor | null;
  className?: string;
  /** When set, overrides author-based text (e.g. "You are online"). */
  forceOnline?: boolean;
}

export const PresenceStatusLabel: React.FC<PresenceStatusLabelProps> = ({
  author,
  className = '',
  forceOnline,
}) => {
  const { t } = useI18n();
  const text =
    forceOnline === true
      ? t('community.online')
      : forceOnline === false
        ? t('community.offline')
        : presenceStatusText(author, t);
  if (!text) return null;
  const online = forceOnline === true || (forceOnline !== false && author?.isOnline === true);
  return (
    <p
      className={`text-xs font-semibold truncate ${online ? 'text-emerald-400' : 'text-muted'} ${className}`}
      aria-live="polite"
    >
      <span
        className={`inline-block size-2 rounded-full mr-1.5 align-middle ${
          online ? 'bg-emerald-500' : 'bg-zinc-500'
        }`}
        aria-hidden
      />
      {text}
    </p>
  );
};

/** Merges polled presence into an author object when available. */
export function withPolledPresence(
  author: CommunityAuthor | null | undefined,
  polled: { isOnline: boolean; lastSeenAt: string | null } | undefined,
): CommunityAuthor | null | undefined {
  if (!author) return author;
  if (!polled) return author;
  return { ...author, isOnline: polled.isOnline, lastSeenAt: polled.lastSeenAt ?? undefined };
}
