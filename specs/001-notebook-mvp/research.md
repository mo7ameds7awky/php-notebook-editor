# Phase 0 Research: PHP Notebook Editor — Phase 1 MVP

**Date**: 2026-08-03
**Spec**: [spec.md](./spec.md)
**Status**: Complete — no open NEEDS CLARIFICATION items

All decisions below were evaluated against the constitution (v1.0.0), the feature spec,
and the existing scaffold (Tauri 2, React 19, TypeScript 5.8, Vite 7, Bun).

## D1: PHP execution transport — Docker CLI subprocess from Rust

- **Decision**: The Rust backend executes PHP cells by spawning the `docker` CLI
  (`docker run`) as a child process and supervising it (timeout, kill, output capture).
- **Rationale**: The CLI honors the user's active Docker context automatically (Docker
  Desktop on macOS/Windows exposes varying socket paths; the CLI abstracts this).
  `docker version`/`docker image inspect` double as health-check probes with no extra
  dependency. Child-process supervision (kill on timeout) is straightforward in Rust.
- **Alternatives considered**:
  - **bollard (Docker Engine API crate)**: structured API, but requires resolving the
    correct socket/named-pipe per platform and Docker context; heavier dependency; no
    benefit at MVP scale (one container per run).
  - **Executing PHP via a host PHP binary**: rejected outright — violates Constitution
    Principle I (no isolation, host filesystem exposure).

## D2: Snippet delivery — stdin pipe, zero mounts

- **Decision**: Cell code is piped to the container over stdin; the container runs
  `php` reading the program from stdin. No bind mounts of any host path.
