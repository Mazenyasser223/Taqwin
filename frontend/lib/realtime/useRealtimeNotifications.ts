import { useEffect } from 'react';
import { useNotificationStore, type UiNotification } from '../../store/useNotificationStore';
import { useRealtimeStore } from './useRealtimeStore';

/** Push notification.new WebSocket events into the notification store. */
export function useRealtimeNotifications() {
  const subscribe = useRealtimeStore((s) => s.subscribe);
  const connectionState = useRealtimeStore((s) => s.connectionState);

  useEffect(() => {
    if (connectionState !== 'open') return;

    return subscribe('notification.new', (env) => {
      const raw = env.notification as Record<string, unknown> | undefined;
      if (!raw || typeof raw.id !== 'string') return;

      const item: UiNotification = {
        id: raw.id,
        title: String(raw.title || ''),
        message: String(raw.message || ''),
        type: String(raw.type || ''),
        link: typeof raw.link === 'string' ? raw.link : null,
        read: Boolean(raw.read),
        createdAt: String(raw.createdAt || new Date().toISOString()),
        actorId: typeof raw.actorId === 'string' ? raw.actorId : null,
        actorDisplayName: typeof raw.actorDisplayName === 'string' ? raw.actorDisplayName : null,
        actorAvatarUrl: typeof raw.actorAvatarUrl === 'string' ? raw.actorAvatarUrl : null,
      };

      useNotificationStore.setState((s) => ({
        notifications: [item, ...s.notifications.filter((n) => n.id !== item.id)].slice(0, 50),
      }));
    });
  }, [connectionState, subscribe]);
}
