# Tasks: PHP Notebook Editor — Phase 1 MVP

**Input**: Design documents from `/specs/001-notebook-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED — Constitution Principle III makes tests part of "done" for every
slice (pure-logic unit tests, contract fixture tests both sides, gated Docker
integration tests). Manual verification checkpoints close each story per quickstart.md.

**Organization**: Grouped by user story (US1–US5 map to spec.md priorities P1–P5).
Each story phase is independently completable and demoable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1…US5 — traceability to spec.md user stories
- Every task names exact file paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, tooling, directory skeleton on top of the existing Tauri scaffold

- [x] T001 Add frontend runtime deps with Bun: `zustand`, `codemirror` + `@codemirror/lang-php` + `@codemirror/lang-markdown` + `@codemirror/lang-json`, `react-markdown`, `remark-gfm`, `rehype-sanitize`, `@tauri-apps/plugin-dialog` (updates `package.json`, `bun.lock`). All package names verified against the npm registry 2026-08-03 (incl. official `@codemirror/lang-php` 6.x) — install exactly these names
- [x] T002 Add frontend test tooling: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`; create `vitest.config.ts` (jsdom env, globals); add `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"typecheck": "tsc --noEmit"`
- [x] T003 [P] Add ESLint 9 flat config `eslint.config.js` with `typescript-eslint` + `eslint-plugin-react-hooks`; add `"lint": "eslint src"` script to `package.json`
- [x] T004 Add Rust deps to `src-tauri/Cargo.toml`: `tokio` (rt, process, time, io-util, sync, macros), `reqwest` (rustls-tls, no default TLS), `tauri-plugin-dialog`, `chrono` (serde), `thiserror`; dev-deps: `tempfile`, `wiremock`
- [x] T005 Register dialog plugin in `src-tauri/src/lib.rs` builder and set minimal permissions in `src-tauri/capabilities/default.json`: `core:default`, `dialog:default`, `opener:default` — nothing else (plan D15). All notebook/recents file reads and writes go through the narrow Rust commands only; never add `tauri-plugin-fs` or any webview filesystem/shell capability
- [x] T006 [P] Create directory skeleton: `src/components/{home,notebook,cells,env,common}/`, `src/state/`, `src/lib/`, `src/ipc/`, `src/types/`, `src-tauri/src/commands/`, `src-tauri/src/services/`, `src-tauri/tests/`, `specs/001-notebook-mvp/contracts/fixtures/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The typed IPC contract mirrors + fixtures + pure notebook logic every story builds on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 [P] Write TS contract mirror in `src/types/notebook.ts`: `Notebook`, `Cell` discriminated union (`MarkdownCell`/`PhpCell`/`HttpCell`), `HttpRequestSpec`, `EnvVar`, `PhpRunResult`, `HttpRunResult`, `HttpResponseSummary`, `RuntimeHealth`, `RecentEntry`, `CommandError`, `ErrorCode` — exactly per data-model.md and contracts/ipc-commands.md; `Notebook` includes an index signature (`[key: string]: unknown`) so unknown top-level file fields pass through load/edit/save untouched (data-model forward-tolerance)
- [x] T008 [P] Write Rust contract mirror in `src-tauri/src/models.rs`: same shapes as serde structs/enums with `#[serde(rename_all = "camelCase")]`, plus `CommandError { code, message }` implementing `serde::Serialize` for command rejection; `Notebook` struct carries `#[serde(flatten)] extra: serde_json::Map<String, serde_json::Value>` preserving unknown top-level fields on round-trip; wire `mod models` into `src-tauri/src/lib.rs`
- [x] T009 Create shared contract fixtures in `specs/001-notebook-mvp/contracts/fixtures/`: `notebook-v1.json` (all 3 cell types + env vars incl. one secret + lastRun values + one unknown top-level field, e.g. `"xCustomTool": {...}`, to exercise forward-tolerance), `php-run-result.json`, `http-run-result.json` (success + transport-error variants), `runtime-health.json` (all 4 states), `recents.json` — all valid against `contracts/notebook-file.schema.json`
- [x] T010 [P] Rust fixture tests: `#[cfg(test)]` module in `src-tauri/src/models.rs` deserializing every fixture via `include_str!` and asserting lossless serialize round-trip, including preservation of the fixture's unknown top-level field (depends on T008, T009)
- [x] T011 [P] TS fixture tests in `src/types/notebook.test.ts`: parse every fixture, exhaustively narrow the `Cell` union, assert unknown `status`/`type` values fail type guards (depends on T007, T009)
- [x] T012 [P] Pure notebook logic in `src/lib/notebook.ts`: `createEmptyNotebook(title)`, `validateNotebook(json)` returning typed results (`ok` | `invalidNotebook{reason}` | `versionUnsupported`), cell factory helpers with unique ids; unit tests in `src/lib/notebook.test.ts` covering corrupted shapes, `schemaVersion: 2` rejection, empty notebook validity, unknown top-level fields passing validation untouched (depends on T007)
- [x] T013 [P] Typed invoke layer in `src/ipc/invoke.ts`: wraps Tauri `invoke`, narrows rejections into `CommandError`, exports `ipcCall<TReq, TRes>(cmd, payload)`; thrown errors carry the originating command name so UI recovery branches on (command, code) — e.g. `fileNotFound` from `load_notebook` (missing-file info) vs from `save_notebook` (Save As/Cancel fallback); declare all 9 command signatures per contracts/ipc-commands.md in `src/ipc/index.ts` (depends on T007)
- [x] T060 Brand & theme foundation (inserted 2026-08-03 — executes BEFORE T014 and all UI tasks): `src/theme/appIdentity.ts` (APP_NAME "PHP Notebook Editor", APP_SHORT_NAME "PNB", tagline, description, positioning, personality: calm, precise, developer-focused, local-first, safe, modern, technical-but-friendly); `src/theme/tokens.ts` (dark-only design tokens — exact brand palette incl. bg `#101218`, primary `#6C7FD8`, cell accents markdown `#8A94A6` / php `#777BB4` / http `#35C2A4`, code surfaces, system-only font stacks — raw hex lives ONLY here) exported as typed constants and stamped as CSS custom properties at startup; `src/theme/theme.css` global base layer (reset, body, focus ring, selection, scrollbars — consumes CSS vars, zero raw hex); placeholder `src/components/common/LogoMark.tsx` (rounded square + three stacked cell bars in the three accents + play triangle; inline SVG, original composition, swappable later). NO user-facing theme settings, no external fonts. Unit tests: accent set complete + brand hexes pinned (research D17)
- [x] T061 [P] Brand guidelines doc in `docs/brand-guidelines.md`: record name, tagline, personality, dark-only decision, token/identity file locations, cell accent semantics, no-hardcoding rule, LogoMark replacement plan (research D17)
- [x] T062 Add Tailwind CSS styling foundation (inserted 2026-08-03 — executes with T060, before all UI tasks): install/configure Tailwind v4 with Bun (`tailwindcss` + `@tailwindcss/vite`, CSS-first — no tailwind.config.js); `src/theme/theme.css` defines `--pnb-*` token variables + `@theme inline` semantic mapping (bg-app/surface/elevated/subtle, text-primary/secondary/muted, brand triplet, status colors, cell accents, code surfaces, scrim) + `@utility border-subtle/default/strong`; import theme.css globally in `src/main.tsx`; `tokens.ts` becomes the TS mirror with a css↔ts sync test; common primitives `src/components/common/Button.tsx` (primary/secondary/ghost/danger × sm/md/lg), `Panel.tsx`, `Badge.tsx` (status + cell tones); restyle existing shell/home/dialogs with semantic utilities; NO raw hex/arbitrary color classes in components; heavy UI frameworks excluded (Radix later only for a11y-heavy primitives) (research D18)
- [x] T014 Replace scaffold UI: `src/App.tsx` becomes a view switch (`home` ⟷ `notebook`) with placeholder screens styled via `src/theme` tokens + `theme.css` base layer (imported in `src/main.tsx`) + `LogoMark`/`appIdentity` in the header; strip Tauri starter demo content from `src/App.tsx`/`src/App.css` (depends on T007, T060)

