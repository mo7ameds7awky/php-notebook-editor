import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  Cell,
  HttpRunResult,
  Notebook,
  PhpRunResult,
  RecentEntry,
  RuntimeHealth,
} from "./notebook";
import {
  isCellType,
  isErrorCode,
  isHttpMethod,
  isHttpRunStatus,
  isPhpRunStatus,
  isRuntimeHealthStatus,
} from "./notebook";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(here, "../../specs/001-notebook-mvp/contracts/fixtures");
const readFixture = <T>(name: string): T =>
  JSON.parse(readFileSync(path.join(fixturesDir, name), "utf8")) as T;

function describeCell(cell: Cell): string {
  switch (cell.type) {
    case "markdown":
      return `markdown(${cell.source.length} chars)`;
    case "php":
      return `php(lastRun=${cell.lastRun?.status ?? "none"})`;
    case "http":
      return `http(${cell.request.method} ${cell.request.url})`;
    default: {
      const exhaustive: never = cell;
      return exhaustive;
    }
  }
}

describe("notebook fixture", () => {
  const notebook = readFixture<Notebook>("notebook-v1.json");

  it("parses into the typed contract shape", () => {
    expect(notebook.schemaVersion).toBe(1);
    expect(notebook.cells).toHaveLength(3);
    expect(notebook.envVars).toHaveLength(2);
  });

  it("narrows every cell exhaustively through the discriminated union", () => {
    const summaries = notebook.cells.map(describeCell);
    expect(summaries[0]).toContain("markdown");
    expect(summaries[1]).toBe("php(lastRun=succeeded)");
    expect(summaries[2]).toBe("http(GET {{base_url}}/get)");
  });

  it("exposes unknown top-level fields through the index signature", () => {
    expect(notebook["xCustomTool"]).toEqual({
      note: "unknown top-level field must survive round-trip",
    });
  });

  it("all cell types and methods pass their guards", () => {
    for (const cell of notebook.cells) {
      expect(isCellType(cell.type)).toBe(true);
    }
    const http = notebook.cells[2];
    if (http.type === "http") {
      expect(isHttpMethod(http.request.method)).toBe(true);
    }
  });
});

describe("run result fixtures", () => {
  it("php terminated variant parses with termination metadata", () => {
    const result = readFixture<PhpRunResult>("php-run-result.json");
    expect(isPhpRunStatus(result.status)).toBe(true);
    expect(result.status).toBe("terminated");
    expect(result.terminationReason).toBe("timeout");
    expect(result.truncated).toBe(true);
    expect(result.exitCode).toBeUndefined();
  });

  it("http variants distinguish HTTP-status errors from transport failures", () => {
    const [serverError, transportFailure] = readFixture<HttpRunResult[]>("http-run-result.json");
    expect(serverError.status).toBe("succeeded");
    expect(serverError.response?.statusCode).toBe(500);
    expect(transportFailure.status).toBe("failed");
    expect(transportFailure.error?.kind).toBe("network");
    expect(isHttpRunStatus(serverError.status)).toBe(true);
  });
});

describe("runtime health fixture", () => {
  it("covers all four states with detail and remedy", () => {
    const states = readFixture<RuntimeHealth[]>("runtime-health.json");
    expect(states).toHaveLength(4);
    const statuses = states.map((s) => s.status);
    for (const expected of ["ok", "dockerNotInstalled", "daemonNotRunning", "imageMissing"]) {
      expect(statuses).toContain(expected);
    }
    for (const state of states) {
      expect(isRuntimeHealthStatus(state.status)).toBe(true);
      expect(typeof state.detail).toBe("string");
      expect(typeof state.remedy).toBe("string");
    }
  });
});

describe("recents fixture", () => {
  it("parses into RecentEntry[]", () => {
    const entries = readFixture<RecentEntry[]>("recents.json");
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.path.endsWith(".pnb.json")).toBe(true);
      expect(typeof entry.title).toBe("string");
      expect(Number.isNaN(Date.parse(entry.lastOpenedAt))).toBe(false);
    }
  });
});

describe("type guards reject unknown values", () => {
  it.each([
    [isCellType, "yaml"],
    [isHttpMethod, "FETCH"],
    [isPhpRunStatus, "exploded"],
    [isHttpRunStatus, "terminated"],
    [isRuntimeHealthStatus, "sick"],
    [isErrorCode, "oops"],
  ])("%p rejects %s", (guard, value) => {
    expect(guard(value)).toBe(false);
  });

  it("guards reject non-strings", () => {
    expect(isCellType(3)).toBe(false);
    expect(isHttpMethod(null)).toBe(false);
    expect(isErrorCode(undefined)).toBe(false);
  });
});
