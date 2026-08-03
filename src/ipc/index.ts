/** Typed wrappers for the backend IPC commands. */

import { ipcCall } from "./invoke";
import type {
  CancelRunResult,
  HttpRequestSpec,
  HttpRunResult,
  ListRecentsResult,
  LoadNotebookResult,
  Notebook,
  PhpRunResult,
  RuntimeHealth,
  SaveNotebookResult,
} from "../types/notebook";

/** Loads and validates a notebook file. */
export const loadNotebook = (path: string) =>
  ipcCall<LoadNotebookResult>("load_notebook", { path });

/** Atomically saves a notebook; a null expectedMtimeMs means an intentional write to a fresh path. */
export const saveNotebook = (
  path: string,
  notebook: Notebook,
  expectedMtimeMs: number | null,
) => ipcCall<SaveNotebookResult>("save_notebook", { path, notebook, expectedMtimeMs });

export const listRecents = () => ipcCall<ListRecentsResult>("list_recents");

export const removeRecent = (path: string) =>
  ipcCall<ListRecentsResult>("remove_recent", { path });

/** Runs an HTTP request; placeholders must already be resolved by the caller. */
export const runHttp = (runId: string, request: HttpRequestSpec) =>
  ipcCall<HttpRunResult>("run_http", { runId, request });

/** Runs PHP in the sandbox; null limits fall back to backend defaults. */
export const runPhp = (
  runId: string,
  code: string,
  timeoutMs: number | null = null,
  memoryLimitMb: number | null = null,
) => ipcCall<PhpRunResult>("run_php", { runId, code, timeoutMs, memoryLimitMb });

/** Best-effort cancellation of an in-flight run. */
export const cancelRun = (runId: string) =>
  ipcCall<CancelRunResult>("cancel_run", { runId });

export const checkPhpRuntime = () => ipcCall<RuntimeHealth>("check_php_runtime");

export const pullPhpImage = () => ipcCall<RuntimeHealth>("pull_php_image");

export { IpcError, ipcCall } from "./invoke";