- **Rationale**: The PHP CLI executes a script from stdin when given no file argument.
  Zero mounts is the strongest possible default and satisfies Principle I ("no host
  filesystem by default") with no mount-allowlist machinery in Phase 1.
- **Alternatives considered**:
  - **Mount a temp file with the snippet**: works but introduces a host mount and temp
    file lifecycle for no benefit at this size.
  - **`php -r <code>`**: fragile quoting/escaping through two shells; stdin avoids all
    escaping issues.

## D3: Sandbox posture — restrictive flags + supervised timeout

- **Decision**: Every run uses:
  `docker run --rm -i --network=none --memory=256m --cpus=1 --pids-limit=64
  --cap-drop=ALL --security-opt=no-new-privileges --name pnb-run-<runId> <image> php`.
  Wall-clock timeout (default 30 s) enforced by the Rust supervisor; on expiry it runs
  `docker kill pnb-run-<runId>` and reports termination cause `timeout`. Memory
  overruns surface as container OOM kill (non-zero exit, cause `memory`).
- **Rationale**: Implements Principle I's mandatory timeout + memory limit and
  restricted-by-default network. Named containers make kill deterministic. `--rm`
  guarantees no container debris.
- **Alternatives considered**:
  - **PHP-level `max_execution_time`/`memory_limit` only**: insufficient — PHP-level
    limits are escapable (e.g., by `set_time_limit`); OS/container limits are not.
  - **`--network=bridge` default**: rejected; constitution requires restricted default.
    A per-run opt-in can arrive in a later phase.

## D4: PHP runtime image — configurable, default `php:8.4-cli` (official)

- **Decision**: Execution image comes from a single backend-configured value —
  `PNB_PHP_IMAGE` env override, else the official `php:8.4-cli` default. Probes, pull,
  and run all read the same value. Future releases may pin the default by digest for
  reproducibility.
- **Rationale**: Official image, current stable PHP line, CLI-only (small), matches the
  target audience (modern PHP/Laravel developers); one configuration point avoids
  drift between health checks and execution.
- **Alternatives considered**: `php:8.3-cli` (older line, no advantage for new users);
  custom image (nothing to add yet; revisit when Composer/Laravel features land).

## D5: Runtime health checks — typed probe states

- **Decision**: A `check_php_runtime` command probes in order: (1) `docker` binary on
  PATH → else `docker_not_installed`; (2) `docker version` exit status → else
  `daemon_not_running`; (3) `docker image inspect <configured image>` (D4) → else `image_missing`.
  Healthy → `ok`. Each state carries a human-readable remedy; `image_missing` offers an
  in-app "pull image" action (`pull_php_image` command).
- **Rationale**: Satisfies FR-029/SC-007 — each failure mode maps to a specific,
  actionable message per Principle V.
- **Alternatives considered**: single boolean "docker available" (rejected — generic
  errors violate Principle V); probing the Docker socket directly (ties us to socket
  path discovery, see D1).

## D6: HTTP request execution — Rust-side `reqwest`

- **Decision**: HTTP cells execute in the Rust backend via `reqwest` (rustls TLS),
  exposed as a `run_http` command with per-run cancellation and a response-size display
  cap. The webview never issues the request.
- **Rationale**: Webview `fetch` is CORS-bound — arbitrary API testing would fail for
  most targets. Rust-side execution gives accurate timing, cancellation, timeout
  control, header access (including restricted headers), and lets us cap/truncate
  bodies before they reach the UI (FR-020…FR-025). rustls avoids OpenSSL system
  dependency friction.
- **Alternatives considered**:
  - **Webview `fetch`**: CORS-blocked; no reliable timing; rejected.
  - **tauri-plugin-http**: reqwest underneath, but its permission scoping is designed
    for known-origin allowlists — poor fit for arbitrary user-entered URLs — and it
    hides timing/truncation control. A custom command is smaller than configuring
    around the plugin.

## D7: Code editor — CodeMirror 6

- **Decision**: CodeMirror 6 with `@codemirror/lang-php`, `lang-markdown`, `lang-json`
  for cell editors.
- **Rationale**: Modular and light; clean multi-instance story (a notebook renders many
  editors); no web-worker packaging requirements under Vite/Tauri; good React
  integration via thin wrapper.
- **Alternatives considered**: **Monaco** — heavier bundle, worker setup friction in a
  packaged webview, poor many-instances economics. README named either as candidates;
  CM6 wins on fit.

## D8: Markdown rendering — react-markdown + remark-gfm + rehype-sanitize

- **Decision**: Render Markdown previews with `react-markdown`, GFM extensions, and
  `rehype-sanitize`; raw HTML in Markdown is not rendered.
- **Rationale**: FR-012 and the constitution require sanitized rendering — notebook
  content is untrusted input and must not execute in the webview. This stack renders to
  React elements (no `dangerouslySetInnerHTML`) with an explicit sanitize schema.
- **Alternatives considered**: `marked`/`markdown-it` + DOMPurify (string/innerHTML
  pipeline — larger injection surface); rendering raw HTML pass-through (rejected —
  constitution violation).

## D9: Frontend state — Zustand

- **Decision**: One Zustand store for notebook document state (cells, env vars, dirty
  flag, per-cell run state) plus a small store for app state (recents, runtime health).
- **Rationale**: Minimal API, actions are plain functions testable without rendering,
  no provider ceremony, scales fine for a single-window document editor.
- **Alternatives considered**: Redux Toolkit (ceremony unwarranted at this scale),
  React context + reducers (re-render and testability ergonomics worse).

## D10: Frontend testing — Vitest + React Testing Library

- **Decision**: `vitest` + `@testing-library/react` + jsdom, invoked through Bun
  scripts (`bun run test` → `vitest`). Pure logic lives in `src/lib/**` as plain TS
  modules with colocated `*.test.ts`.
- **Rationale**: Principle III demands unit-testable core logic; Vitest shares the Vite
  pipeline already in the repo. `bun test` lacks mature jsdom/RTL compatibility today,
  and Bun runs Vitest fine as a script runner.
- **Alternatives considered**: `bun test` (ecosystem gaps for component testing);
  Jest (slower, second build pipeline next to Vite).

## D11: Rust testing — cargo test + gated Docker integration tests

- **Decision**: Unit tests in-module (`#[cfg(test)]`) for pure Rust logic (arg
  building, output truncation, notebook file validation). Integration tests in
  `src-tauri/tests/` exercise the real Docker path and are `#[ignore]`d by default; run
  explicitly via `cargo test -- --ignored` where Docker is present.
- **Rationale**: Principle III requires the real Docker execution path to have
  integration tests, while default `cargo test` must stay green on machines/CI without
  Docker.
- **Alternatives considered**: feature-flag gating (equivalent but less discoverable
  than `--ignored`); mocking Docker everywhere (violates the integration-test
  requirement).

## D12: IPC contract — hand-written mirrored types + contract doc + serialization tests

- **Decision**: The IPC contract is documented in
  [contracts/ipc-commands.md](./contracts/ipc-commands.md) as the source of truth.
  Rust `serde` structs (camelCase via `#[serde(rename_all = "camelCase")]`) and TS
  types in `src/types/` mirror it. Both sides carry serialization tests against shared
  JSON fixtures.
- **Rationale**: Principle III requires a typed, tested contract. Nine commands at MVP
  scale don't justify codegen infrastructure; fixture tests catch drift.
- **Alternatives considered**: **tauri-specta** (attractive codegen, but pins us to its
  release cadence and macro surface for marginal benefit at this size — revisit if the
  command count grows).

## D13: Notebook persistence — atomic writes, pretty JSON, mtime conflict check

- **Decision**: Saves write to a temp file in the target directory then rename over the
  destination (atomic on the same filesystem). Files are pretty-printed (2-space)
  stable-ordered JSON. Load/save record file mtime; save compares stored vs current
  mtime and returns a conflict the UI must confirm through (external-change edge case).
- **Rationale**: Atomicity prevents corruption on crash mid-save (Principle II — never
  corrupt user data). Pretty stable JSON keeps files diffable (SC-006). The mtime check
  implements the "file changed on disk" edge case in the spec.
- **Alternatives considered**: direct overwrite (corruption window); content hashing
  (more robust than mtime but slower on large files; mtime adequate for Phase 1).

## D14: Recents & app-local state — plain JSON in app data dir

- **Decision**: Recent-notebooks list lives in `recents.json` under the Tauri
  app-data directory, read/written by Rust; capped at 20 entries.
- **Rationale**: One tiny list doesn't justify SQLite or a store plugin; a plain file
  is transparent and trivially testable.
- **Alternatives considered**: SQLite (README mentions it as optional — deferred until
  there is relational data); `tauri-plugin-store` (adds a plugin for what one file
  does).

## D15: File dialogs & filesystem access — dialog plugin only, all I/O in Rust

- **Decision**: `tauri-plugin-dialog` provides open/save pickers. Every file
  read/write goes through dedicated Rust commands that receive the user-chosen path.
  No `tauri-plugin-fs`, no broad filesystem capability for the webview.
- **Rationale**: Constitution requires minimal Tauri capabilities. The webview never
  touches the filesystem; Rust commands operate only on paths the user explicitly
  picked (or the app-data dir).
- **Alternatives considered**: `tauri-plugin-fs` with scope patterns (grants the
  webview generalized fs power that then must be constrained — larger surface than
  purpose-built commands).

## D16: Secret redaction & interpolation boundary

- **Decision**: `{{name}}` interpolation happens in a pure TS module
  (`src/lib/interpolate.ts`) shared by UI preview and run invocation; the resolved
  request is passed to Rust. Rust logging for HTTP/PHP runs records only method, host,
  status, and duration — never headers, bodies, code, or env values. Secret values are
  masked in the UI by default (per-field reveal action).
- **Rationale**: FR-015…FR-018 and the constitution's secret rules. Keeping
  interpolation pure makes unresolved-placeholder warnings (FR-017) unit-testable.
- **Alternatives considered**: interpolating in Rust (splits one concern across the
  boundary; UI needs the same logic for preview/warnings anyway).

## D17: Brand & theme foundation — centralized tokens, dark-only MVP

- **Decision**: App identity — name "PHP Notebook Editor", short name "PNB", tagline
  "A local-first notebook for PHP, Laravel, and API experiments.", description,
  positioning, personality (calm, precise, developer-focused, local-first, safe,
  modern, technical but friendly) — lives in `src/theme/appIdentity.ts` as the single
  source. Visual tokens (exact brand palette: bg `#101218`, primary `#6C7FD8`,
  surfaces, semantic colors, code backgrounds; spacing; system-only font stacks;
  radii) live in `src/theme/tokens.ts` — the ONLY file containing raw hex — exposed
  as typed constants and stamped as CSS custom properties at the document root;
  `src/theme/theme.css` is the global base layer consuming the variables. Per-cell
  accents: Markdown `#8A94A6` neutral gray, PHP `#777BB4` indigo/purple, HTTP
  `#35C2A4` teal/green. Dark theme only for MVP; **no user-facing theme
  customization**; **no external fonts or image assets**. Placeholder `LogoMark`
  (rounded square, three stacked cell bars in the accents, play triangle — original
  composition, not derivative of PHP/Laravel/Jupyter/Postman marks) stands in until
  real branding; decisions recorded in `docs/brand-guidelines.md`. Components MUST
  import identity/tokens — no hardcoded app name, tagline, logo references, or raw
  brand colors.
- **Rationale**: one source of truth prevents drift and makes rebrand/logo swap a
  single-file change; dark-only halves the visual QA surface while centralized tokens
  keep a future light theme cheap.
- **Alternatives considered**: per-component inline styles (drift, expensive rebrand);
  CSS-in-JS/theming library (runtime + dependency cost unwarranted for one fixed
  theme); user-selectable themes now (explicitly out of MVP scope).

## Resolved unknowns summary

| Area | Resolution |
|------|-----------|
| PHP isolation mechanism | Docker CLI subprocess, stdin delivery, hard limits (D1–D4) |
| Health checking | Typed probe chain with remedies (D5) |
| HTTP engine | Rust reqwest command, cancellable, capped (D6) |
| Editor | CodeMirror 6 (D7) |
| Markdown safety | react-markdown + sanitize (D8) |
| State / testing | Zustand; Vitest+RTL; cargo test + gated integration (D9–D11) |
| IPC typing | Mirrored types + fixture tests (D12) |
| Persistence | Atomic pretty JSON + mtime conflicts; recents in app-data (D13–D14) |
| Capability surface | Dialog plugin only; all I/O via Rust commands (D15) |
| Secrets | Pure TS interpolation, Rust log redaction, UI masking (D16) |
| Brand/theme | Centralized `appIdentity` + `tokens`, dark-only MVP, placeholder LogoMark (D17) |
