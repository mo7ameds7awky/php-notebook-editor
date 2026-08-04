import { describe, expect, it } from "vitest";
import { IpcError } from "../ipc/invoke";
import { describeError } from "./errors";
import { ERROR_CODES } from "../types/notebook";

const ipc = (command: string, code: (typeof ERROR_CODES)[number], message = "raw detail") =>
  new IpcError({ command, code, message });

describe("describeError", () => {
  it("covers every contract error code with a friendly title", () => {
    for (const code of ERROR_CODES) {
      const result = describeError(ipc("load_notebook", code));
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.message.length).toBeGreaterThan(0);
      expect(["error", "warning"]).toContain(result.severity);
    }
  });

  it("keeps the raw message as detail, never as the headline", () => {
    const result = describeError(ipc("load_notebook", "io", "EACCES /private/x"));
    expect(result.detail).toBe("EACCES /private/x");
    expect(result.title).not.toContain("EACCES");
  });

  it("distinguishes fileNotFound by originating command", () => {
    const onOpen = describeError(ipc("load_notebook", "fileNotFound"));
    const onSave = describeError(ipc("save_notebook", "fileNotFound"));
    expect(onOpen.title).toBe("Notebook file missing");
    expect(onSave.title).toBe("Notebook file was moved or deleted");
  });

  it("marks newer-version files as a warning, not an error", () => {
    expect(describeError(ipc("load_notebook", "versionUnsupported")).severity).toBe("warning");
  });

  it("falls back safely for non-IPC values", () => {
    const result = describeError(new Error("boom"));
    expect(result.title).toBe("Something went wrong");
    expect(result.detail).toBe("boom");
    expect(describeError("weird").detail).toBe("weird");
  });
});
