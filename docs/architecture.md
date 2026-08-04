# Architecture — PHP Notebook Editor

Local-first desktop app: Tauri 2 shell, React 19 + TypeScript frontend, Rust backend,
Bun for package management and scripts, local `.pnb.json` notebook files, and (coming)
Docker-sandboxed PHP execution.

## Layers

| Layer | Where | Role |
|-------|-------|------|
| UI | `src/components/` | React components; screens (home, notebook shell), cells (later), common primitives |
| State | `src/state/` | Zustand stores: notebook session (`notebookStore`), app view + recents (`appStore`) |
| Pure logic | `src/lib/` | Validation, factories, path/interpolation helpers — no Tauri imports, fully unit-tested |
| IPC | `src/ipc/` ⟷ `src-tauri/src/models.rs` | Typed contract mirror; every rejection normalized to `IpcError` carrying the originating command |
| Commands | `src-tauri/src/commands/` | Thin `#[tauri::command]` handlers |
| Services | `src-tauri/src/services/` | File I/O (atomic saves, conflict detection), recents store; later HTTP runner and Docker supervision |
| Sandbox (planned) | Docker via CLI | PHP cells execute only in isolated containers — never in any app process |

Contract source of truth: `specs/001-notebook-mvp/contracts/`. Shared JSON fixtures are
round-trip-tested from both sides.

## Styling

PHP Notebook Editor uses Tailwind CSS backed by centralized CSS variables/design
tokens. Components must use semantic tokens/utilities rather than hardcoded colors.
The MVP uses a dark theme only. Heavy UI frameworks are intentionally avoided. A small
internal component system is used for reusable primitives. Radix UI may be added later
only for accessibility-heavy primitives.

Mechanics (Tailwind v4, CSS-first — no `tailwind.config.js`):

- `src/theme/theme.css` — single styling entry: `--pnb-*` design-token variables,
  `@theme inline` block mapping them to semantic Tailwind colors, `@utility`
  definitions for border colors, and global base styles. Imported once in
  `src/main.tsx`; the Vite plugin `@tailwindcss/vite` compiles it.
- `src/theme/tokens.ts` — TypeScript mirror of the same values for code that needs
  literals (SVG fills, future editor themes). A unit test keeps the two files in sync.
- `src/theme/appIdentity.ts` — name, short name (PNB), tagline, description.
- Semantic utilities: `bg-app` `bg-surface` `bg-elevated` `bg-subtle` ·
  `text-primary` `text-secondary` `text-muted` · `border-subtle` `border-default`
  `border-strong` · `bg-brand` `hover:bg-brand-hover` `active:bg-brand-active` ·
  `text-success|warning|danger|info` · `*-cell-markdown|cell-php|cell-http` ·
  `bg-code-bg` `bg-code-surface` · `bg-scrim`.
- Primitives in `src/components/common/`: `Button` (primary/secondary/ghost/danger ×
  sm/md/lg), `Panel` (surface/subtle/elevated, dashed), `Badge` (status + cell-type
  tones), `LogoMark` (sole brand renderer), `ConfirmDialog`, `ErrorDialog`.
- Hard rule: no raw hex/rgba color values in components — arbitrary-value classes like
  `bg-[#101218]` are forbidden; add a token instead.

## Library decisions (MVP)

| Concern | Choice | Explicitly not adopted |
|---------|--------|------------------------|
| Styling | Tailwind CSS v4 over design tokens | Material UI, Ant, Bootstrap, Chakra, full shadcn/ui |
| Icons | `lucide-react` — single icon library, no mixing | other icon packs |
| Dialogs | `@radix-ui/react-dialog` for confirm/error modals | full shadcn/ui; other Radix primitives only if a11y demands later |
| Validation | `zod` on the TS side (notebook data, env vars, frontend payloads); **Rust stays authoritative** via serde + explicit checks | duplicate validation frameworks |
| State | Zustand | Redux |
| Data fetching | typed Tauri IPC wrappers + Zustand actions | React Query / TanStack Query |
| Routing | app view state (`home` ⟷ `notebook`) | React Router |
| Editor | CodeMirror 6 (`@codemirror/lang-php` verified on npm; fall back to plain text if it proves unreliable) | Monaco |
| Markdown | react-markdown + remark-gfm + rehype-sanitize; raw HTML never rendered | raw-HTML pipelines |
| Frontend tests | Vitest + Testing Library + jest-dom | Jest |

