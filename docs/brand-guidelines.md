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
- **Styling stack**: PHP Notebook Editor uses Tailwind CSS backed by centralized CSS
  variables/design tokens. Components must use semantic tokens/utilities rather than
  hardcoded colors. Heavy UI frameworks are intentionally avoided (no Material UI,
  Ant, Bootstrap, Chakra, or full shadcn/ui). A small internal component system
  (`Button`, `Panel`, `Badge`, dialogs) provides reusable primitives. Radix UI may be
  added later only for accessibility-heavy primitives.
- **No user-facing theme customization in MVP.** Codebase-level customization is
  required and centralized: `theme.css` defines the `--pnb-*` variables (runtime
  source) plus the Tailwind `@theme` mapping; `tokens.ts` mirrors the same values for
  TypeScript consumers, with a sync test guarding drift. Raw color values exist only
  in those two theme files — never in components (no `bg-[#101218]`-style arbitrary
  values).
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

Production assets (extracted from the approved concept) are integrated. The mark is
a rounded tile with three stacked executable cells (markdown gray, PHP indigo, HTTP
teal) — an original composition, not derivative of the PHP, Laravel, Jupyter, or
Postman logos.

### Asset locations & usage

| File | Location | Use |
|------|----------|-----|
| `logo-mark.svg` | `src/assets/brand/` | Default in-app mark (headers, dialogs) |
| `logo-mark-small.svg` | `src/assets/brand/` | Tiny sizes (≤20 px) where detail must simplify |
| `logo-horizontal.svg` | `src/assets/brand/` | Mark + wordmark lockup on dark surfaces (home/about) |
| `logo-horizontal-with-tagline.svg` | `src/assets/brand/` | Full lockup with tagline, dark surfaces (splash/about) |
| `logo-monochrome.svg` | `src/assets/brand/` | Single-color contexts on dark backgrounds |
| `logo-horizontal-with-tagline.png` | `docs/assets/` | README and docs (light-background variant) |
| `social-preview.png` | `docs/assets/` | Repository social/preview card |

In-app rendering goes through **one component**:
`src/components/common/LogoMark.tsx` — `<LogoMark variant="mark" size={28} />` with
variants `mark`, `markSmall`, `horizontal`, `horizontalTagline`, `monochrome`.

### App icon

`src-tauri/icons/` (icon.icns, icon.ico, icon.png, 32x32.png, 128x128.png,
128x128@2x.png, platform extras) is generated from the approved
`icon-1024.png` via `bun run tauri icon`. To update the app icon, regenerate the
whole set from a new 1024 px master — never hand-edit individual sizes.
`tauri.conf.json` already references this set.

### Rule

Do **not** import logo files or hardcode logo asset paths anywhere outside
`LogoMark.tsx` (or future brand utilities). Components render brand imagery only
through `LogoMark`.

## Responsive UI

The brand lives in resizable desktop windows (not mobile web). Layouts must stay
calm and usable from 900×650 (best-effort) and 1024×700 (minimum supported) up to
1440px+: single intentional scroll region per screen, wrapping/collapsing toolbars,
truncating text instead of breaking layout, readability capped with `max-w-*` rather
than fixed widths, and the wordmark/tagline truncating or yielding before the mark
does. See `docs/architecture.md` → "Desktop responsive layout foundation" for the
mechanics.

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
