import { create } from 'zustand';
import notificationService from '../services/notificationService';
import type { Notification as ApiNotification } from '../types';

export interface UiNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
  actorId?: string | null;
  actorDisplayName?: string | null;
  actorAvatarUrl?: string | null;
}

interface NotificationState {
  notifications: UiNotification[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Optimistic local-only insert (used after a UI action so the toast appears instantly). */
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
    read: n.read,
    createdAt: n.createdAt,
    actorId: n.actorId ?? null,
    actorDisplayName: n.actorDisplayName ?? null,
    actorAvatarUrl: n.actorAvatarUrl ?? null,
  };
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  isLoading: false,

  refresh: async () => {
    set({ isLoading: true });
    const res = await notificationService.list();
    if (res.data) {
      set({ notifications: res.data.map(fromApi), isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  markAsRead: async (id) => {
    set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
    await notificationService.markRead(id);
  },

  markAllAsRead: async () => {
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
    await notificationService.markAllRead();
  },

  remove: async (id) => {
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
    await notificationService.remove(id);
  },

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