- [x] T063 Frontend foundation libraries (inserted 2026-08-03): `lucide-react` (single icon pack), `@radix-ui/react-dialog` (ConfirmDialog/ErrorDialog rebuilt on Radix — managed focus/escape/aria), `zod` (validateNotebook rewritten zod-backed, same API; Rust stays authoritative), `@testing-library/jest-dom` via `src/test/setup.ts` + vitest `setupFiles` (research D19)
- [x] T064 Frontend error mapping layer in `src/lib/errors.ts` (+`errors.test.ts`): every ErrorCode × originating command → `{title, message, severity, detail}`; ErrorDialog shows friendly copy with raw detail behind a disclosure; Home/Shell refactored onto it (research D20)
- [x] T065 Centralized config modules: `src-tauri/src/config.rs` (PHP image + `PNB_PHP_IMAGE` override, HTTP/PHP timeout defaults, output caps, recents limit — recents service consumes it) and `src/lib/config.ts` (frontend defaults; notebook lib imports timeouts from it) (research D21)
- [x] T067 Responsive UI foundation (inserted 2026-08-04 — precedes all UI-heavy work): resizable-desktop policy per constitution v1.1.0 (min 1024×700, best-effort 900×650, no fixed shell dimensions); `App.tsx` becomes `h-screen w-screen overflow-hidden` shell; screens use `h-full` flex columns with exactly one intentional scroll region (Home content column; shell header fixed + cell area `min-h-0 flex-1 overflow-y-auto`); headers/toolbars `flex-wrap` with icon-only collapse at narrow widths; recents responsive grid (1/2/3 cols); dialogs `max-h-[min(85vh,560px)]` + internal scroll; `Panel` `w-full min-w-0`, `Button` `whitespace-nowrap`, truncation over layout breakage; guarded Tauri-only APIs so the UI also renders in a plain browser for viewport testing (docs/architecture.md §Desktop responsive layout foundation)
- [x] T066 Baseline a11y + changelog: dirty-dot gains `role="status"`/sr-only text, `prefers-reduced-motion` guard in theme.css, Radix dialog focus management; `CHANGELOG.md` added (Keep a Changelog, Unreleased section) (research D22)

