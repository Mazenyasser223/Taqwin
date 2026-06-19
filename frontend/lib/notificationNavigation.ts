import type { NavigateFunction } from 'react-router-dom';
import { communityProfilePath } from '../features/community/communityUtils';
import type { UiNotification } from '../store/useNotificationStore';

export interface NotificationNavInput {
  type: string;
  link?: string | null;
  actorId?: string | null;
  payload?: Record<string, unknown> | null;
}

function postPath(postId: string, commentId?: string) {
  return commentId ? `/community/posts/${postId}?c=${commentId}` : `/community/posts/${postId}`;
}

/** Resolve where a notification should open (payload-first, legacy link fallback). */
export function resolveNotificationTarget(n: NotificationNavInput): string | null {
  const payload = n.payload || {};
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

  if (typeof payload.postId === 'string') {
    return postPath(payload.postId, typeof payload.commentId === 'string' ? payload.commentId : undefined);
  }

  if (typeof payload.groupId === 'string') {
    return `/community/groups?g=${payload.groupId}`;
  }

  if (typeof payload.storyId === 'string') {
    return `/community?story=${payload.storyId}`;
  }

  if (n.link) {
    if (n.link === '/community/profile' && actorProfile) return actorProfile;
    const legacyOther = n.link.match(/^\/community\/profile\/([^/?#]+)$/);
    if (legacyOther?.[1]) return communityProfilePath(legacyOther[1]);
    return n.link;
  }

  return actorProfile;
}

/** Parse group id from payload or invite links like `/community/groups?g={id}`. */
export function parseGroupIdFromNotification(n: Pick<UiNotification, 'link' | 'payload'>): string | null {
  const fromPayload = n.payload?.groupId;
  if (typeof fromPayload === 'string') return fromPayload;
  const link = n.link;
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

/** @deprecated use parseGroupIdFromNotification */
export function parseGroupIdFromNotificationLink(link?: string | null): string | null {
  if (!link) return null;
  const qIdx = link.indexOf('?');
  if (qIdx < 0) return null;
  return new URLSearchParams(link.slice(qIdx)).get('g');
}
