import { create } from 'zustand';
import notificationService, { type NotificationFilter } from '../services/notificationService';
import type { Notification as ApiNotification, NotificationAction } from '../types';

export interface UiNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  category?: string;
  priority?: string;
  payload?: Record<string, unknown> | null;
  actions?: NotificationAction[] | null;
  icon?: string | null;
  imageUrl?: string | null;
  actorCount?: number;
  collapsedCount?: number;
  read: boolean;
  readAt?: string | null;
  seenAt?: string | null;
  createdAt: string;
  actorId?: string | null;
  actorDisplayName?: string | null;
  actorAvatarUrl?: string | null;
  actorIds?: { id: string; displayName?: string; avatarUrl?: string | null }[] | null;
}

interface NotificationState {
  notifications: UiNotification[];
  isLoading: boolean;
  isLoadingMore: boolean;
  filter: NotificationFilter;
  nextCursor: string | null;
  hasMore: boolean;
  setFilter: (filter: NotificationFilter) => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsSeen: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  upsertFromRealtime: (n: UiNotification, event: 'new' | 'updated') => void;
  applyReadSync: (id: string, readAt?: string) => void;
  applyReadAllSync: (readAt?: string) => void;
  applyDeletedSync: (id: string) => void;
  addLocal: (n: Omit<UiNotification, 'id' | 'read' | 'createdAt'>) => void;
  unreadCount: () => number;
}

function fromApi(n: ApiNotification): UiNotification {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    link: n.link ?? null,
    category: n.category,
    priority: n.priority,
    payload: n.payload ?? null,
    actions: n.actions ?? null,
    icon: n.icon ?? null,
    imageUrl: n.imageUrl ?? null,
    actorCount: n.actorCount,
    collapsedCount: n.collapsedCount,
    read: n.read,
    readAt: n.readAt ?? null,
    seenAt: n.seenAt ?? null,
    createdAt: n.createdAt,
    actorId: n.actorId ?? null,
    actorDisplayName: n.actorDisplayName ?? null,
    actorAvatarUrl: n.actorAvatarUrl ?? null,
    actorIds: n.actorIds ?? null,
  };
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  isLoading: false,
  isLoadingMore: false,
  filter: 'ALL',
  nextCursor: null,
  hasMore: false,

  setFilter: (filter) => {
    set({ filter });
    void get().refresh();
  },

  refresh: async () => {
    set({ isLoading: true });
    const res = await notificationService.list({ limit: 30, category: get().filter });
    if (res.data) {
      set({
        notifications: res.data.items.map(fromApi),
        nextCursor: res.data.nextCursor,
        hasMore: res.data.hasMore,
        isLoading: false,
      });
    } else {
      set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const { nextCursor, hasMore, isLoadingMore, filter } = get();
    if (!hasMore || !nextCursor || isLoadingMore) return;
    set({ isLoadingMore: true });
    const res = await notificationService.list({ cursor: nextCursor, limit: 30, category: filter });
    if (res.data) {
      set((s) => ({
        notifications: [...s.notifications, ...res.data!.items.map(fromApi)],
        nextCursor: res.data!.nextCursor,
        hasMore: res.data!.hasMore,
        isLoadingMore: false,
      }));
    } else {
      set({ isLoadingMore: false });
    }
  },

  markAsSeen: async () => {
    await notificationService.markSeen();
  },

  markAsRead: async (id) => {
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n
      ),
    }));
    await notificationService.markRead(id);
  },

  markAllAsRead: async () => {
    const now = new Date().toISOString();
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true, readAt: now })),
    }));
    await notificationService.markAllRead();
  },

  remove: async (id) => {
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
    await notificationService.remove(id);
  },

  upsertFromRealtime: (item, event) =>
    set((s) => {
      const filtered = s.notifications.filter((n) => n.id !== item.id);
      if (event === 'updated') {
        return { notifications: [item, ...filtered].slice(0, 100) };
      }
      return { notifications: [item, ...filtered].slice(0, 100) };
    }),

  applyReadSync: (id, readAt) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true, readAt: readAt || new Date().toISOString() } : n
      ),
    })),

  applyReadAllSync: (readAt) => {
    const ts = readAt || new Date().toISOString();
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true, readAt: ts })),
    }));
  },

  applyDeletedSync: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

  addLocal: (n) =>
    set((s) => ({
      notifications: [
        {
          ...n,
          id: `local-${Math.random().toString(36).slice(2)}`,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...s.notifications,
      ],
    })),

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
