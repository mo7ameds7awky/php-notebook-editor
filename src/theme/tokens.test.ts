import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cellAccents, colors, overlays, typography } from "./tokens";

const HEX = /^#[0-9A-F]{6}$/i;

const themeCss = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "theme.css"),
  "utf8",
);

describe("design tokens", () => {
  it("defines an accent for every cell type, exactly", () => {
    expect(Object.keys(cellAccents).sort()).toEqual(["http", "markdown", "php"]);
  });

  it("pins the brand-specified cell accents", () => {
    expect(cellAccents.markdown).toBe("#8A94A6");
    expect(cellAccents.php).toBe("#777BB4");
    expect(cellAccents.http).toBe("#35C2A4");
  });

  it("pins core brand colors", () => {
    expect(colors.bg).toBe("#101218");
    expect(colors.primary).toBe("#6C7FD8");
    expect(colors.focus).toBe(colors.primary);
    expect(colors.borderStrong).toBe("#485066");
    expect(colors.codeBg).toBe("#0B0D12");
  });

  it("uses valid 6-digit hex for every color token", () => {
    for (const value of [...Object.values(colors), ...Object.values(cellAccents)]) {
      expect(value).toMatch(HEX);
    }
  });

  it("keeps distinct accents per cell type", () => {
    const values = Object.values(cellAccents);
    expect(new Set(values).size).toBe(values.length);
  });

  it("does not reference external fonts", () => {
    expect(typography.fontSans).not.toMatch(/https?:/);
    expect(typography.fontMono).not.toMatch(/https?:/);
    expect(themeCss).not.toMatch(/@import\s+url\(/);
  });
});

describe("theme.css stays in sync with tokens.ts", () => {
  it("contains every color value from the TypeScript mirror", () => {
    for (const value of [...Object.values(colors), ...Object.values(cellAccents)]) {
      expect(themeCss).toContain(value);
    }
  });

  it("contains the scrim overlay", () => {
    expect(themeCss).toContain(overlays.scrim);
  });

  it("defines the semantic Tailwind mapping and border utilities", () => {
    expect(themeCss).toContain("@theme inline");
    expect(themeCss).toContain("--color-app: var(--pnb-bg-app)");
    expect(themeCss).toContain("--color-cell-php: var(--pnb-cell-php)");
    expect(themeCss).toContain("@utility border-subtle");
    expect(themeCss).toContain("@utility border-default");
    expect(themeCss).toContain("@utility border-strong");
  });
});
