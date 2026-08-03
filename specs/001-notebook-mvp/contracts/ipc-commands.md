# IPC Contract: Tauri Commands — Phase 1 MVP

**Source of truth** for the frontend↔backend boundary (Constitution Principle III).
Rust structs use `#[serde(rename_all = "camelCase")]`; TS mirrors live in `src/types/`
and `src/ipc/`. Both sides MUST have serialization tests against shared JSON fixtures
(`specs/001-notebook-mvp/contracts/fixtures/` once implementation starts).

Shared shapes (`Notebook`, `PhpRunResult`, `HttpRunResult`, `RuntimeHealth`,
`RecentEntry`, …) are defined in [data-model.md](../data-model.md) and
[notebook-file.schema.json](./notebook-file.schema.json).

## Conventions

- Commands return `Result<T, CommandError>`; a rejected `invoke` carries
  `CommandError` serialized as JSON.
- `CommandError = { code: ErrorCode, message: string }` — `message` is
  user-presentable, actionable, and MUST NOT contain secret values, request/response
  payloads, or cell code (FR-018).
- `ErrorCode` enum: `fileNotFound` | `io` | `invalidNotebook` | `versionUnsupported`
  | `conflictOnDisk` | `runtimeUnavailable` | `pullFailed` | `invalidInput`
  | `internal`.
- Expected run outcomes (HTTP transport failure, PHP non-zero exit, timeout,
  cancellation) are **not** command errors — they return successfully as
  `HttpRunResult` / `PhpRunResult` with the appropriate `status`. Command errors are
  reserved for infrastructure failure.
- Backend logging for run commands records at most: command name, method+host (HTTP),
  status, duration. Never headers, bodies, code, or env values.
- UI recovery may depend on which command produced an error: the frontend invoke layer
  preserves the originating command name on every thrown `CommandError`, and handlers
  branch on (command, code) — e.g. `fileNotFound` from `load_notebook` → informational
  missing-file flow; `fileNotFound` from `save_notebook` → Save As / Cancel fallback
  (§2).

## Commands

### 1. `load_notebook`

Load and validate a notebook file. Updates the recents list on success.

| | |
|---|---|
| Request | `{ path: string }` |
| Response | `{ notebook: Notebook, fileMtimeMs: number }` |
| Errors | `fileNotFound`, `invalidNotebook` (parse/shape failure, reason in message), `versionUnsupported` (schemaVersion > 1), `io` |

Guarantees: a failed load never modifies the file (FR-006/FR-007).

### 2. `save_notebook`

Atomically write a notebook file (temp file + rename). Updates recents on success.

| | |
|---|---|
| Request | `{ path: string, notebook: Notebook, expectedMtimeMs: number \| null }` |
| Response | `{ fileMtimeMs: number }` |
| Errors | `conflictOnDisk` (file mtime ≠ `expectedMtimeMs` — file changed externally; UI confirms overwrite by retrying with `expectedMtimeMs: null`), `fileNotFound` (`expectedMtimeMs` is non-null but no file exists at `path` — original deleted, moved, or renamed externally; this is NOT a normal save: the backend MUST NOT silently recreate the file, and the UI MUST offer Save As or Cancel), `io`, `invalidInput` |

Guarantees: pretty-printed (2-space), stable key order; no partial file on crash (D13).
`expectedMtimeMs: null` = intentional write to a fresh path (new file, save-as, or
user-confirmed overwrite) — a missing file is expected and created. A non-null
`expectedMtimeMs` asserts the original file still exists unchanged; both assertion
failures are typed distinctly (`fileNotFound` vs `conflictOnDisk`) so the UI can offer
the right recovery (Save As vs overwrite-confirm).

### 3. `list_recents`

| | |
|---|---|
| Request | `{}` |
| Response | `{ entries: RecentEntry[] }` (sorted by `lastOpenedAt` desc, ≤ 20) |
| Errors | `io` (corrupt recents store is self-healed to empty; `io` only for unreadable app-data dir) |

### 4. `remove_recent`

| | |
|---|---|
| Request | `{ path: string }` |
| Response | `{ entries: RecentEntry[] }` (updated list) |
| Errors | `io` |

### 5. `run_http`

Execute an HTTP request. Placeholders MUST already be resolved by the frontend
(`src/lib/interpolate.ts`) — the backend treats all fields literally (D16).

| | |
|---|---|
| Request | `{ runId: string, request: HttpRequestSpec }` (`timeoutMs` defaulted to 30000 if absent) |
| Response | `HttpRunResult` — `succeeded` means a response arrived, any status code; transport failures/timeout/cancel are `failed`/`cancelled` with `error.kind` set (FR-021/023) |
| Errors | `invalidInput` (unparseable URL, invalid header name), `internal` |

Guarantees: body captured up to 2 MB then truncated with `bodyTruncated: true`
(FR-025); response is returned as inert data only (FR-024); cancellable via
`cancel_run`.

### 6. `run_php`

Execute a PHP cell in the Docker sandbox (D1–D4). Never executes in-process
(Constitution Principle I).

| | |
|---|---|
| Request | `{ runId: string, code: string, timeoutMs: number \| null, memoryLimitMb: number \| null }` (defaults 30000 ms / 256 MB) |
| Response | `PhpRunResult` — non-zero exit → `failed`; killed at limit → `terminated` + `terminationReason`; user cancel → `cancelled` |
| Errors | `runtimeUnavailable` (health probe failed at run time — message carries the remedy), `internal` |

Guarantees: container flags per research D3 (`--network=none`, memory/cpu/pids caps,
`--cap-drop=ALL`, no mounts, code via stdin); streams captured up to 1 MB each then
truncated with `truncated: true`; container force-killed on timeout/cancel; no
container left behind (`--rm` + kill path verified).

### 7. `cancel_run`

Cancel an in-flight `run_http` or `run_php` by id.

| | |
|---|---|
| Request | `{ runId: string }` |
| Response | `{ cancelled: boolean }` (`false` = run already finished or unknown id — benign) |
| Errors | none (best-effort) |

### 8. `check_php_runtime`

Probe chain per research D5. Safe to call anytime; used on app start, before PHP runs,
and by the health banner.

| | |
|---|---|
| Request | `{}` |
| Response | `RuntimeHealth` (`ok` \| `dockerNotInstalled` \| `daemonNotRunning` \| `imageMissing`, each with `detail` + `remedy`) |
| Errors | `internal` |

### 9. `pull_php_image`

Pull the configured PHP image — a single backend-configured value (`PNB_PHP_IMAGE`
env override, else default `php:8.4-cli`); the health probes (§8) and `run_php` (§6)
use the same value. Future releases may pin the default image by digest for
reproducibility. Invoked from the `imageMissing` remedy action.

| | |
|---|---|
| Request | `{}` |
| Response | `RuntimeHealth` (fresh probe after pull) |
| Errors | `runtimeUnavailable` (daemon down), `pullFailed` (network/registry, message says so) |

## Frontend dialog usage (not commands)

Open/save file pickers come from `tauri-plugin-dialog` (`open`, `save`) in the
frontend; chosen paths are passed to `load_notebook`/`save_notebook`. The webview has
no filesystem capability (D15); required Tauri capabilities: core defaults +
`dialog:default` + existing `opener:default` only.

## Contract change policy

Any change to a request/response shape requires: update this document, update both
type mirrors, update shared fixtures, and note the change in the PR description
(Constitution Principle III + Governance).
