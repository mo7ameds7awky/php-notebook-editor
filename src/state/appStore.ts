import { create } from "zustand";
import type { RecentEntry, RuntimeHealth } from "../types/notebook";
import { checkPhpRuntime, listRecents, pullPhpImage, removeRecent } from "../ipc";

export type AppView = "home" | "notebook";

interface AppState {
  view: AppView;
  recents: RecentEntry[];
  /** Latest PHP runtime probe; null until the first probe completes. */
  runtimeHealth: RuntimeHealth | null;
  pullingImage: boolean;
  setView: (view: AppView) => void;
  refreshRecents: () => Promise<void>;
  removeRecentEntry: (path: string) => Promise<void>;
  /** Probes the runtime; a failed probe leaves the previous state in place. */
  refreshRuntimeHealth: () => Promise<void>;
  /** Pulls the PHP image and stores the fresh probe; rethrows failures. */
  pullImage: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  view: "home",
  recents: [],
  runtimeHealth: null,
  pullingImage: false,

  setView: (view) => set({ view }),

  refreshRecents: async () => {
    const { entries } = await listRecents();
    set({ recents: entries });
  },

  removeRecentEntry: async (path) => {
    const { entries } = await removeRecent(path);
    set({ recents: entries });
  },

  refreshRuntimeHealth: async () => {
    try {
      set({ runtimeHealth: await checkPhpRuntime() });
    } catch {
      // Probe transport failure: keep whatever we knew; runs re-probe anyway.
    }
  },

  pullImage: async () => {
    set({ pullingImage: true });
    try {
      set({ runtimeHealth: await pullPhpImage() });
    } finally {
      set({ pullingImage: false });
    }
  },
}));