**Checkpoint**: Contract mirrors tested against shared fixtures on both sides — user stories can begin

---

## Phase 3: User Story 1 - Create, Save, and Reopen Notebooks (Priority: P1) 🎯 First vertical slice

**Goal**: Durable local `.pnb.json` notebooks: create, open, save/save-as, recents, unsaved-changes protection, corrupt/newer-version rejection

**Independent Test**: quickstart.md §US1 — create → save → quit → relaunch → reopen from recents with identical content; corrupt-file and missing-file paths produce friendly errors

- [x] T015 [P] [US1] Rust notebook I/O service in `src-tauri/src/services/notebook_io.rs`: `load(path)` (read → parse → validate schemaVersion/shape → `Notebook` + mtime; typed errors `fileNotFound`/`invalidNotebook`/`versionUnsupported`/`io`), `save(path, notebook, expected_mtime)` (when `expected_mtime` is non-null and no file exists at path → `fileNotFound`, never silently recreating an externally deleted/moved/renamed file; mtime mismatch → `conflictOnDisk`; then pretty 2-space stable-order JSON → temp file + atomic rename → new mtime)
- [x] T016 [P] [US1] Rust recents service in `src-tauri/src/services/recents.rs`: `recents.json` in app-data dir, `list()`, `touch(path, title)`, `remove(path)`, sorted desc, cap 20, corrupt store self-heals to empty
- [x] T017 [US1] Unit tests (in-module, using `tempfile`) for `notebook_io.rs`: load valid fixture, reject corrupt/newer-version without modifying file, atomic save leaves no temp debris, mtime conflict returns `conflictOnDisk`, save onto an externally deleted path with non-null expected mtime returns `fileNotFound`, unknown top-level fixture field survives load→save round-trip; and for `recents.rs`: cap, ordering, self-heal (depends on T015, T016)
- [x] T018 [US1] Tauri commands in `src-tauri/src/commands/notebook.rs`: `load_notebook`, `save_notebook`, `list_recents`, `remove_recent` per contracts/ipc-commands.md §1–4 (load/save touch recents); register in `src-tauri/src/lib.rs` invoke handler
- [x] T019 [US1] Frontend IPC impls in `src/ipc/notebook.ts`: `loadNotebook`, `saveNotebook`, `listRecents`, `removeRecent` via `ipcCall` (depends on T013, T018)
- [x] T020 [US1] Notebook document store in `src/state/notebookStore.ts` (Zustand): `{ notebook, path, fileMtimeMs, dirty }`, actions `newNotebook`, `openFromPath`, `save`, `saveAs`, `markDirty`, `close`; store unit tests in `src/state/notebookStore.test.ts` with mocked IPC (dirty set on mutation, cleared on save, conflict retry with `expectedMtimeMs: null`)
- [x] T021 [P] [US1] App store in `src/state/appStore.ts`: recents list state + load/remove actions, current view routing; tests in `src/state/appStore.test.ts`
- [x] T022 [US1] Home screen in `src/components/home/HomeScreen.tsx`: Create Notebook (save dialog via `@tauri-apps/plugin-dialog` → `newNotebook` + first save), Open Notebook (open dialog filtered `.pnb.json`), recents list with missing-file flow (error message + "remove entry?" confirm) per FR-005; header renders `LogoMark` + app name + tagline imported from `src/theme/appIdentity.ts` — no hardcoded identity strings
- [x] T023 [US1] Notebook shell in `src/components/notebook/NotebookShell.tsx`: title display/edit, dirty indicator (●), Save / Save As buttons, back-to-home navigation guarded by unsaved-changes confirm (FR-004)
- [x] T024 [US1] Window close protection in `src/App.tsx`: `getCurrentWindow().onCloseRequested` → when dirty, `event.preventDefault()` + confirm dialog (discard/cancel)
- [x] T025 [US1] Error surfaces in `src/components/common/ErrorDialog.tsx` + `ConfirmDialog.tsx`: actionable messages for `invalidNotebook`, `versionUnsupported`, `fileNotFound` on open; `conflictOnDisk` → "file changed on disk" overwrite-confirm that retries save with `expectedMtimeMs: null`; `fileNotFound` on save → "file was moved or deleted" dialog offering Save As (routes to existing save-as flow) or Cancel — never silent recreation (spec edge case)
- [x] T026 [US1] CHECKPOINT: execute quickstart.md §US1 scenarios 1–7 manually; all pass → story done

