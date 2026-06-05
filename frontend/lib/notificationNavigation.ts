import type { NavigateFunction } from 'react-router-dom';
import { communityProfilePath } from '../features/community/communityUtils';

export interface NotificationNavInput {
  type: string;
  link?: string | null;
  actorId?: string | null;
}

/** Resolve where a notification should open (handles legacy links and missing actor paths). */
export function resolveNotificationTarget(n: NotificationNavInput): string | null {
  const actorProfile = n.actorId ? communityProfilePath(n.actorId) : null;

  if (n.type === 'community.group_invite' || n.type === 'community.group_join_request') {
    return null;
  }

  if (
    n.type === 'community.follow_request' ||
    n.type === 'community.follow' ||
    n.type === 'community.follow_accepted'
  ) {
    return actorProfile;
  }

  if (n.link) {
    if (n.link === '/community/profile' && actorProfile) return actorProfile;
    const legacyOther = n.link.match(/^\/community\/profile\/([^/?#]+)$/);
    if (legacyOther?.[1]) return communityProfilePath(legacyOther[1]);
    return n.link;
  }

  return actorProfile;
}

/** Parse group id from invite links like `/community/groups?g={id}`. */
export function parseGroupIdFromNotificationLink(link?: string | null): string | null {
  if (!link) return null;
  const qIdx = link.indexOf('?');
  if (qIdx < 0) return null;
  return new URLSearchParams(link.slice(qIdx)).get('g');
}

/** Navigate reliably under HashRouter (pathname + search, not a single string). */
export function navigateToNotification(navigate: NavigateFunction, path: string | null | undefined) {
  if (!path) return;
  const qIdx = path.indexOf('?');
  const pathname = qIdx >= 0 ? path.slice(0, qIdx) : path;
  const search = qIdx >= 0 ? path.slice(qIdx) : '';
  navigate({ pathname, search });
}
