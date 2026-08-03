# Data Model: PHP Notebook Editor — Phase 1 MVP

**Date**: 2026-08-03
**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)
**File contract**: [contracts/notebook-file.schema.json](./contracts/notebook-file.schema.json)

Naming: all persisted and IPC-transferred JSON uses camelCase. Rust structs mirror via
`#[serde(rename_all = "camelCase")]`; TS types in `src/types/notebook.ts` mirror 1:1.

## Notebook (aggregate root — one `.pnb.json` file)

| Field | Type | Rules |
|-------|------|-------|
| `schemaVersion` | integer | Required. Phase 1 writes `1`. Readers MUST reject `> 1` with `VersionUnsupported` (FR-006) without modifying the file. |
| `title` | string | Required, 1–200 chars. Defaults to file stem on create. |
| `cells` | Cell[] | Required, may be empty. Order in array IS document order (FR-011). |
| `envVars` | EnvVar[] | Required, may be empty. Names unique (case-sensitive). |

Invariants:
- Cell `id`s unique within a notebook.
- Unknown top-level fields at `schemaVersion: 1` MUST be preserved on load→edit→save
  round-trip and are never fatal on read (forward-tolerance within the same major
  version). Mechanism: the Rust model carries
  `#[serde(flatten)] extra: serde_json::Map<String, serde_json::Value>`; the TS
  `Notebook` type carries an index signature (`[key: string]: unknown`) and the store
  passes unknown fields through untouched. Applies to unknown **top-level** fields
  only — unknown fields nested inside known structures are not guaranteed.
- Parse failure of file content → `InvalidNotebook` error carrying a human-readable
  reason (FR-007); the source file is never rewritten by a failed load.

## Cell (discriminated union on `type`)

Common fields:

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Required. ULID/UUID string generated on cell creation. |
| `type` | `"markdown"` \| `"php"` \| `"http"` | Required discriminator. |

### MarkdownCell (`type: "markdown"`)

| Field | Type | Rules |
|-------|------|-------|
| `source` | string | Required, may be empty. Rendered preview is sanitized (FR-012). |

### PhpCell (`type: "php"`)

| Field | Type | Rules |
|-------|------|-------|
| `source` | string | Required, may be empty. |
| `lastRun` | PhpRunResult \| null | Latest terminal result; persisted with the notebook (spec assumption). |

### HttpCell (`type: "http"`)

| Field | Type | Rules |
|-------|------|-------|
| `request` | HttpRequestSpec | Required. |
| `lastRun` | HttpRunResult \| null | Latest terminal result; persisted. |

## HttpRequestSpec

| Field | Type | Rules |
|-------|------|-------|
| `method` | `"GET"`\|`"POST"`\|`"PUT"`\|`"PATCH"`\|`"DELETE"` | Required (FR-019). |
| `url` | string | Required. May contain `{{name}}` placeholders; validated as URL only after interpolation. |
| `headers` | { `name`: string, `value`: string }[] | Ordered list (duplicates legal per HTTP). Placeholder-capable. |
| `body` | string | Raw text body; placeholder-capable. Ignored for GET unless user sets it explicitly. |
| `timeoutMs` | integer | Optional; default 30000; 1000–300000. |

## EnvVar

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Required. `^[A-Za-z_][A-Za-z0-9_]*$`; unique per notebook (FR-014). |
| `value` | string | Required, may be empty. Stored in the notebook file (spec assumption). |
| `secret` | boolean | Required. `true` → masked in UI by default (FR-015), never logged (FR-018). |

Interpolation: `{{name}}` tokens in HTTP `url`, `headers[].value`, `headers[].name`,
`body` resolve against `envVars` at run time (FR-016). Unresolved token → blocking
warning naming the placeholder before send (FR-017). No recursion (values are not
re-scanned for placeholders).

## Execution results

### Run state machine (runtime-only, per runnable cell)

```
idle ──run──▶ running ──▶ succeeded
                      ├──▶ failed        (non-zero exit / HTTP transport error)
                      ├──▶ terminated    (killed at time/memory limit — PHP only)
                      └──▶ cancelled     (user cancel)
```

- `running` is never persisted; only terminal states are saved as `lastRun` (FR-032
  covers live display; persistence covers reopened notebooks).
- One active run per cell; run controls disabled while `running`.

### PhpRunResult

| Field | Type | Rules |
|-------|------|-------|
| `status` | `"succeeded"`\|`"failed"`\|`"terminated"`\|`"cancelled"` | Required. |
| `stdout` | string | Possibly truncated (see `truncated`). |
| `stderr` | string | Possibly truncated. Displayed distinctly (FR-027). |
| `exitCode` | integer \| null | Null when terminated/cancelled before exit. |
| `terminationReason` | `"timeout"`\|`"memory"`\| null | Set iff `status = "terminated"` (FR-028). |
| `truncated` | boolean | True if any stream was cut at the display cap (FR-025 analog). |
| `durationMs` | integer | Wall-clock, measured by the Rust supervisor. |
| `ranAt` | string | ISO 8601 timestamp. |

### HttpRunResult

| Field | Type | Rules |
|-------|------|-------|
| `status` | `"succeeded"`\|`"failed"`\|`"cancelled"` | `succeeded` = a response arrived (any HTTP status code, including 4xx/5xx — FR-021 distinguishes transport failure from HTTP error status). |
| `response` | HttpResponseSummary \| null | Present iff a response arrived. |
| `error` | { `kind`: `"network"`\|`"timeout"`\|`"invalidRequest"`\|`"cancelled"`, `message`: string } \| null | Present iff no usable response (FR-021/FR-023). |
| `durationMs` | integer | Request start → completion/failure. |
| `ranAt` | string | ISO 8601 timestamp. |

### HttpResponseSummary

| Field | Type | Rules |
|-------|------|-------|
| `statusCode` | integer | e.g. 200, 404. UI styles 4xx/5xx as HTTP-level errors. |
| `headers` | { `name`, `value` }[] | Response headers as received. |
| `body` | string | Text-decoded; capped at display limit (2 MB) with `bodyTruncated` flag (FR-025). Binary bodies summarized as size + content type. |
| `bodyTruncated` | boolean | |

## RuntimeHealth (not persisted)

| Field | Type | Rules |
|-------|------|-------|
| `status` | `"ok"`\|`"dockerNotInstalled"`\|`"daemonNotRunning"`\|`"imageMissing"` | Probe chain result (research D5). |
| `detail` | string | Human-readable specifics (FR-029). |
| `remedy` | string | Actionable next step; `imageMissing` pairs with in-app pull action. |

## RecentEntry (app-local, `recents.json` in app data dir — not in notebooks)

| Field | Type | Rules |
|-------|------|-------|
| `path` | string | Absolute path to a `.pnb.json` file. Unique key. |
| `title` | string | Notebook title at last open/save. |
| `lastOpenedAt` | string | ISO 8601. List sorted descending; capped at 20 entries. |

Missing file at open time → informative error + offer to remove entry (FR-005); entry
removal only on user confirmation.

## Document/session state (frontend only, never persisted)

- `dirty: boolean` — set on any mutation of notebook fields; cleared on successful
  save; drives unsaved-changes indicator and close/open confirmation (FR-004).
- `fileMtime` — mtime returned by load/save; sent back on save for conflict detection
  (research D13; external-change edge case).
- Per-cell `runState` — the state machine above; `runId` handle while running for
  cancellation.
