import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createCell,
  createEmptyNotebook,
  validateNotebook,
} from "./notebook";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      path.resolve(here, "../../specs/001-notebook-mvp/contracts/fixtures", name),
      "utf8",
    ),
  );

const validNotebook = () => fixture("notebook-v1.json") as Record<string, unknown>;

describe("validateNotebook", () => {
  it("accepts the shared contract fixture", () => {
    const result = validateNotebook(validNotebook());
    expect(result.ok).toBe(true);
  });

  it("accepts an empty notebook", () => {
    const result = validateNotebook(createEmptyNotebook("Empty"));
    expect(result.ok).toBe(true);
  });

  it("rejects a newer schema version without treating it as corrupt", () => {
    const result = validateNotebook({ ...validNotebook(), schemaVersion: 2 });
    expect(result).toMatchObject({ ok: false, error: "versionUnsupported" });
  });

  it("rejects a non-integer schema version as invalid", () => {
    const result = validateNotebook({ ...validNotebook(), schemaVersion: "1" });
    expect(result).toMatchObject({ ok: false, error: "invalidNotebook" });
  });

  it("rejects non-object input", () => {
    expect(validateNotebook([1, 2, 3])).toMatchObject({ ok: false, error: "invalidNotebook" });
    expect(validateNotebook("nope")).toMatchObject({ ok: false, error: "invalidNotebook" });
    expect(validateNotebook(null)).toMatchObject({ ok: false, error: "invalidNotebook" });
  });

  it("rejects a missing cells array with a reason naming the field", () => {
    const { cells: _cells, ...rest } = validNotebook();
    const result = validateNotebook(rest);
    expect(result).toMatchObject({ ok: false, error: "invalidNotebook" });
    if (!result.ok && result.error === "invalidNotebook") {
      expect(result.reason).toContain("cells");
    }
  });

  it("rejects duplicate cell ids", () => {
    const notebook = validNotebook();
    const cells = notebook.cells as Array<Record<string, unknown>>;
    const duplicated = [...cells, { ...cells[0] }];
    const result = validateNotebook({ ...notebook, cells: duplicated });
    expect(result).toMatchObject({ ok: false, error: "invalidNotebook" });
  });

  it("rejects invalid env var names and duplicates", () => {
    const base = validNotebook();
    expect(
      validateNotebook({
        ...base,
        envVars: [{ name: "1bad", value: "x", secret: false }],
      }),
    ).toMatchObject({ ok: false, error: "invalidNotebook" });
    expect(
      validateNotebook({
        ...base,
        envVars: [
          { name: "dup", value: "a", secret: false },
          { name: "dup", value: "b", secret: false },
        ],
      }),
    ).toMatchObject({ ok: false, error: "invalidNotebook" });
  });

  it("rejects an invalid http method and out-of-range timeout", () => {
    const base = validNotebook();
    const httpCell = {
      id: "bad-http",
      type: "http",
      request: { method: "FETCH", url: "", headers: [], body: "" },
    };
    expect(validateNotebook({ ...base, cells: [httpCell] })).toMatchObject({
      ok: false,
      error: "invalidNotebook",
    });

    const slowCell = {
      id: "slow-http",
      type: "http",
      request: { method: "GET", url: "", headers: [], body: "", timeoutMs: 500 },
    };
    expect(validateNotebook({ ...base, cells: [slowCell] })).toMatchObject({
      ok: false,
      error: "invalidNotebook",
    });
  });

  it("passes unknown top-level fields through untouched", () => {
    const input = validNotebook();
    const result = validateNotebook(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.notebook.xCustomTool).toEqual({
        note: "unknown top-level field must survive round-trip",
      });
      expect(result.notebook).toBe(input);
    }
  });
});

describe("createEmptyNotebook", () => {
  it("produces a valid notebook with the given title", () => {
    const notebook = createEmptyNotebook("  My Notes  ");
    expect(notebook.title).toBe("My Notes");
    expect(validateNotebook(notebook).ok).toBe(true);
  });

  it("falls back to a default title for blank input", () => {
    expect(createEmptyNotebook("   ").title).toBe("Untitled notebook");
  });
});

describe("createCell", () => {
  it("creates valid cells of every type with unique ids", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      for (const type of ["markdown", "php", "http"] as const) {
        ids.add(createCell(type).id);
      }
    }
    expect(ids.size).toBe(150);
  });

  it("creates cells that validate inside a notebook", () => {
    const notebook = createEmptyNotebook("Cells");
    notebook.cells = [createCell("markdown"), createCell("php"), createCell("http")];
    expect(validateNotebook(notebook).ok).toBe(true);
  });
});
