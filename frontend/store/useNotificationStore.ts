import { create } from 'zustand';
import notificationService, {
  type NotificationFilter,
  notificationMatchesFilter,
} from '../services/notificationService';
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
  listRequestId: number;
  unreadTotal: number;
  setFilter: (filter: NotificationFilter) => void;
  resetDrawerFilter: () => void;
  refresh: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
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

function applyListResult(
  set: (partial: Partial<NotificationState> | ((s: NotificationState) => Partial<NotificationState>)) => void,
  get: () => NotificationState,
  filterAtStart: NotificationFilter,
  requestId: number,
  items: ApiNotification[],
  nextCursor: string | null,
  hasMore: boolean,
) {
  if (get().listRequestId !== requestId || get().filter !== filterAtStart) return;
  set({
    notifications: items.map(fromApi),
    nextCursor,
    hasMore,
    isLoading: false,
    isLoadingMore: false,
  });
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  isLoading: false,
  isLoadingMore: false,
  filter: 'ALL',
  nextCursor: null,
  hasMore: false,
  listRequestId: 0,
  unreadTotal: 0,

  setFilter: (filter) => {
    if (get().filter === filter && !get().isLoading) {
      void get().refresh();
      return;
    }
    const requestId = get().listRequestId + 1;
    set({
      filter,
      listRequestId: requestId,
      isLoading: true,
      nextCursor: null,
      hasMore: false,
    });
    void (async () => {
      const res = await notificationService.list({ limit: 30, category: filter });
      if (!res.data) {
        if (get().listRequestId === requestId && get().filter === filter) {
          set({ isLoading: false });
        }
        return;
      }
      applyListResult(set, get, filter, requestId, res.data.items, res.data.nextCursor, res.data.hasMore);
    })();
  },

  resetDrawerFilter: () => {
    if (get().filter === 'ALL') return;
    get().setFilter('ALL');
  },

  refresh: async () => {
    const filterAtStart = get().filter;
    const requestId = get().listRequestId + 1;
    set({ isLoading: true, listRequestId: requestId });

    const res = await notificationService.list({ limit: 30, category: filterAtStart });
    if (!res.data) {
      if (get().listRequestId === requestId) set({ isLoading: false });
      return;
    }
    applyListResult(set, get, filterAtStart, requestId, res.data.items, res.data.nextCursor, res.data.hasMore);
    void get().refreshUnreadCount();
  },

  refreshUnreadCount: async () => {
    const res = await notificationService.unreadCount();
    if (res.data && typeof res.data.unread === 'number') {
      set({ unreadTotal: res.data.unread });
    }
  },

  loadMore: async () => {
    const { nextCursor, hasMore, isLoadingMore, filter, listRequestId } = get();
    if (!hasMore || !nextCursor || isLoadingMore) return;

    const filterAtStart = filter;
    const cursorAtStart = nextCursor;
    const requestId = listRequestId + 1;
    set({ isLoadingMore: true, listRequestId: requestId });

    const res = await notificationService.list({
      cursor: cursorAtStart,
      limit: 30,
      category: filterAtStart,
    });

    if (get().listRequestId !== requestId || get().filter !== filterAtStart) {
      set({ isLoadingMore: false });
      return;
    }

    if (!res.data) {
      set({ isLoadingMore: false });
      return;
    }

    set((s) => ({
      notifications: [...s.notifications, ...res.data!.items.map(fromApi)],
      nextCursor: res.data!.nextCursor,
      hasMore: res.data!.hasMore,
      isLoadingMore: false,
    }));
  },

  markAsSeen: async () => {
    await notificationService.markSeen();
  },

  markAsRead: async (id) => {
    set((s) => {
      const updated = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n,
      );
      return {
        notifications: s.filter === 'UNREAD' ? updated.filter((n) => n.id !== id) : updated,
        unreadTotal: Math.max(0, s.unreadTotal - 1),
      };
    });
    await notificationService.markRead(id);
  },

  markAllAsRead: async () => {
    const filterAtStart = get().filter;
    const now = new Date().toISOString();
    set((s) => ({
      notifications:
        s.filter === 'UNREAD' ? [] : s.notifications.map((n) => ({ ...n, read: true, readAt: now })),
      unreadTotal: 0,
    }));
    await notificationService.markAllRead();
    if (filterAtStart === 'UNREAD') {
      set({ notifications: [], unreadTotal: 0, isLoading: false });
    } else {
      await get().refresh();
    }
    void get().refreshUnreadCount();
  },

  remove: async (id) => {
    set((s) => {
      const removed = s.notifications.find((n) => n.id === id);
      return {
        notifications: s.notifications.filter((n) => n.id !== id),
        unreadTotal: removed && !removed.read ? Math.max(0, s.unreadTotal - 1) : s.unreadTotal,
      };
    });
    await notificationService.remove(id);
  },

  upsertFromRealtime: (item, _event) =>
    set((s) => {
      const filtered = s.notifications.filter((n) => n.id !== item.id);
      const wasInList = s.notifications.length !== filtered.length;
      const unreadDelta = !item.read && !wasInList ? 1 : 0;

      if (!notificationMatchesFilter(item, s.filter)) {
        if (wasInList) {
          return {
            notifications: filtered,
            unreadTotal: item.read ? s.unreadTotal : Math.max(0, s.unreadTotal - 1),
          };
        }
        return { unreadTotal: s.unreadTotal + unreadDelta };
      }

      return {
        notifications: [item, ...filtered].slice(0, 100),
        unreadTotal: s.unreadTotal + unreadDelta,
      };
    }),

  applyReadSync: (id, readAt) =>
    set((s) => {
      const ts = readAt || new Date().toISOString();
      const target = s.notifications.find((n) => n.id === id);
      const updated = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true, readAt: ts } : n,
      );
      return {
        notifications: s.filter === 'UNREAD' ? updated.filter((n) => n.id !== id) : updated,
        unreadTotal: target && !target.read ? Math.max(0, s.unreadTotal - 1) : s.unreadTotal,
      };
    }),

  applyReadAllSync: () => {
    set((s) => {
      const ts = new Date().toISOString();
      if (s.filter === 'UNREAD') return { notifications: [], unreadTotal: 0 };
      return {
        notifications: s.notifications.map((n) => ({ ...n, read: true, readAt: ts })),
        unreadTotal: 0,
      };
    });
  },

  applyDeletedSync: (id) =>
    set((s) => {
      const removed = s.notifications.find((n) => n.id === id);
      return {
        notifications: s.notifications.filter((n) => n.id !== id),
        unreadTotal: removed && !removed.read ? Math.max(0, s.unreadTotal - 1) : s.unreadTotal,
      };
    }),

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
      unreadTotal: s.unreadTotal + 1,
    })),

  unreadCount: () => get().unreadTotal,
}));
