import { create } from "zustand";
import type { RecentEntry } from "../types/notebook";
import { listRecents, removeRecent } from "../ipc";

export type AppView = "home" | "notebook";

interface AppState {
  view: AppView;
  recents: RecentEntry[];
  setView: (view: AppView) => void;
  refreshRecents: () => Promise<void>;
  removeRecentEntry: (path: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  view: "home",
  recents: [],

  setView: (view) => set({ view }),

  refreshRecents: async () => {
    const { entries } = await listRecents();
    set({ recents: entries });
  },

  removeRecentEntry: async (path) => {
    const { entries } = await removeRecent(path);
    set({ recents: entries });
  },
}));
