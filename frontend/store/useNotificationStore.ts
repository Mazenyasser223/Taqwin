
import { create } from 'zustand';

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'alert' | 'update' | 'social';
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'time' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [
    { id: '1', title: 'New Workout Plan', message: 'You are recovering well. We updated your workout for tomorrow.', time: '2m ago', type: 'alert', read: false },
    { id: '2', title: 'Trainer Post', message: 'Elena Vance shared a new guide on muscle growth.', time: '1h ago', type: 'social', read: false },
    { id: '3', title: 'Data Synced', message: 'Your latest workout data was successfully saved.', time: '3h ago', type: 'update', read: true },
  ],
  addNotification: (n) => set((state) => ({
    notifications: [
      { ...n, id: Math.random().toString(36).substr(2, 9), time: 'Just now', read: false },
      ...state.notifications
    ]
  })),
  markAsRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
  })),
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true }))
  })),
  unreadCount: () => get().notifications.filter(n => !n.read).length,
}));
