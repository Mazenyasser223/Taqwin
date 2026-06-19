import { useEffect } from 'react';
import { useNotificationStore, type UiNotification } from '../../store/useNotificationStore';
import { useRealtimeStore } from './useRealtimeStore';

function rawToUi(raw: Record<string, unknown>): UiNotification | null {
  if (!raw || typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    title: String(raw.title || ''),
    message: String(raw.message || ''),
    type: String(raw.type || ''),
    link: typeof raw.link === 'string' ? raw.link : null,
    category: typeof raw.category === 'string' ? raw.category : undefined,
    priority: typeof raw.priority === 'string' ? raw.priority : undefined,
    payload: raw.payload && typeof raw.payload === 'object' ? (raw.payload as Record<string, unknown>) : null,
    actions: Array.isArray(raw.actions) ? (raw.actions as UiNotification['actions']) : null,
    icon: typeof raw.icon === 'string' ? raw.icon : null,
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : null,
    actorCount: typeof raw.actorCount === 'number' ? raw.actorCount : undefined,
    collapsedCount: typeof raw.collapsedCount === 'number' ? raw.collapsedCount : undefined,
    read: Boolean(raw.read || raw.readAt),
    readAt: typeof raw.readAt === 'string' ? raw.readAt : null,
    seenAt: typeof raw.seenAt === 'string' ? raw.seenAt : null,
    createdAt: String(raw.createdAt || new Date().toISOString()),
    actorId: typeof raw.actorId === 'string' ? raw.actorId : null,
    actorDisplayName: typeof raw.actorDisplayName === 'string' ? raw.actorDisplayName : null,
    actorAvatarUrl: typeof raw.actorAvatarUrl === 'string' ? raw.actorAvatarUrl : null,
    actorIds: Array.isArray(raw.actorIds) ? (raw.actorIds as UiNotification['actorIds']) : null,
  };
}

/** Push notification WebSocket events into the notification store. */
export function useRealtimeNotifications() {
  const subscribe = useRealtimeStore((s) => s.subscribe);
  const connectionState = useRealtimeStore((s) => s.connectionState);

  useEffect(() => {
    if (connectionState !== 'open') return;

    const unsubs = [
      subscribe('notification.new', (env) => {
        const item = rawToUi((env.notification as Record<string, unknown>) || {});
        if (!item) return;
        useNotificationStore.getState().upsertFromRealtime(item, 'new');
      }),
      subscribe('notification.updated', (env) => {
        const item = rawToUi((env.notification as Record<string, unknown>) || {});
        if (!item) return;
        useNotificationStore.getState().upsertFromRealtime(item, 'updated');
      }),
      subscribe('notification.read', (env) => {
        const raw = env.notification as Record<string, unknown> | undefined;
        if (!raw?.id) return;
        useNotificationStore.getState().applyReadSync(String(raw.id), typeof raw.readAt === 'string' ? raw.readAt : undefined);
      }),
      subscribe('notification.read_all', (env) => {
        useNotificationStore.getState().applyReadAllSync(typeof env.readAt === 'string' ? env.readAt : undefined);
      }),
      subscribe('notification.deleted', (env) => {
        if (typeof env.id !== 'string') return;
        useNotificationStore.getState().applyDeletedSync(env.id);
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [connectionState, subscribe]);
}
