# Research & Decisions: Phase 2 — Usability Polish

**Date**: 2026-08-05 · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## D1: Clipboard mechanism — tauri-plugin-clipboard-manager, write-only

- **Decision**: Copy actions use `@tauri-apps/plugin-clipboard-manager` /
  `tauri-plugin-clipboard-manager` with exactly one new capability permission:
  `clipboard-manager:allow-write-text`. No read permission is ever granted — the app
  can put text on the clipboard but can never see what is on it.
- **Rationale**: `navigator.clipboard.writeText` inside Tauri webviews is
  inconsistent across platforms: WKWebView ties it to user-gesture and
  secure-context heuristics that vary by macOS version, and webkit2gtk (Linux) has
  known async-clipboard gaps. The plugin routes the write through Rust, giving one
  deterministic behavior on all three platforms. The webview API was not empirically
  verified in-session (needs an interactive window); the plugin is chosen precisely
  so that per-platform verification is unnecessary.
- **Constitution re-check**: capability additions stay minimal and purpose-scoped —
  the write-only permission cannot exfiltrate anything the user didn't explicitly
  copy, and `clipboard.ts` returns typed failures that never echo the copied
  content (logging policy intact: still zero logging statements in the codebase).
- **Alternatives considered**: `navigator.clipboard` alone (platform-inconsistent,
  unverifiable headless); `document.execCommand("copy")` (deprecated, requires DOM
  selection hacks).

## D2: Pull progress — staged progress with a per-layer counter (no byte percentages)

- **Decision**: FR-216 is implemented with staged progress derived from `docker
  pull`'s non-TTY line output: parse `<layerId>: <status>` lines, track distinct
  layer ids, and report `pulling n/m layers` as the coarse progress signal, with
  stages `starting → downloading (n/m) → verifying → done`. No byte-level percent
  is attempted. Wiring (event channel + parser) lands with T021; this decision fixes
  the design.
- **Evidence** (captured 2026-08-05 on Docker 29.6.2, non-TTY pipe):
  - Cold pull emits per-layer status lines only — `025fe1949698: Pulling fs layer`,
    `6d61f1d27bc2: Download complete`, `025fe1949698: Pull complete`, then
    `Digest: …` and `Status: Downloaded newer image …`. **No byte counts or
    percentages appear without a TTY**, and `docker pull` has no `--progress`
    flag to force them.
  - Warm pull emits only four lines (`Pulling from …`, `Digest`, `Status: Image is
    up to date`, name) — the parser must treat "no layer lines" as an immediate
    completed state.
- **Consequences for T021**: the Rust parser consumes stdout lines (never logged —
  layer ids and statuses only feed the progress state), emits an additive Tauri
  event; `pull_php_image`'s request/response shape is unchanged, so the contract
  doc gains only an event-channel note when T021 lands.
- **Alternatives considered**: PTY emulation to capture TTY progress bars (heavy,
  fragile escape-sequence parsing); Docker Engine API pull with JSON progress
  (reintroduces the socket-discovery problem D1 of Phase 1 rejected); indeterminate
  spinner only (meets the letter of FR-216 but the layer counter is nearly free).