**Checkpoint**: First vertical slice — durable notebooks work end to end. (Full Phase 1 MVP = US1–US5 + Phase 8 verification, per spec scope)

---

## Phase 4: User Story 2 - Compose Notebooks from Cells (Priority: P2)

**Goal**: Add/edit/delete/reorder Markdown, PHP, and HTTP cells; sanitized Markdown preview; exact persistence of cells and order

**Independent Test**: quickstart.md §US2 — build a mixed-cell notebook, mutate it, reorder, save/reopen → identical; `<script>` in Markdown renders inert

- [x] T027 [P] [US2] CodeMirror 6 wrapper in `src/components/common/CodeEditor.tsx`: controlled component, language prop (`php` | `markdown` | `json` | `text`), editor dark theme derived from `src/theme/tokens.ts`, chrome styled with Tailwind semantic utilities, no global state
- [x] T028 [P] [US2] Cell mutation actions in `src/state/notebookStore.ts`: `addCell(type, index)`, `updateCell(id, patch)`, `deleteCell(id)`, `moveCell(id, direction)` (boundary moves no-op per edge case); extend `src/state/notebookStore.test.ts`: order integrity, id uniqueness, dirty flag on every mutation
- [x] T029 [US2] Cell list UI in `src/components/notebook/CellList.tsx`: renders cells in order, insert-cell control with type picker at any position (FR-008), per-cell toolbar (move up/down, delete with `ConfirmDialog` per FR-010); per-type accent styling via Tailwind `*-cell-markdown/php/http` utilities + `Badge` cell tones; toolbar uses `Button` primitives (depends on T027, T028)
- [x] T030 [P] [US2] Markdown cell in `src/components/cells/MarkdownCell.tsx`: edit (CodeEditor markdown) / preview toggle rendering `react-markdown` + `remark-gfm` + `rehype-sanitize`, no raw HTML pass-through; component test `src/components/cells/MarkdownCell.test.tsx` asserting `<script>alert(1)</script>` renders inert text and GFM tables render (FR-012); styled with Tailwind semantic utilities + common primitives
- [x] T031 [P] [US2] PHP cell authoring in `src/components/cells/PhpCell.tsx`: CodeEditor php mode + empty result placeholder (run arrives in US5); authoring/saving independent of runtime per FR-030; Tailwind semantic utilities + `Panel`/`Badge` primitives
- [x] T032 [P] [US2] HTTP cell authoring in `src/components/cells/HttpCell.tsx`: method select (GET/POST/PUT/PATCH/DELETE), URL input, headers name/value row editor, body CodeEditor, timeout field defaulting 30 s (FR-019); Tailwind semantic utilities + `Button`/`Badge` primitives
- [x] T033 [US2] CHECKPOINT: execute quickstart.md §US2 scenarios 1–5 manually; SC-002 round-trip diff clean → story done

