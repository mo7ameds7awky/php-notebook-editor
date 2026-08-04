import { create } from "zustand";
import type { Notebook } from "../types/notebook";
import { createEmptyNotebook } from "../lib/notebook";
import { loadNotebook, saveNotebook } from "../ipc";

interface NotebookState {
  notebook: Notebook | null;
  path: string | null;
  fileMtimeMs: number | null;
  dirty: boolean;
  /** Creates an empty notebook and writes it to a fresh path. */
  createNew: (path: string, title: string) => Promise<void>;
  openFromPath: (path: string) => Promise<void>;
  /** Saves to the current path, asserting the file is unchanged on disk. */
  save: () => Promise<void>;
  /** Saves to the current path, overwriting whatever is on disk. */
  forceSave: () => Promise<void>;
  /** Saves to a new path and adopts it as the notebook's path. */
  saveAs: (path: string) => Promise<void>;
  setTitle: (title: string) => void;
  close: () => void;
}

const CLOSED = {
  notebook: null,
  path: null,
  fileMtimeMs: null,
  dirty: false,
};

export const useNotebookStore = create<NotebookState>((set, get) => ({
  ...CLOSED,

  createNew: async (path, title) => {
    const notebook = createEmptyNotebook(title);
    const { fileMtimeMs } = await saveNotebook(path, notebook, null);
    set({ notebook, path, fileMtimeMs, dirty: false });
  },

  openFromPath: async (path) => {
    const { notebook, fileMtimeMs } = await loadNotebook(path);
    set({ notebook, path, fileMtimeMs, dirty: false });
  },

  save: async () => {
    const { notebook, path, fileMtimeMs } = get();
    if (!notebook || !path) return;
    const result = await saveNotebook(path, notebook, fileMtimeMs);
    set({ fileMtimeMs: result.fileMtimeMs, dirty: false });
  },

  forceSave: async () => {
    const { notebook, path } = get();
    if (!notebook || !path) return;
    const result = await saveNotebook(path, notebook, null);
    set({ fileMtimeMs: result.fileMtimeMs, dirty: false });
  },

  saveAs: async (newPath) => {
    const { notebook } = get();
    if (!notebook) return;
    const result = await saveNotebook(newPath, notebook, null);
    set({ path: newPath, fileMtimeMs: result.fileMtimeMs, dirty: false });
  },

  setTitle: (title) => {
    const { notebook } = get();
    if (!notebook) return;
    set({ notebook: { ...notebook, title }, dirty: true });
  },

  close: () => set({ ...CLOSED }),
}));
