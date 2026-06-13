import { create } from "zustand";

interface AppState {
  activeCardId: number | null;
  setActiveCardId: (id: number | null) => void;
  dateRange: { from: string; to: string } | null;
  setDateRange: (range: { from: string; to: string } | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeCardId: null,
  setActiveCardId: (id) => set({ activeCardId: id }),
  dateRange: null,
  setDateRange: (range) => set({ dateRange: range }),
}));