**Checkpoint**: Notebooks are fully authorable documents

---

## Phase 5: User Story 3 - Run HTTP Request Cells (Priority: P3)

**Goal**: Execute HTTP cells from Rust: status/headers/body/duration display, transport-vs-HTTP-status distinction, cancel, timeout, truncation

**Independent Test**: quickstart.md §US3 — GET/POST against httpbin, 500 styled as HTTP status, unreachable host as transport failure, 2 s timeout fires, cancel works, 4 MB body truncates

- [x] T034 [P] [US3] Run registry in `src-tauri/src/services/run_registry.rs`: `runId → tokio CancellationToken` map (register, cancel, cleanup on completion), managed as Tauri state; in-module unit tests (cancel unknown id → false)
- [x] T035 [US3] HTTP runner in `src-tauri/src/services/http_runner.rs`: shared `reqwest` client (rustls), execute `HttpRequestSpec` with timeout (default 30000 ms), `tokio::select!` on cancellation token, capture status/headers, read body capped at 2 MB → `bodyTruncated`, binary body → size+content-type summary, map errors to `error.kind` (`network`/`timeout`/`invalidRequest`/`cancelled`), measure `durationMs`, never log payloads (depends on T034)
- [x] T036 [US3] HTTP runner tests in `src-tauri/src/services/http_runner.rs` + `src-tauri/tests/http_runner_mock.rs` using `wiremock`: 200 with headers/body, 500 → `succeeded` with statusCode 500, connection refused → `network`, slow endpoint + short timeout → `timeout`, big body → truncated flag (depends on T035)
- [x] T037 [US3] Commands `run_http` + `cancel_run` in `src-tauri/src/commands/run.rs` per contracts §5/§7; register in `src-tauri/src/lib.rs`
- [x] T038 [US3] Frontend IPC in `src/ipc/run.ts`: `runHttp(runId, request)`, `cancelRun(runId)` (depends on T013, T037)
- [x] T039 [US3] Run state machine in `src/state/notebookStore.ts`: per-cell `runState` (`idle`/`running`+runId/terminal), actions `startHttpRun(cellId)` (generate runId via `crypto.randomUUID()`, invoke, persist terminal result to `cell.lastRun`, mark dirty), `cancelRun(cellId)`; one active run per cell (run disabled while running); tests for the transition table in `src/state/notebookStore.test.ts` (data-model state machine)
- [x] T068 [US3] cURL import parser (inserted 2026-08-04): `src/lib/curlImport.ts` — pure TS tokenizer (single/double quotes, escapes, backslash continuations, `$` prompt strip), supports -X/--request (attached -XPOST and --long=value forms), -H/--header, -d/--data/--data-raw/--data-binary (multiple joined with &, @file skipped with warning), --max-time→clamped timeoutMs, --url; unsupported options (multipart, cookies, certs, proxies, --compressed, -G, -I, auth flags, HTTP-version flags, unknown) produce warnings without failing; auto-adds JSON Content-Type when body parses as JSON and none set; sensitive-header detection (Authorization/Cookie/X-API-Key/api-key/X-Auth-Token/Proxy-Authorization + Bearer/Basic values); never logs input; 19 tests in `src/lib/curlImport.test.ts` (FR-035)
- [x] T069 [US3] cURL import UI: `src/components/cells/ImportCurlDialog.tsx` (Radix dialog, mono textarea, Cancel/Import, inline parse errors keep cell unchanged, post-import notes stage listing sensitive-header review notices + warnings) + "Import cURL" button in `HttpCell.tsx` (disabled while running; import fills method/URL/headers/body, keeps existing timeout unless --max-time given; never auto-runs) (FR-035)
- [x] T040 [US3] HTTP result UI: run/cancel button + spinner in `src/components/cells/HttpCell.tsx`; new `src/components/cells/HttpResultView.tsx` showing status code (styled distinctly for 4xx/5xx vs transport failure per FR-021 using status-color utilities), collapsible headers, body pane on `bg-code-bg` with truncation `Badge` (FR-025), duration; restored `lastRun` renders on reopen; Tailwind semantic utilities throughout
- [ ] T041 [US3] CHECKPOINT: execute quickstart.md §US3 scenarios 1–7 manually; SC-003 timing spot-check → story done

