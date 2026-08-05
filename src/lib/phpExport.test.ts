import { describe, expect, it } from "vitest";
import { toPhpArray } from "./phpExport";
import type { JsonValue } from "./jsonTree";
import fixtures from "../../specs/002-usability-polish/contracts/fixtures/php-export.json";

const ok = (value: JsonValue) => {
  const result = toPhpArray(value);
  if (!result.ok) throw new Error("expected conversion to succeed");
  return result.php;
};

describe("toPhpArray", () => {
  it("matches every shared fixture consumed by the gated sandbox test", () => {
    for (const fixture of fixtures as Array<{ name: string; json: JsonValue; php: string }>) {
      expect(ok(fixture.json), fixture.name).toBe(fixture.php);
    }
  });

  it("refuses scalar roots with a typed reason", () => {
    for (const scalar of ["text", 42, true, null] as JsonValue[]) {
      expect(toPhpArray(scalar)).toEqual({ ok: false, reason: "notJsonContainer" });
    }
  });

  it("emits empty containers inline", () => {
    expect(ok({})).toBe("[]");
    expect(ok([])).toBe("[]");
  });

  it("escapes only what single-quoted PHP strings need", () => {
    expect(ok(["it's"])).toContain("'it\\'s'");
    expect(ok(["a\\b"])).toContain("'a\\\\b'");
    expect(ok(["no \"double\" trouble"])).toContain("'no \"double\" trouble'");
  });

  it("keeps integer and float formatting apart", () => {
    expect(ok([3])).toContain("3,");
    expect(ok([3.25])).toContain("3.25,");
    expect(ok([-0.5])).toContain("-0.5,");
  });
});
