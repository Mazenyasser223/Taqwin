import { create } from 'zustand';

export type PageChromeAlert = {
  tone: 'warning' | 'info';
  title: string;
  subtitle?: string;
  detail?: string;
  actionLabel: string;
  onAction: () => void;
};

export type PageChromeBack = {
  to: string;
  label: string;
};

interface PageChromeState {
  title: string | null;
  back: PageChromeBack | null;
  alert: PageChromeAlert | null;
  setTitle: (title: string | null) => void;
  setBack: (back: PageChromeBack | null) => void;
  setAlert: (alert: PageChromeAlert | null) => void;
  clear: () => void;
}

export const usePageChromeStore = create<PageChromeState>((set) => ({
  title: null,
  back: null,
  alert: null,
  setTitle: (title) => set({ title }),
  setBack: (back) => set({ back }),
  setAlert: (alert) => set({ alert }),
  clear: () => set({ title: null, back: null, alert: null }),
}));
