/**
 * TypeScript mirror of the design tokens (the --pnb-* CSS variables), for
 * code that needs literal values — SVG fills, canvas, editor themes.
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
  borderStrong: "#485066",
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

export const overlays = {
  scrim: "rgba(0, 0, 0, 0.55)",
} as const;

export const typography = {
  fontSans:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontMono:
    '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
} as const;