**Checkpoint**: First live execution capability shipped

---

## Phase 6: User Story 4 - Manage Notebook Environment Variables (Priority: P4)

**Goal**: Per-notebook env vars with `{{name}}` interpolation into HTTP cells, secret masking, unresolved-placeholder warnings

**Independent Test**: quickstart.md §US4 — `{{base_url}}`/`{{token}}` substitution echoed by httpbin, secret masked until reveal, `{{missing}}` blocks with named warning, zero secrets in logs

- [ ] T042 [P] [US4] Interpolation lib in `src/lib/interpolate.ts`: `interpolate(text, vars)` (single pass, no recursion), `resolveRequest(request, vars)` covering url/header names/header values/body, `collectUnresolved(request, vars)` returning placeholder names; exhaustive tests in `src/lib/interpolate.test.ts` (FR-016/FR-017, adjacent tokens, `{{` literals, empty values)
- [ ] T043 [P] [US4] Env var actions in `src/state/notebookStore.ts`: `addEnvVar`, `updateEnvVar`, `deleteEnvVar` with name regex `^[A-Za-z_][A-Za-z0-9_]*$` + uniqueness validation (FR-014); tests: duplicate rejection, deletion allowed while referenced (edge case)
- [ ] T044 [US4] Env panel UI in `src/components/env/EnvPanel.tsx`: table CRUD, secret toggle, masked display `••••` with per-row reveal action (FR-015), inline validation errors; wire into `NotebookShell` as collapsible `Panel`; Tailwind semantic utilities + `Button` primitives
- [ ] T045 [US4] Wire interpolation into HTTP run in `src/state/notebookStore.ts` `startHttpRun`: `collectUnresolved` → if any, block and surface warning dialog naming placeholders (FR-017); else send `resolveRequest` output to `runHttp`; unit test both paths
- [ ] T046 [US4] CHECKPOINT: execute quickstart.md §US4 scenarios 1–5 manually incl. automated log sweep (SC-009): run the session with `bun run tauri dev 2>&1 | tee /tmp/pnb-session.log`, exercise secret-bearing requests, then `grep -c "secret-123" /tmp/pnb-session.log` MUST output 0 → story done

**Checkpoint**: HTTP cells reusable across environments; secrets handled per constitution

---

## Phase 7: User Story 5 - Run PHP Cells in an Isolated Runtime (Priority: P5)

**Goal**: PHP execution in hardened Docker sandbox (stdin delivery, zero mounts, no network, memory/time limits, kill-on-timeout) with typed health checks and remedies

**Independent Test**: quickstart.md §US5 — health states with Docker stopped/image missing; echo/exception/infinite-loop/memory-bomb/network/filesystem probes behave per spec; no leftover containers

