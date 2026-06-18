import communityService from '../services/communityService';
import notificationService from '../services/notificationService';
import type { UiNotification } from '../store/useNotificationStore';
import { parseGroupIdFromNotification } from './notificationNavigation';

export interface NotificationActionResult {
  ok: boolean;
  error?: string;
  remove?: boolean;
  message?: string;
  groupName?: string;
}

export async function executeNotificationAction(
  notification: UiNotification,
  action: string
): Promise<NotificationActionResult> {
  const actorId = notification.actorId || (typeof notification.payload?.actorId === 'string' ? notification.payload.actorId : null);
  const groupId = parseGroupIdFromNotification(notification);

  if (action === 'follow.accept') {
    if (!actorId) return { ok: false, error: 'Missing actor' };
    const res = await communityService.acceptFollowRequest(actorId);
    if (res.error) return { ok: false, error: res.error };
    void notificationService.trackEvent(notification.id, 'accepted', { action });
    return { ok: true, message: 'accepted' };
  }

  if (action === 'follow.decline') {
    if (!actorId) return { ok: false, error: 'Missing actor' };
    const res = await communityService.declineFollowRequest(actorId);
    if (res.error) return { ok: false, error: res.error };
    void notificationService.trackEvent(notification.id, 'declined', { action });
    return { ok: true, remove: true };
  }

  if (action === 'group.invite.accept') {
    if (!groupId) return { ok: false, error: 'Missing group' };
    const res = await communityService.acceptGroupInvite(groupId);
    if (res.error) return { ok: false, error: res.error };
    void notificationService.trackEvent(notification.id, 'accepted', { action });
    return { ok: true, message: 'group_joined', groupName: res.data?.name };
  }

  if (action === 'group.invite.decline') {
    if (!groupId) return { ok: false, error: 'Missing group' };
    const res = await communityService.declineGroupInvite(groupId);
    if (res.error) return { ok: false, error: res.error };
    void notificationService.trackEvent(notification.id, 'declined', { action });
    return { ok: true, remove: true };
  }

  if (action === 'group.join.accept') {
    if (!groupId || !actorId) return { ok: false, error: 'Missing group or actor' };
    const res = await communityService.approveGroupJoinRequest(groupId, actorId);
    if (res.error) return { ok: false, error: res.error };
    void notificationService.trackEvent(notification.id, 'accepted', { action });
    return { ok: true, message: 'member_joined', groupName: res.data?.groupName };
  }

  if (action === 'group.join.decline') {
    if (!groupId || !actorId) return { ok: false, error: 'Missing group or actor' };
    const res = await communityService.declineGroupJoinRequest(groupId, actorId);
    if (res.error) return { ok: false, error: res.error };
    void notificationService.trackEvent(notification.id, 'declined', { action });
    return { ok: true, remove: true };
  }

  if (action.startsWith('snooze.')) {
    const res = await notificationService.runAction(notification.id, action);
    if (res.error) return { ok: false, error: res.error };
    void notificationService.trackEvent(notification.id, 'snoozed', { action });
    return { ok: true, remove: true };
  }

  const res = await notificationService.runAction(notification.id, action);
  if (res.error) return { ok: false, error: res.error };
  return { ok: true };
}
