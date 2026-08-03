/**
 * Typed IPC layer over Tauri `invoke`; every rejection is normalized into an
 * `IpcError` carrying the originating command alongside the error code.
 */

import { invoke } from "@tauri-apps/api/core";
import type { CommandError, ErrorCode } from "../types/notebook";
import { isErrorCode } from "../types/notebook";

export interface IpcFailure extends CommandError {
  command: string;
}

export class IpcError extends Error {
  readonly command: string;
  readonly code: ErrorCode;

  constructor(failure: IpcFailure) {
    super(failure.message);
    this.name = "IpcError";
    this.command = failure.command;
    this.code = failure.code;
  }
}

/** Normalizes a rejection value into a typed IPC failure. */
export function toIpcFailure(command: string, raw: unknown): IpcFailure {
  if (raw !== null && typeof raw === "object" && "code" in raw && "message" in raw) {
    const { code, message } = raw as { code: unknown; message: unknown };
    if (isErrorCode(code) && typeof message === "string") {
      return { command, code, message };
    }
  }
  const message = raw instanceof Error ? raw.message : String(raw);
  return { command, code: "internal", message };
}

export async function ipcCall<TRes>(
  command: string,
  payload?: Record<string, unknown>,
): Promise<TRes> {
  try {
    return await invoke<TRes>(command, payload);
  } catch (raw) {
    throw new IpcError(toIpcFailure(command, raw));
  }
}
