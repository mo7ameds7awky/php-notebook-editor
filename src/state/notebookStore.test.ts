import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNotebookStore } from "./notebookStore";
import { IpcError } from "../ipc/invoke";
import type { Notebook } from "../types/notebook";

vi.mock("../ipc", () => ({
  loadNotebook: vi.fn(),
  saveNotebook: vi.fn(),
  runHttp: vi.fn(),
  cancelRun: vi.fn(),
}));

import { cancelRun, loadNotebook, runHttp, saveNotebook } from "../ipc";

const mockLoad = vi.mocked(loadNotebook);
const mockSave = vi.mocked(saveNotebook);
const mockRunHttp = vi.mocked(runHttp);
const mockCancelRun = vi.mocked(cancelRun);

const sampleNotebook = (): Notebook => ({
  schemaVersion: 1,
  title: "Sample",
  cells: [],
  envVars: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  useNotebookStore.getState().close();
});

describe("createNew", () => {
  it("writes a fresh file and holds a clean session", async () => {
    mockSave.mockResolvedValue({ fileMtimeMs: 111 });
    await useNotebookStore.getState().createNew("/x/new.pnb.json", "new");
    expect(mockSave).toHaveBeenCalledWith(
      "/x/new.pnb.json",
      expect.objectContaining({ title: "new", schemaVersion: 1 }),
      null,
    );
    const state = useNotebookStore.getState();
    expect(state.path).toBe("/x/new.pnb.json");
    expect(state.fileMtimeMs).toBe(111);
    expect(state.dirty).toBe(false);
  });
});

describe("openFromPath", () => {
  it("loads a notebook into a clean session", async () => {
    mockLoad.mockResolvedValue({ notebook: sampleNotebook(), fileMtimeMs: 42 });
    await useNotebookStore.getState().openFromPath("/x/s.pnb.json");
    const state = useNotebookStore.getState();
    expect(state.notebook?.title).toBe("Sample");
    expect(state.fileMtimeMs).toBe(42);
    expect(state.dirty).toBe(false);
  });

  it("propagates load failures untouched", async () => {
    mockLoad.mockRejectedValue(
      new IpcError({ command: "load_notebook", code: "fileNotFound", message: "gone" }),
    );
    await expect(useNotebookStore.getState().openFromPath("/x/gone.pnb.json")).rejects.toMatchObject(
      { code: "fileNotFound", command: "load_notebook" },
    );
    expect(useNotebookStore.getState().notebook).toBeNull();
  });
});

describe("editing and saving", () => {
  beforeEach(async () => {
    mockLoad.mockResolvedValue({ notebook: sampleNotebook(), fileMtimeMs: 42 });
    await useNotebookStore.getState().openFromPath("/x/s.pnb.json");
  });

  it("setTitle marks the session dirty", () => {
    useNotebookStore.getState().setTitle("Renamed");
    const state = useNotebookStore.getState();
    expect(state.notebook?.title).toBe("Renamed");
    expect(state.dirty).toBe(true);
  });

  it("save sends the stored mtime and clears dirty", async () => {
    useNotebookStore.getState().setTitle("Renamed");
    mockSave.mockResolvedValue({ fileMtimeMs: 99 });
    await useNotebookStore.getState().save();
    expect(mockSave).toHaveBeenCalledWith(
      "/x/s.pnb.json",
      expect.objectContaining({ title: "Renamed" }),
      42,
    );
    const state = useNotebookStore.getState();
    expect(state.fileMtimeMs).toBe(99);
    expect(state.dirty).toBe(false);
  });

  it("a conflict keeps the session dirty and the mtime unchanged", async () => {
    useNotebookStore.getState().setTitle("Renamed");
    mockSave.mockRejectedValue(
      new IpcError({ command: "save_notebook", code: "conflictOnDisk", message: "changed" }),
    );
    await expect(useNotebookStore.getState().save()).rejects.toMatchObject({
      code: "conflictOnDisk",
    });
    const state = useNotebookStore.getState();
    expect(state.dirty).toBe(true);
    expect(state.fileMtimeMs).toBe(42);
  });

  it("forceSave overwrites without an mtime assertion", async () => {
    mockSave.mockResolvedValue({ fileMtimeMs: 120 });
    await useNotebookStore.getState().forceSave();
    expect(mockSave).toHaveBeenCalledWith("/x/s.pnb.json", expect.anything(), null);
    expect(useNotebookStore.getState().fileMtimeMs).toBe(120);
  });

  it("saveAs adopts the new path", async () => {
    mockSave.mockResolvedValue({ fileMtimeMs: 7 });
    await useNotebookStore.getState().saveAs("/y/copy.pnb.json");
    expect(mockSave).toHaveBeenCalledWith("/y/copy.pnb.json", expect.anything(), null);
    const state = useNotebookStore.getState();
    expect(state.path).toBe("/y/copy.pnb.json");
    expect(state.dirty).toBe(false);
  });

  it("close resets the session", () => {
    useNotebookStore.getState().setTitle("Renamed");
    useNotebookStore.getState().close();
    const state = useNotebookStore.getState();
    expect(state.notebook).toBeNull();
    expect(state.path).toBeNull();
    expect(state.dirty).toBe(false);
  });
});