- [ ] T047 [P] [US5] Docker service (probes + args) in `src-tauri/src/services/docker.rs`: image name from a single configurable source `php_image()` (env override `PNB_PHP_IMAGE`, default `php:8.4-cli`; code note: future releases may pin by digest for reproducibility) used by probe, pull, and run alike; probe chain `which docker` → `docker version` → `docker image inspect <configured image>` producing `RuntimeHealth` with per-state `detail`+`remedy` (plan D5); `pull_image()`; pure `build_run_args(runId, limits)` emitting exactly the D3 flag set (`--rm -i --network=none --memory=256m --cpus=1 --pids-limit=64 --cap-drop=ALL --security-opt=no-new-privileges --name pnb-run-<runId>`); unit tests for arg builder and probe output parsing
- [ ] T048 [US5] Run supervision in `src-tauri/src/services/docker.rs`: spawn `docker run` via `tokio::process`, write code to stdin then close, capture stdout/stderr capped 1 MB each (`truncated` flag), `tokio::select!` over child exit / timeout / cancellation token; timeout or cancel → `docker kill pnb-run-<runId>` → status `terminated(timeout)` / `cancelled`; uninitiated exit 137 → `terminated(memory)`; build `PhpRunResult` with `durationMs`, `ranAt` (chrono); never log code or output (depends on T034, T047)
- [ ] T049 [US5] Commands `check_php_runtime`, `pull_php_image`, `run_php` in `src-tauri/src/commands/runtime.rs` per contracts §6/§8/§9 (`run_php` re-probes health first → `runtimeUnavailable` with remedy); register in `src-tauri/src/lib.rs`
- [ ] T050 [US5] Docker integration tests in `src-tauri/tests/docker_exec.rs`, all `#[ignore]` (run via `cargo test -- --ignored`): echo → stdout+succeeded; `throw` → failed with stderr; `while(true){}` with 2 s limit → terminated(timeout) AND `docker ps -a` shows no `pnb-run-*` leftovers; `file_get_contents` external URL → network failure inside sandbox; 1 GB `str_repeat` → terminated(memory) (depends on T048, T049)
- [ ] T051 [US5] Frontend IPC in `src/ipc/runtime.ts`: `checkPhpRuntime`, `pullPhpImage`, `runPhp` (depends on T013, T049)
- [ ] T052 [US5] Health banner in `src/components/common/RuntimeHealthBanner.tsx`: probe on app start + before runs, render status/detail/remedy, `imageMissing` → in-app "Pull image" button with progress state; health state in `src/state/appStore.ts` (FR-029, SC-007); status-color utilities + `Badge`/`Button` primitives
- [ ] T053 [US5] PHP run UI in `src/components/cells/PhpCell.tsx` + new `src/components/cells/PhpResultView.tsx`: run/cancel gated on health (authoring never gated per FR-030), stdout and stderr visually distinct on `bg-code-bg` (FR-027), duration, terminated-cause `Badge` (`timeout`/`memory`), truncation `Badge`; wire `startPhpRun` action with interpretation-free pass-through of code; Tailwind semantic utilities throughout (depends on T039 pattern, T051, T052)
- [ ] T054 [US5] CHECKPOINT: execute quickstart.md §US5 scenarios 1–9 manually (health paths first, then execution paths); SC-005/SC-007 verified → story done

**Checkpoint**: All five stories functional — full Phase 1 scope delivered

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, examples, docs, gates

- [ ] T055 [P] Create example notebook `examples/welcome.pnb.json` (Markdown intro + PHP hello + HTTP httpbin GET with `{{base_url}}` env var) validating against `specs/001-notebook-mvp/contracts/notebook-file.schema.json`
- [ ] T056 [P] Update `README.md`: check off delivered milestone items, document test commands (`bun run test`, `cargo test`, `cargo test -- --ignored`, `bun run lint`, `bun run typecheck`), link `specs/001-notebook-mvp/quickstart.md`
- [ ] T057 Full manual acceptance pass: quickstart.md top-to-bottom including Success-criteria spot-check table (SC-001…SC-009)
- [ ] T058 Gates sweep — all green: `bun run typecheck`, `bun run lint`, `bun run test`, `cd src-tauri && cargo test && cargo clippy` (no new warnings)
- [ ] T059 Constitution compliance review against plan.md Constitution Check table: audit `src-tauri/capabilities/default.json` still minimal (core/dialog/opener only); grep app code for any in-process PHP execution path (must be none); logging audit — static: `grep -rn 'println!\|eprintln!\|log::\|tracing::\|dbg!' src-tauri/src/` and review every hit (none may reference request/response bodies, headers, PHP source, run output, or env values); dynamic: repeat the T046 secret-grep sweep on a full session capture covering PHP + HTTP runs; brand audit: grep `src/components` + `src/App.tsx` for hardcoded identity/brand values ("PHP Notebook Editor" literal, tagline literal, raw accent hex colors) — all must import from `src/theme` (T060 rule)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — **BLOCKS all user stories**. Includes brand/theme foundation: T060 blocks T014 and every UI task (T022, T023, T027, T029–T032, T040, T044, T052, T053); T061 is documentation, non-blocking
- **US1 (Phase 3)**: depends on Foundational only
- **US2 (Phase 4)**: depends on Foundational + US1 (needs notebook shell/store to host cells)
- **US3 (Phase 5)**: depends on US2 (needs HTTP cell authoring UI)
- **US4 (Phase 6)**: depends on US3 for full value (interpolation wired into HTTP runs); env panel itself only needs US1 shell
- **US5 (Phase 7)**: depends on US2 (PHP cell authoring) + T034 (run registry from US3); independent of US4
- **Polish (Phase 8)**: depends on all stories

