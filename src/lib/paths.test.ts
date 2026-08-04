import { describe, expect, it } from "vitest";
import { ensurePnbExtension, fileNameFromPath, titleFromPath } from "./paths";

describe("ensurePnbExtension", () => {
  it("keeps a correct extension", () => {
    expect(ensurePnbExtension("/x/notes.pnb.json")).toBe("/x/notes.pnb.json");
  });

  it("upgrades a bare .json extension", () => {
    expect(ensurePnbExtension("/x/notes.json")).toBe("/x/notes.pnb.json");
  });

  it("appends to an extensionless name", () => {
    expect(ensurePnbExtension("/x/notes")).toBe("/x/notes.pnb.json");
  });
});

describe("fileNameFromPath", () => {
  it("handles posix and windows separators", () => {
    expect(fileNameFromPath("/a/b/c.pnb.json")).toBe("c.pnb.json");
    expect(fileNameFromPath("C:\\a\\b\\c.pnb.json")).toBe("c.pnb.json");
  });
});

describe("titleFromPath", () => {
  it("strips the notebook extension", () => {
    expect(titleFromPath("/x/api-notes.pnb.json")).toBe("api-notes");
  });

  it("falls back for empty stems", () => {
    expect(titleFromPath("/x/.pnb.json")).toBe("Untitled notebook");
  });
});
