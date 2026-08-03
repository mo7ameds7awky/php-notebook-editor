/**
 * Dark-theme design tokens — the single source of raw color values, stamped
 * as CSS custom properties on the document root by applyTokens().
 */

export const colors = {
  bg: "#101218",
  surface: "#181B23",
  surfaceElevated: "#202431",
  surfaceSubtle: "#151821",
  primary: "#6C7FD8",
  primaryHover: "#7D8FEB",
  primaryActive: "#5B6BC4",
  textPrimary: "#F4F6FB",
  textSecondary: "#AAB0C0",
  textMuted: "#707789",
  borderSubtle: "#2A2F3D",
  border: "#353B4D",
  focus: "#6C7FD8",
  success: "#39D98A",
  warning: "#F5C451",
  danger: "#FF5C7A",
  info: "#4DA3FF",
  codeBg: "#0B0D12",
  codeSurface: "#12151D",
} as const;

/** Per-cell-type accents: markdown = neutral gray, php = PHP-inspired indigo/purple, http = teal/green. */
export const cellAccents = {
  markdown: "#8A94A6",
  php: "#777BB4",
  http: "#35C2A4",
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "20px",
  xl: "32px",
} as const;

export const typography = {
  fontSans:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontMono:
    '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  sizeXs: "12px",
  sizeSm: "13px",
  sizeMd: "14px",
  sizeLg: "16px",
  sizeXl: "20px",
} as const;

export const radii = {
  sm: "4px",
  md: "8px",
  lg: "12px",
} as const;

const kebab = (s: string): string => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Stamp all tokens as CSS custom properties (call once at startup). */
export function applyTokens(root: HTMLElement = document.documentElement): void {
  const set = (name: string, value: string) => root.style.setProperty(name, value);
  for (const [key, value] of Object.entries(colors)) set(`--color-${kebab(key)}`, value);
  for (const [key, value] of Object.entries(cellAccents)) set(`--accent-cell-${key}`, value);
  for (const [key, value] of Object.entries(spacing)) set(`--space-${key}`, value);
  for (const [key, value] of Object.entries(radii)) set(`--radius-${key}`, value);
  set("--font-sans", typography.fontSans);
  set("--font-mono", typography.fontMono);
  root.style.colorScheme = "dark";
}