### Story completion order

```
Setup → Foundational → US1 (MVP) → US2 → US3 → US4
                                      └────────→ US5 (can start after US2 + T034)
```

### Within each story

- Rust services → commands → frontend IPC → store actions → UI → checkpoint
- Tests live with the task that builds the unit (Principle III: slice not done without tests)

### Parallel Opportunities

- Setup: T003, T006 parallel with T001/T002/T004/T005
- Foundational: T007 ∥ T008 ∥ T060; after T009: T010 ∥ T011 ∥ T012 ∥ T013; T061 parallel with everything
- US1: T015 ∥ T016; T021 ∥ T020
- US2: T027 ∥ T028; then T030 ∥ T031 ∥ T032
- US3: T034 parallel with any US2 leftovers
- US4: T042 ∥ T043
- US5: T047 parallel with US4 entirely; T050 ∥ T051/T052 after T049
- Two-track option after US2: one track US3→US4 (HTTP), second track US5 (Docker) — only shared file is `run_registry.rs` (T034)

## Parallel Example: Foundational

```bash
# After T009 (fixtures) lands, launch together:
Task: "Rust fixture round-trip tests in src-tauri/src/models.rs"        # T010
Task: "TS fixture tests in src/types/notebook.test.ts"                  # T011
Task: "Pure notebook logic + tests in src/lib/notebook.ts"              # T012
Task: "Typed invoke layer in src/ipc/invoke.ts + src/ipc/index.ts"      # T013
```

## Parallel Example: User Story 2

```bash
# After CellList (T029) exists, launch together:
Task: "MarkdownCell with sanitized preview + inert-script test"         # T030
Task: "PhpCell authoring editor"                                        # T031
Task: "HttpCell authoring form"                                         # T032
```

---

## Implementation Strategy

### First Slice First (US1 only)

1. Phase 1 Setup → Phase 2 Foundational (contract mirrors + fixtures tested both sides)
2. Phase 3 US1 → **STOP at T026**: durable notebooks demoable — first vertical slice / first demo cut (NOT the full MVP; full Phase 1 MVP requires US1–US5 + Phase 8)
3. Demo; gather feedback before cells land

### Incremental Delivery

1. US1 → demo (files + recents)
2. US2 → demo (authorable mixed-cell documents)
3. US3 → demo (live HTTP) — first execution milestone
4. US4 → demo (env vars + secrets)
5. US5 → demo (sandboxed PHP) — full Phase 1
6. Phase 8 polish + full acceptance pass

Each checkpoint task (T026/T033/T041/T046/T054) is the story's manual verification
gate per quickstart.md — do not skip; constitution Principle V failures surface there.

### Solo-developer note

Work strictly in phase order except the US5 head start (T047 can begin any time after
Foundational; T048+ after T034). Commit after each task or logical group; every commit
keeps gates green (typecheck, lint, tests).

---

## Notes

- [P] = different files, no incomplete dependencies
- Task IDs are append-only: T060/T061 were inserted into Phase 2 after initial numbering — physical position in this file + dependency notes define execution order
- All UI tasks consume `appIdentity`, `LogoMark`, theme tokens, Tailwind semantic utilities, and common primitives (`Button`/`Panel`/`Badge`, Radix-based dialogs) per T060+T062+T063: dark-only MVP, no user-facing theme settings, no hardcoded app name/tagline/logo/brand colors, no raw-hex/arbitrary-value color classes in components (audited at T059)
- Icons: `lucide-react` only — never mix icon packs. Errors shown to users go through `src/lib/errors.ts` (T064), never raw. Runtime defaults come from the config modules (T065). Baseline a11y (T066) applies to every new control: keyboard access, labels, no color-only status
- Responsive rules (T067) bind every UI task: shrinkable flex/grid (`min-w-0`/`min-h-0`), one intentional scroll region, editors/outputs scroll internally and never overflow their parent, toolbars wrap or collapse, no fixed shell dimensions, verify at 900×650 and 1024×700
- Checkpoints are real tasks — manual verification is part of scope (user request)
- Docker integration tests (T050) stay `#[ignore]`d so default `cargo test` passes on
  Docker-less machines/CI
- Contract drift protection: any IPC shape change touches contracts/ipc-commands.md +
  both mirrors + fixtures (see contract change policy)
