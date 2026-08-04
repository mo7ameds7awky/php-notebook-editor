# Implementation Plan: PHP Notebook Editor — Phase 1 MVP

**Branch**: `001-notebook-mvp` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-notebook-mvp/spec.md`

## Summary

Deliver the Phase 1 MVP of a local-first desktop PHP notebook: create/open/save
versioned `.pnb.json` notebooks; author Markdown/PHP/HTTP cells with edit, delete,
reorder; per-notebook environment variables with `{{placeholder}}` interpolation and
secret masking; runnable HTTP request cells; and PHP cell execution inside a hardened
Docker sandbox — never in the app process.

Technical approach: React 19 + TypeScript UI (Zustand state, CodeMirror 6 editors,
sanitized react-markdown previews) talks to a Rust/Tauri 2 backend over a
hand-documented, fixture-tested IPC contract of 9 commands
([contracts/ipc-commands.md](./contracts/ipc-commands.md)). Rust services own all
filesystem I/O (atomic pretty-JSON saves with mtime conflict detection), HTTP
execution (reqwest, cancellable, size-capped), Docker health probing with typed
remedies, and PHP run supervision (`docker run` subprocess, stdin code delivery, no
mounts, `--network=none`, memory/time limits, kill-on-timeout). Full decision log in
[research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.8 (frontend); Rust stable, edition 2021 (backend)

**Primary Dependencies**: Tauri 2, React 19.1, Vite 7, Bun (package manager/scripts);
Zustand, CodeMirror 6, react-markdown + remark-gfm + rehype-sanitize (frontend);
tokio, reqwest (rustls), serde/serde_json, tauri-plugin-dialog (backend); Docker CLI +
`php:8.4-cli` image (external, user-installed — PHP execution only)

**Storage**: Local versioned `.pnb.json` notebook files (pretty-printed, atomic
writes, mtime conflict detection); `recents.json` in Tauri app-data dir. No database.

**Testing**: Vitest + React Testing Library (frontend units/components); `cargo test`
(Rust units); `cargo test -- --ignored` Docker integration tests; shared JSON contract
fixtures exercised from both sides; `tsc --noEmit` + `cargo clippy` as gates; manual
acceptance pass per [quickstart.md](./quickstart.md)

**Target Platform**: Desktop macOS/Windows/Linux via Tauri 2 (primary dev: macOS)

**Project Type**: desktop-app — webview frontend + Rust backend, single window

**Performance Goals**: visible feedback for any user action <100 ms; HTTP results
rendered <1 s after response completes (SC-003); UI stays responsive during all runs
(SC-005)

**Constraints**: user PHP never executes in any app process (Constitution I); sandbox
defaults 30 s timeout / 256 MB / no network / no mounts; fully offline-capable except
sending HTTP requests and image pull (FR-033); secrets masked in UI and absent from
logs (FR-015/018); notebook files human-readable and diffable (SC-006)

**Scale/Scope**: single local user; notebooks up to ~100 cells; 9 IPC commands; ~5 UI
surfaces (home/recents, notebook editor, env-var panel, runtime-health banner, file
dialogs)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.0.0. Initial check: PASS (all gates). Post-design re-check: PASS —
design artifacts strengthen compliance; no violations, no complexity entries.

| Gate | Verdict | Evidence in design |
|------|---------|--------------------|
| I. Sandboxed Execution — Never In-Process | PASS | PHP runs only via `docker run` subprocess: stdin delivery, zero mounts, `--network=none`, 256 MB memory cap, 30 s supervisor timeout with `docker kill`, `--cap-drop=ALL` (research D1–D4; contract `run_php` guarantees). No eval/interpreter anywhere in app processes. |
| II. Local-First Data | PASS | Versioned `.pnb.json`, human-readable pretty JSON, atomic writes, newer-version refusal without modification (D13, `load_notebook`/`save_notebook` contract). Recents local (D14). Offline except inherently-network actions. Nothing leaves machine; no telemetry. |
| III. Testability | PASS | Pure logic isolated in `src/lib/**` (interpolation, validation, truncation); IPC contract documented + mirrored types + shared fixtures tested both sides (D12); Rust services behind traits fakeable in unit tests; real Docker path covered by gated integration tests (D11). |
| IV. Small Vertical Slices | PASS | Delivery ordered US1→US5, each independently demoable per spec; no speculative abstraction (no plugin system, no codegen, single store). |
| V. Clear, Honest UX | PASS | Per-cell run state machine (data-model) drives always-visible state (FR-032); typed `RuntimeHealth` with per-failure remedies (D5); confirmations for destructive actions (FR-004/010); secrets masked with explicit reveal (D16). |
| Security & Execution Constraints | PASS | Stack matches the fixed MVP stack exactly (scaffold verified). Capabilities minimal: core + dialog + opener only, no fs scope — all I/O via purpose-built Rust commands (D15). Markdown sanitized, no raw HTML (D8). HTTP responses inert data (FR-024, contract §5). Redaction rules in contract conventions + D16. |
| Development Workflow & Quality Gates | PASS | Gates enumerated in quickstart (tsc, lint, Vitest, cargo test/clippy); review checklist calls out Principle I for execution/IPC/fs changes. |

## Project Structure

### Documentation (this feature)

```text
specs/001-notebook-mvp/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── ipc-commands.md            # IPC source of truth (9 commands)
│   └── notebook-file.schema.json  # .pnb.json v1 JSON Schema
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/                                # React + TypeScript frontend (existing scaffold)
├── components/
│   ├── home/                       # start screen: create/open + recents list
│   ├── notebook/                   # notebook shell, cell list, add/reorder controls
│   ├── cells/                      # MarkdownCell, PhpCell, HttpCell + result views
│   ├── env/                        # env-var panel (mask/reveal, validation)
│   └── common/                     # confirm dialogs, health banner, LogoMark, indicators
├── theme/                          # brand & theme foundation (dark-only MVP, D17):
│   ├── appIdentity.ts              #   name/short-name/tagline/description — identity source
│   ├── tokens.ts                   #   color/spacing/typography tokens — ONLY place with raw hex
│   └── theme.css                   #   global base layer consuming CSS vars (no raw hex)
├── state/                          # Zustand stores: notebookStore, appStore
├── lib/                            # PURE logic (unit-tested, no Tauri imports):
│   ├── notebook.ts                 #   create/validate/normalize notebook v1
│   ├── interpolate.ts              #   {{name}} resolution + unresolved detection
│   └── truncate.ts                 #   display truncation helpers
├── ipc/                            # typed invoke wrappers — the TS contract mirror
├── types/                          # Notebook/Cell/Result/Health types (contract mirror)
└── App.tsx / main.tsx              # existing entry points

src-tauri/                          # Rust backend (existing scaffold)
├── src/
│   ├── commands/                   # thin #[tauri::command] handlers (9 commands)
│   ├── services/
│   │   ├── notebook_io.rs          # validate/load/atomic-save, mtime conflicts
│   │   ├── recents.rs              # recents.json store (cap 20)
│   │   ├── http_runner.rs          # reqwest execution, cancel registry, caps
│   │   ├── docker.rs               # CLI wrapper: probes, pull, run supervision
│   │   └── run_registry.rs         # runId → cancellation handles
│   ├── models.rs                   # serde structs — the Rust contract mirror
│   └── lib.rs                      # builder: register commands + dialog plugin
├── tests/
│   └── docker_exec.rs              # #[ignore] integration tests (real Docker)
├── capabilities/default.json       # core + dialog + opener only
└── tauri.conf.json

src/**/*.test.ts(x)                 # Vitest colocated tests
docs/brand-guidelines.md            # brand & theme decisions (T061)
specs/001-notebook-mvp/contracts/fixtures/   # shared IPC JSON fixtures (created with impl)
```

**Structure Decision**: Single desktop-app project reusing the existing scaffold —
frontend in `src/`, backend in `src-tauri/`. New code lands in the subdirectories
above; no workspace split, no extra packages. Pure logic is quarantined in `src/lib/`
(frontend) and `services/` (backend) to satisfy Principle III without indirection
elsewhere. Brand identity and visual design are centralized in `src/theme/`
(appIdentity + tokens, dark-only for MVP, no user-facing theme settings — research
D17); components import from there and never hardcode the app name, tagline, logo, or
raw brand colors.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally empty.

## Forward-Compatibility Notes — Output Intelligence track (Phase 2+)

A future "Output Intelligence & Developer-Friendly Results" track
([docs/roadmap.md](../../docs/roadmap.md), summarized in spec.md §Future Directions)
will grow cell outputs into rich result inspectors. It is **not** part of this plan
and changes nothing in Phase 1 scope; the notes below only record that the Phase 1
architecture already leaves the right seams, so no Phase 1 decision needs revisiting:

- `HttpResponseSummary`/`PhpRunResult` are persisted per cell as `lastRun`, so richer
  viewers (tree/pretty/raw modes, metadata summaries) are pure presentation layers
  over data the contract already carries; output history would extend, not replace,
  this shape in a future schema revision.
- Result rendering is isolated in `HttpResultView` (and later `PhpResultView`), the
  single mount point where view-mode tabs, JSON trees, and copy/export actions would
  plug in.
- Formatting/inspection logic (JSON tree building, path derivation, PHP-array
  export, diffing) belongs in pure `src/lib/**` modules per Principle III — same
  placement rule the interpolation lib follows today.
- The security posture carries over unchanged: responses stay inert data (FR-024 —
  future HTML preview is source-view only unless the security model is explicitly
  revisited), raw output always remains available, and the logging policy
  (no payloads, no secrets) binds every future copy/export/redaction feature.
