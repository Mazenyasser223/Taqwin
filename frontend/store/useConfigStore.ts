
import { create } from 'zustand';

interface ConfigState {
  performanceMode: boolean;
  setPerformanceMode: (mode: boolean) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  performanceMode: false, // Default: High quality
  setPerformanceMode: (performanceMode) => set({ performanceMode }),
}));