describe("cell mutations", () => {
  beforeEach(async () => {
    mockLoad.mockResolvedValue({ notebook: sampleNotebook(), fileMtimeMs: 42 });
    await useNotebookStore.getState().openFromPath("/x/s.pnb.json");
  });

  const cells = () => useNotebookStore.getState().notebook?.cells ?? [];
  const types = () => cells().map((c) => c.type);

  it("addCell appends by default and inserts at an index", () => {
    const store = useNotebookStore.getState();
    store.addCell("markdown");
    store.addCell("php");
    useNotebookStore.getState().addCell("http", 1);
    expect(types()).toEqual(["markdown", "http", "php"]);
    expect(useNotebookStore.getState().dirty).toBe(true);
  });

  it("addCell clamps out-of-range indexes", () => {
    const store = useNotebookStore.getState();
    store.addCell("markdown", 99);
    useNotebookStore.getState().addCell("php", -5);
    expect(types()).toEqual(["php", "markdown"]);
  });

  it("generated cell ids stay unique", () => {
    const store = useNotebookStore.getState();
    for (let i = 0; i < 20; i++) store.addCell("markdown");
    const ids = cells().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("deleteCell removes exactly the target", () => {
    const store = useNotebookStore.getState();
    store.addCell("markdown");
    store.addCell("php");
    const target = cells()[0].id;
    useNotebookStore.getState().deleteCell(target);
    expect(types()).toEqual(["php"]);
    expect(cells().some((c) => c.id === target)).toBe(false);
  });

  it("moveCell swaps neighbors and no-ops at boundaries", () => {
    const store = useNotebookStore.getState();
    store.addCell("markdown");
    store.addCell("php");
    store.addCell("http");
    const [a, b, c] = cells().map((x) => x.id);
    useNotebookStore.getState().moveCell(b, "up");
    expect(cells().map((x) => x.id)).toEqual([b, a, c]);
    useNotebookStore.getState().moveCell(b, "up");
    expect(cells().map((x) => x.id)).toEqual([b, a, c]);
    useNotebookStore.getState().moveCell(c, "down");
    expect(cells().map((x) => x.id)).toEqual([b, a, c]);
  });

  it("updateCellSource touches markdown/php only", () => {
    const store = useNotebookStore.getState();
    store.addCell("markdown");
    store.addCell("http");
    const [md, http] = cells();
    useNotebookStore.getState().updateCellSource(md.id, "# hi");
    useNotebookStore.getState().updateCellSource(http.id, "ignored");
    const after = cells();
    expect(after[0]).toMatchObject({ type: "markdown", source: "# hi" });
    expect(after[1].type).toBe("http");
    expect("source" in after[1]).toBe(false);
  });

  it("startHttpRun stores the terminal result in lastRun and clears running state", async () => {
    const store = useNotebookStore.getState();
    store.addCell("http");
    const cellId = cells()[0].id;
    mockRunHttp.mockResolvedValue({
      status: "succeeded",
      response: { statusCode: 200, headers: [], body: "ok", bodyTruncated: false },
      durationMs: 12,
      ranAt: "2026-08-04T10:00:00Z",
    });

    await useNotebookStore.getState().startHttpRun(cellId);

    const cell = cells()[0];
    expect(cell).toMatchObject({
      type: "http",
      lastRun: { status: "succeeded", response: { statusCode: 200 } },
    });
    expect(useNotebookStore.getState().cellRuns[cellId]).toBeUndefined();
    expect(useNotebookStore.getState().dirty).toBe(true);
  });

  it("blocks duplicate runs for the same cell while running", async () => {
    const store = useNotebookStore.getState();
    store.addCell("http");
    const cellId = cells()[0].id;
    let release!: (r: import("../types/notebook").HttpRunResult) => void;
    mockRunHttp.mockImplementation(
      () => new Promise((resolve) => (release = resolve)),
    );

    const first = useNotebookStore.getState().startHttpRun(cellId);
    expect(useNotebookStore.getState().cellRuns[cellId]).toBeDefined();
    await useNotebookStore.getState().startHttpRun(cellId);
    expect(mockRunHttp).toHaveBeenCalledTimes(1);

    release({ status: "cancelled", error: { kind: "cancelled", message: "x" }, durationMs: 1, ranAt: "2026-08-04T10:00:00Z" });
    await first;
    expect(useNotebookStore.getState().cellRuns[cellId]).toBeUndefined();
  });

  it("running state never persists into the notebook while in flight", async () => {
    const store = useNotebookStore.getState();
    store.addCell("http");
    const cellId = cells()[0].id;
    let release!: (r: import("../types/notebook").HttpRunResult) => void;
    mockRunHttp.mockImplementation(
      () => new Promise((resolve) => (release = resolve)),
    );

    const pending = useNotebookStore.getState().startHttpRun(cellId);
    const inFlightCell = cells()[0];
    expect(inFlightCell.type === "http" && inFlightCell.lastRun).toBeFalsy();

    release({ status: "failed", error: { kind: "network", message: "down" }, durationMs: 3, ranAt: "2026-08-04T10:00:00Z" });
    await pending;
    const after = cells()[0];
    expect(after).toMatchObject({ lastRun: { status: "failed", error: { kind: "network" } } });
  });

  it("a thrown command error clears running state and propagates", async () => {
    const store = useNotebookStore.getState();
    store.addCell("http");
    const cellId = cells()[0].id;
    mockRunHttp.mockRejectedValue(
      new IpcError({ command: "run_http", code: "invalidInput", message: "bad url" }),
    );

    await expect(useNotebookStore.getState().startHttpRun(cellId)).rejects.toMatchObject({
      code: "invalidInput",
    });
    expect(useNotebookStore.getState().cellRuns[cellId]).toBeUndefined();
    const cell = cells()[0];
    expect(cell.type === "http" && cell.lastRun).toBeFalsy();
  });

  it("cancelCellRun forwards the active runId", async () => {
    const store = useNotebookStore.getState();
    store.addCell("http");
    const cellId = cells()[0].id;
    let release!: (r: import("../types/notebook").HttpRunResult) => void;
    mockRunHttp.mockImplementation(
      () => new Promise((resolve) => (release = resolve)),
    );
    mockCancelRun.mockResolvedValue({ cancelled: true });

    const pending = useNotebookStore.getState().startHttpRun(cellId);
    const { runId } = useNotebookStore.getState().cellRuns[cellId];
    useNotebookStore.getState().cancelCellRun(cellId);
    expect(mockCancelRun).toHaveBeenCalledWith(runId);

    release({ status: "cancelled", error: { kind: "cancelled", message: "x" }, durationMs: 1, ranAt: "2026-08-04T10:00:00Z" });
    await pending;
    expect(useNotebookStore.getState().cellRuns[cellId]).toBeUndefined();
  });

  it("env var CRUD adds, patches, and deletes with the dirty flag set", () => {
    const store = useNotebookStore.getState();
    expect(store.addEnvVar({ name: "base_url", value: "https://api.test", secret: false })).toBeNull();
    expect(useNotebookStore.getState().dirty).toBe(true);

    expect(useNotebookStore.getState().updateEnvVar("base_url", { value: "https://other.test" })).toBeNull();
    expect(useNotebookStore.getState().notebook?.envVars).toEqual([
      { name: "base_url", value: "https://other.test", secret: false },
    ]);

    expect(useNotebookStore.getState().updateEnvVar("base_url", { secret: true })).toBeNull();
    expect(useNotebookStore.getState().notebook?.envVars[0].secret).toBe(true);

    useNotebookStore.getState().deleteEnvVar("base_url");
    expect(useNotebookStore.getState().notebook?.envVars).toEqual([]);
  });

  it("addEnvVar rejects invalid names without touching state", () => {
    for (const name of ["", "1abc", "has space", "dash-ed", "brace{{d}}"]) {
      expect(useNotebookStore.getState().addEnvVar({ name, value: "v", secret: false })).toBe(
        "invalidName",
      );
    }
    expect(useNotebookStore.getState().notebook?.envVars).toEqual([]);
    expect(useNotebookStore.getState().dirty).toBe(false);
  });

  it("addEnvVar rejects duplicate names case-sensitively", () => {
    const store = useNotebookStore.getState();
    expect(store.addEnvVar({ name: "token", value: "a", secret: true })).toBeNull();
    expect(useNotebookStore.getState().addEnvVar({ name: "token", value: "b", secret: false })).toBe(
      "duplicateName",
    );
    expect(useNotebookStore.getState().addEnvVar({ name: "Token", value: "b", secret: false })).toBeNull();
    expect(useNotebookStore.getState().notebook?.envVars.map((v) => v.name)).toEqual([
      "token",
      "Token",
    ]);
  });

  it("updateEnvVar validates renames and keeps state on rejection", () => {
    const store = useNotebookStore.getState();
    store.addEnvVar({ name: "a", value: "1", secret: false });
    useNotebookStore.getState().addEnvVar({ name: "b", value: "2", secret: false });

    expect(useNotebookStore.getState().updateEnvVar("a", { name: "b" })).toBe("duplicateName");
    expect(useNotebookStore.getState().updateEnvVar("a", { name: "9x" })).toBe("invalidName");
    expect(useNotebookStore.getState().notebook?.envVars.map((v) => v.name)).toEqual(["a", "b"]);

    expect(useNotebookStore.getState().updateEnvVar("a", { name: "renamed" })).toBeNull();
    expect(useNotebookStore.getState().notebook?.envVars.map((v) => v.name)).toEqual([
      "renamed",
      "b",
    ]);
  });

  it("updateEnvVar allows a same-name patch without a duplicate error", () => {
    const store = useNotebookStore.getState();
    store.addEnvVar({ name: "a", value: "1", secret: false });
    expect(useNotebookStore.getState().updateEnvVar("a", { name: "a", value: "2" })).toBeNull();
    expect(useNotebookStore.getState().notebook?.envVars[0].value).toBe("2");
  });

  it("updateEnvVar on an unknown name is a no-op", () => {
    expect(useNotebookStore.getState().updateEnvVar("ghost", { value: "x" })).toBeNull();
    expect(useNotebookStore.getState().dirty).toBe(false);
  });

  it("deleteEnvVar works while a cell still references the variable", () => {
    const store = useNotebookStore.getState();
    store.addCell("http");
    const cell = cells()[0];
    if (cell.type !== "http") throw new Error("expected http cell");
    useNotebookStore.getState().updateHttpRequest(cell.id, {
      ...cell.request,
      url: "{{base_url}}/x",
    });
    useNotebookStore.getState().addEnvVar({ name: "base_url", value: "u", secret: false });

    useNotebookStore.getState().deleteEnvVar("base_url");
    expect(useNotebookStore.getState().notebook?.envVars).toEqual([]);
    const after = cells()[0];
    expect(after.type === "http" && after.request.url).toBe("{{base_url}}/x");
  });

  it("updateHttpRequest replaces the request of the target cell", () => {
    const store = useNotebookStore.getState();
    store.addCell("http");
    const cell = cells()[0];
    if (cell.type !== "http") throw new Error("expected http cell");
    useNotebookStore.getState().updateHttpRequest(cell.id, {
      ...cell.request,
      method: "POST",
      url: "https://example.test",
    });
    const after = cells()[0];
    expect(after).toMatchObject({
      type: "http",
      request: { method: "POST", url: "https://example.test" },
    });
    expect(useNotebookStore.getState().dirty).toBe(true);
  });
});