## Error handling UX

`src/lib/errors.ts` maps every IPC `CommandError` code (plus the originating command)
to a user-facing `{ title, message, severity, detail }`. Dialogs lead with plain
language; the raw technical message lives behind a "Technical details" disclosure.
Recovery flows (overwrite-on-conflict, save-as-on-missing-file) stay explicit
branches in the components.

## Logging policy

Never logged: secrets/env values, HTTP request or response bodies, headers, PHP
source code, PHP outputs, full notebook contents. Allowed: command names, timings,
status codes, error codes, method+host. Audited at T059 (static grep of logging
macros + dynamic secret-grep session sweep).

## Notebook file format

`.pnb.json` — pretty 2-space JSON, `schemaVersion` integer starting at 1, atomic
writes (temp file + rename), mtime conflict detection, missing-file save-as
fallback, unknown top-level fields preserved on round-trip. Newer versions are
refused without modifying the file. Contract:
`specs/001-notebook-mvp/contracts/notebook-file.schema.json`.

## Desktop responsive layout foundation

Responsive here means resizable desktop windows, not mobile-first web. Constitution
v1.1.0 makes this binding (Principle V).

- Viewports: minimum supported **1024×700**; best-effort compact **900×650**;
  comfortable target 1280×800; large 1440px+. Never assume a fixed window.
- App shell: `h-screen w-screen overflow-hidden` wrapper in `App.tsx`; screens fill
  with `h-full` flex columns. Body never scrolls.
- Scroll is intentional: exactly one scroll region per screen context — Home scrolls
  its content column; the notebook shell keeps a fixed header and scrolls the cell
  area (`min-h-0 flex-1 overflow-y-auto`). Code editors, outputs, logs, HTTP
  responses, and error details scroll internally.
- Flex/grid children that must shrink carry `min-w-0`/`min-h-0`; long text truncates
  (`truncate`) instead of pushing layout.
- No fixed app-shell widths/heights; pixel values only for icons, small controls,
  and intentional `max-w-*` readability caps.
- Header/toolbar actions wrap (`flex-wrap`) or collapse to icon-only at narrow
  widths (e.g. the shell's Home label hides below `sm:`).
- Card lists (recents) use responsive grids (`grid-cols-1 lg:grid-cols-2
  2xl:grid-cols-3`).
- Dialogs: `w-[min(440px,calc(100vw-2rem))]`, `max-h-[min(85vh,560px)]`, internal
  `overflow-y-auto`.
- Primitives: `Panel` is `w-full min-w-0`; `Button` labels never wrap
  (`whitespace-nowrap`) — groups wrap instead; inputs inside flexible rows use
  `flex-1 min-w-*`.

## Accessibility baseline

Keyboard-accessible controls, visible focus rings (`--pnb-focus` outline), labelled
inputs, Radix-managed dialog focus, no color-only status indicators (dirty dot
carries `aria-label` + screen-reader text), `prefers-reduced-motion` honored
globally.

## Configuration

No settings UI yet; defaults centralize in two mirrored modules:
`src-tauri/src/config.rs` (PHP image + `PNB_PHP_IMAGE` override, HTTP/PHP timeout
defaults, output caps, recents limit) and `src/lib/config.ts` (frontend-visible
defaults). Change defaults there, nowhere else.

## Paths

Filesystem paths are handled in Rust commands (join/exists/rename). The frontend
only passes through absolute paths obtained from native dialogs; no manual
separator concatenation, keeping macOS/Windows/Linux behavior consistent.

## Testing

- Frontend: Vitest (+ RTL when components need it); pure logic and stores covered.
- Rust: `cargo test` unit tests; Docker integration tests arrive `#[ignore]`-gated.
- Gates per merge: `bun run typecheck`, `bun run lint`, `bun run test`,
  `cargo test`, `cargo clippy`.
