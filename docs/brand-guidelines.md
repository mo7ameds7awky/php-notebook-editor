# Brand Guidelines — PHP Notebook Editor

Decision record for app identity and visual design (research D17). Code sources of
truth: `src/theme/appIdentity.ts` (identity), `src/theme/tokens.ts` (visual values),
`src/theme/theme.css` (global base layer consuming the tokens). This document
explains the decisions; the code files carry the values.

## Identity

- **Product name**: PHP Notebook Editor
- **Short name**: PNB (file extension `.pnb.json`, container prefixes, internal ids)
- **Tagline**: A local-first notebook for PHP, Laravel, and API experiments.
- **Description**: PHP Notebook Editor is a local-first desktop app for writing,
  running, and documenting PHP snippets, HTTP requests, and backend experiments in
  executable notebooks.
- **Positioning**: A desktop developer notebook for PHP/Laravel learning,
  prototyping, API testing, and runnable backend documentation.
- **Personality**: calm, precise, developer-focused, local-first, safe, modern,
  technical but friendly.

Voice guidance: plain, specific, honest. State what happened and what to do next
(matches Constitution Principle V — no vague errors, no marketing tone in-product).

## Theme

- **Dark theme only for MVP.** No light theme yet.
- **No user-facing theme customization in MVP.** Codebase-level customization is
  required and centralized: all values live in `tokens.ts`, stamped as CSS custom
  properties at startup by `applyTokens()`; `theme.css` and components consume the
  variables (or the typed constants). Raw hex exists **only** in `tokens.ts`.
- **No external fonts in MVP** — system-available stacks only:
  - UI: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  - Mono: `"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace`

## Color tokens

| Token | Value | Use |
|-------|-------|-----|
| bg | `#101218` | App background |
| surface | `#181B23` | Cards, panels |
| surfaceElevated | `#202431` | Popovers, dialogs |
| surfaceSubtle | `#151821` | Quiet fills, empty states |
| primary / focus | `#6C7FD8` | Brand actions, focus ring |
| primaryHover | `#7D8FEB` | Hover state |
| primaryActive | `#5B6BC4` | Pressed state |
| textPrimary | `#F4F6FB` | Main text |
| textSecondary | `#AAB0C0` | Supporting text |
| textMuted | `#707789` | De-emphasized text |
| borderSubtle | `#2A2F3D` | Hairlines |
| border | `#353B4D` | Default borders |
| success | `#39D98A` | Succeeded runs |
| warning | `#F5C451` | Warnings, truncation notices |
| danger | `#FF5C7A` | Failures, destructive actions |
| info | `#4DA3FF` | Informational states |
| codeBg | `#0B0D12` | Code/output backgrounds |
| codeSurface | `#12151D` | Editor gutters, code chrome |

## Cell accent semantics

| Cell type | Accent | Meaning |
|-----------|--------|---------|
| Markdown | `#8A94A6` neutral gray | Prose — calm, non-executable |
| PHP | `#777BB4` PHP-inspired indigo/purple | Executable code |
| HTTP | `#35C2A4` teal/green | Network requests |

Accents identify cell type at a glance (left borders, badges, logo cells). Semantic
state colors (success/danger/warning/info) are separate tokens and never reused as
cell identity.

## Logo

`src/components/common/LogoMark.tsx` is a deliberate **placeholder**: a rounded
square containing three stacked executable cells (markdown gray, PHP indigo, HTTP
teal) plus a small play triangle in the primary color. Constraints:

- Works on dark backgrounds; inline SVG only — **no external image assets**.
- Original composition — do not copy or imitate the PHP, Laravel, Jupyter, or
  Postman logos.
- Replacement plan: swap the SVG internals in that one component; call sites pass
  only `size` and must not change.

## Hard rules

1. Do **not** hardcode the app name, tagline, description, or logo details in
   components — import from `src/theme/appIdentity.ts`.
2. Do **not** use raw hex color values outside `src/theme/tokens.ts` — components
   and CSS consume tokens / CSS custom properties.
3. New visual constants go into `tokens.ts`; global base styles go into
   `theme.css`; neither goes into components.
4. Keep the UI calm, dark-first, developer-tool-like — restrained color, generous
   spacing, no decorative noise.
5. Compliance is audited at T059 (grep for identity literals and raw hex in
   `src/components`, `src/App.tsx`, and CSS outside the theme directory).
