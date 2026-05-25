import { create } from 'zustand';

interface MyPresenceState {
  /** True after a successful heartbeat while this tab is visible. */
  isActive: boolean;
  setActive: (active: boolean) => void;
}

export const useMyPresenceStore = create<MyPresenceState>((set) => ({
  isActive: false,
  setActive: (isActive) => set({ isActive }),
}));
