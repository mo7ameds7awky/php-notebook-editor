import { describe, expect, it } from "vitest";
import { applyTokens, cellAccents, colors, radii, spacing, typography } from "./tokens";

const HEX = /^#[0-9a-f]{6}$/i;

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
  });
});

describe("applyTokens", () => {
  it("stamps CSS custom properties on the target element", () => {
    const el = document.createElement("div");
    applyTokens(el);
    expect(el.style.getPropertyValue("--color-bg")).toBe(colors.bg);
    expect(el.style.getPropertyValue("--color-surface-elevated")).toBe(colors.surfaceElevated);
    expect(el.style.getPropertyValue("--color-text-primary")).toBe(colors.textPrimary);
    expect(el.style.getPropertyValue("--color-code-bg")).toBe(colors.codeBg);
    expect(el.style.getPropertyValue("--accent-cell-php")).toBe(cellAccents.php);
    expect(el.style.getPropertyValue("--space-md")).toBe(spacing.md);
    expect(el.style.getPropertyValue("--radius-md")).toBe(radii.md);
    expect(el.style.getPropertyValue("--font-sans")).not.toBe("");
    expect(el.style.colorScheme).toBe("dark");
  });
});
