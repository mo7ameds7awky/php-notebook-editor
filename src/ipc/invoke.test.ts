import { describe, expect, it } from "vitest";
import { IpcError, toIpcFailure } from "./invoke";

describe("toIpcFailure", () => {
  it("passes a contract CommandError through and attaches the command", () => {
    const failure = toIpcFailure("save_notebook", {
      code: "conflictOnDisk",
      message: "file changed on disk",
    });
    expect(failure).toEqual({
      command: "save_notebook",
      code: "conflictOnDisk",
      message: "file changed on disk",
    });
  });

  it("keeps command context distinct for the same code", () => {
    const fromLoad = toIpcFailure("load_notebook", { code: "fileNotFound", message: "gone" });
    const fromSave = toIpcFailure("save_notebook", { code: "fileNotFound", message: "gone" });
    expect(fromLoad.command).toBe("load_notebook");
    expect(fromSave.command).toBe("save_notebook");
  });

  it("maps unknown error codes to internal", () => {
    const failure = toIpcFailure("run_php", { code: "kaboom", message: "??" });
    expect(failure.code).toBe("internal");
  });

  it("maps thrown Error instances to internal with their message", () => {
    const failure = toIpcFailure("run_http", new Error("socket hangup"));
    expect(failure).toEqual({
      command: "run_http",
      code: "internal",
      message: "socket hangup",
    });
  });

  it("stringifies arbitrary rejection values", () => {
    const failure = toIpcFailure("list_recents", "totally broken");
    expect(failure.code).toBe("internal");
    expect(failure.message).toBe("totally broken");
  });
});

describe("IpcError", () => {
  it("exposes command and code as typed fields", () => {
    const error = new IpcError({
      command: "save_notebook",
      code: "fileNotFound",
      message: "original file was moved or deleted",
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("IpcError");
    expect(error.command).toBe("save_notebook");
    expect(error.code).toBe("fileNotFound");
    expect(error.message).toBe("original file was moved or deleted");
  });
});
