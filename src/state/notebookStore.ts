import { create } from "zustand";
import type { CellType, HttpRequestSpec, HttpRunResult, Notebook } from "../types/notebook";
import { createCell, createEmptyNotebook } from "../lib/notebook";
import { cancelRun, loadNotebook, runHttp, saveNotebook } from "../ipc";

interface NotebookState {
  notebook: Notebook | null;
  path: string | null;
  fileMtimeMs: number | null;
  dirty: boolean;
  /** In-flight runs by cell id; presence means running. Never persisted. */
  cellRuns: Record<string, { runId: string }>;
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
  /** Inserts a new cell of the given type at index (appends when omitted). */
  addCell: (type: CellType, index?: number) => void;
  deleteCell: (id: string) => void;
  /** Swaps the cell one position up or down; boundary moves are no-ops. */
  moveCell: (id: string, direction: "up" | "down") => void;
  /** Updates the source of a markdown or php cell. */
  updateCellSource: (id: string, source: string) => void;
  /** Replaces the request of an http cell. */
  updateHttpRequest: (id: string, request: HttpRequestSpec) => void;
  /** Runs an http cell; no-op while that cell is already running. */
  startHttpRun: (cellId: string) => Promise<void>;
  /** Best-effort cancellation of a cell's in-flight run. */
  cancelCellRun: (cellId: string) => void;
  close: () => void;
}

const CLOSED = {
  notebook: null,
  path: null,
  fileMtimeMs: null,
  dirty: false,
  cellRuns: {},
};

export const useNotebookStore = create<NotebookState>((set, get) => ({
  ...CLOSED,

  createNew: async (path, title) => {
    const notebook = createEmptyNotebook(title);
    const { fileMtimeMs } = await saveNotebook(path, notebook, null);
    set({ notebook, path, fileMtimeMs, dirty: false, cellRuns: {} });
  },

  openFromPath: async (path) => {
    const { notebook, fileMtimeMs } = await loadNotebook(path);
    set({ notebook, path, fileMtimeMs, dirty: false, cellRuns: {} });
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

  addCell: (type, index) => {
    const { notebook } = get();
    if (!notebook) return;
    const cells = [...notebook.cells];
    const at = index === undefined ? cells.length : Math.max(0, Math.min(index, cells.length));
    cells.splice(at, 0, createCell(type));
    set({ notebook: { ...notebook, cells }, dirty: true });
  },

  deleteCell: (id) => {
    const { notebook } = get();
    if (!notebook) return;
    const cells = notebook.cells.filter((cell) => cell.id !== id);
    if (cells.length === notebook.cells.length) return;
    set({ notebook: { ...notebook, cells }, dirty: true });
  },

  moveCell: (id, direction) => {
    const { notebook } = get();
    if (!notebook) return;
    const from = notebook.cells.findIndex((cell) => cell.id === id);
    if (from < 0) return;
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= notebook.cells.length) return;
    const cells = [...notebook.cells];
    [cells[from], cells[to]] = [cells[to], cells[from]];
    set({ notebook: { ...notebook, cells }, dirty: true });
  },

  updateCellSource: (id, source) => {
    const { notebook } = get();
    if (!notebook) return;
    const cells = notebook.cells.map((cell) =>
      cell.id === id && (cell.type === "markdown" || cell.type === "php")
        ? { ...cell, source }
        : cell,
    );
    set({ notebook: { ...notebook, cells }, dirty: true });
  },

  updateHttpRequest: (id, request) => {
    const { notebook } = get();
    if (!notebook) return;
    const cells = notebook.cells.map((cell) =>
      cell.id === id && cell.type === "http" ? { ...cell, request } : cell,
    );
    set({ notebook: { ...notebook, cells }, dirty: true });
  },

  startHttpRun: async (cellId) => {
    const { notebook, cellRuns } = get();
    if (!notebook || cellRuns[cellId]) return;
    const cell = notebook.cells.find((c) => c.id === cellId);
    if (!cell || cell.type !== "http") return;

    const runId = crypto.randomUUID();
    set({ cellRuns: { ...get().cellRuns, [cellId]: { runId } } });

    const clearRunning = () => {
      const runs = { ...get().cellRuns };
      delete runs[cellId];
      set({ cellRuns: runs });
    };

    let result: HttpRunResult;
    try {
      result = await runHttp(runId, cell.request);
    } catch (e) {
      clearRunning();
      throw e;
    }
    clearRunning();

    const current = get().notebook;
    if (!current) return;
    const cells = current.cells.map((c) =>
      c.id === cellId && c.type === "http" ? { ...c, lastRun: result } : c,
    );
    set({ notebook: { ...current, cells }, dirty: true });
  },

  cancelCellRun: (cellId) => {
    const run = get().cellRuns[cellId];
    if (run) void cancelRun(run.runId).catch(() => undefined);
  },

  close: () => set({ ...CLOSED }),
}));
