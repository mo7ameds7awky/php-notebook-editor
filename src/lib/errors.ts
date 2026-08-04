/** Maps IPC failures to user-facing dialog content. Raw technical text never
 *  leads; it is carried as optional collapsible detail. */

import { IpcError } from "../ipc/invoke";

export type ErrorSeverity = "error" | "warning";

export interface UserFacingError {
  title: string;
  message: string;
  severity: ErrorSeverity;
  /** Raw technical message for an optional details disclosure. */
  detail?: string;
}

const FALLBACK: Omit<UserFacingError, "detail"> = {
  title: "Something went wrong",
  message: "An unexpected problem occurred. Try again, and if it keeps happening, restart the app.",
  severity: "error",
};

export function describeError(e: unknown): UserFacingError {
  if (!(e instanceof IpcError)) {
    return { ...FALLBACK, detail: e instanceof Error ? e.message : String(e) };
  }

  switch (e.code) {
    case "versionUnsupported":
      return {
        title: "Notebook from a newer version",
        message:
          "This notebook was created by a newer version of the app. Update the app to open it — the file has not been changed.",
        severity: "warning",
        detail: e.message,
      };
    case "invalidNotebook":
      return {
        title: "Not a valid notebook",
        message:
          "This file is not a readable notebook. It may be corrupted or not a .pnb.json file. The file has not been changed.",
        severity: "error",
        detail: e.message,
      };
    case "fileNotFound":
      return e.command === "save_notebook"
        ? {
            title: "Notebook file was moved or deleted",
            message: "The original file no longer exists at its path. Save your work to a new location.",
            severity: "warning",
            detail: e.message,
          }
        : {
            title: "Notebook file missing",
            message: "No file exists at that location anymore. It may have been moved, renamed, or deleted.",
            severity: "warning",
            detail: e.message,
          };
    case "conflictOnDisk":
      return {
        title: "File changed on disk",
        message:
          "Another program modified this notebook file since it was opened. Overwrite it or cancel and review.",
        severity: "warning",
        detail: e.message,
      };
    case "io":
      return {
        title: "File access problem",
        message: "The file could not be read or written. Check permissions and available disk space.",
        severity: "error",
        detail: e.message,
      };
    case "runtimeUnavailable":
      return {
        title: "PHP runtime not available",
        message: e.message || "The sandbox runtime is not ready. Check that Docker is installed and running.",
        severity: "warning",
        detail: e.message,
      };
    case "pullFailed":
      return {
        title: "Could not download the PHP image",
        message: "The image download failed. Check your network connection and try again.",
        severity: "error",
        detail: e.message,
      };
    case "invalidInput":
      return {
        title: "Invalid request",
        message: "Something in the request was not valid. Review the values and try again.",
        severity: "error",
        detail: e.message,
      };
    case "internal":
      return { ...FALLBACK, detail: e.message };
  }
}
