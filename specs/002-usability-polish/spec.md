# Feature Specification: Phase 2 — Usability Polish & Output Intelligence (first slice)

**Status**: DRAFT — planning only; no implementation authorized yet
**Created**: 2026-08-05
**Input**: Phase 1 MVP ([specs/001-notebook-mvp](../001-notebook-mvp/spec.md), shipped as
`v0.1.0-alpha.1`) + the Output Intelligence track ([docs/roadmap.md](../../docs/roadmap.md))

Phase 1 delivered durable notebooks, authorable cells, HTTP execution with env-var
interpolation, and sandboxed PHP. Outputs, however, are raw text dumps, runtime setup
is minimal, and the single example notebook undersells the product. Phase 2 makes the
existing features *pleasant*: a rich HTTP result viewer with a JSON tree, copy/export
actions, a friendlier runtime setup path, and a real example library. It deliberately
implements only the Phase 2 slice of the Output Intelligence track — no Phase 3/4
items.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rich HTTP Result Viewer (Priority: P1)

A developer runs an HTTP cell and immediately understands what happened: a metadata
summary shows status, method, the authored URL, duration, response size, content
type, and when the run happened. HTTP error statuses read differently from transport
failures, and common error codes carry a one-line friendly explanation.

**Why this priority**: Every other Phase 2 feature renders inside this surface; it is
the foundation slice and delivers standalone value.

**Independent Test**: Run cells against httpbin (200, 404, 500, delayed, unreachable
host) and verify the summary fields, the status-vs-transport distinction, and the
explanation line — with the raw body still fully visible.

**Acceptance Scenarios**:

1. **Given** a completed run, **When** the result renders, **Then** the summary shows
   status code, method, authored URL (placeholders as written, never resolved
   secrets), duration, body size, content type, and run timestamp.
2. **Given** a 404/422/500 response, **When** the result renders, **Then** a short
   friendly explanation appears alongside — never replacing — the status and body.
3. **Given** a transport failure, **When** the result renders, **Then** it remains
   visually and textually distinct from any HTTP status result (carries FR-021).

---

### User Story 2 - Response View Modes & JSON Tree (Priority: P2)

A developer switches between Tree, Pretty, Raw, and Headers views of a response. JSON
bodies render as a collapsible tree with type-colored values, key counts, array
lengths, indentation guides, and expand/collapse-all. Raw stays one click away at all
times.

**Why this priority**: The core differentiator of the Output Intelligence track;
depends on the US1 viewer shell.

**Independent Test**: Run JSON, plain-text, HTML, and binary responses; verify smart
default view per content type, tree interactions, graceful fallbacks, and byte-exact
raw view.

**Acceptance Scenarios**:

1. **Given** a valid JSON response, **When** it renders, **Then** the Tree view is the
   default, nodes collapse/expand (with key counts and array lengths when collapsed),
   and expand-all/collapse-all work.
2. **Given** any response, **When** the user selects Raw, **Then** the body shows
   exactly as received (within the existing 2 MB cap and truncation flag).
3. **Given** a JSON-labelled response that fails to parse, **When** it renders,
   **Then** the viewer falls back to Raw with a non-blocking notice.
4. **Given** an HTML response, **When** it renders, **Then** only source text is
   shown — never rendered or executed markup.
5. **Given** a large deeply-nested JSON body, **When** the tree renders, **Then** the
   UI stays responsive (guarded initial depth / lazy expansion).

---

### User Story 3 - Copy & Export Actions (Priority: P3)

A developer copies exactly the piece of a response they need: raw body, pretty
JSON, headers, a one-line summary, a selected tree node's value or subtree — or the
whole JSON body converted to a PHP array literal ready to paste into code.

**Why this priority**: Turns inspection into workflow value; depends on US1/US2
surfaces.

**Independent Test**: Each copy action puts the documented shape on the clipboard;
copy-as-PHP-array output parses under `php -l`; nothing mutates the notebook.

**Acceptance Scenarios**:

1. **Given** a completed run, **When** the user copies raw body / pretty JSON /
   headers / summary, **Then** the clipboard holds exactly that content.
2. **Given** a valid JSON body, **When** the user chooses "Copy as PHP array",
   **Then** the clipboard holds a valid PHP array literal (short syntax) that `php -l`
   accepts.
3. **Given** a selected tree node, **When** the user copies its value or subtree,
   **Then** only that fragment is copied.
4. **Given** any copy action, **When** it completes, **Then** the notebook document
   and file are unchanged and nothing is logged.

---

### User Story 4 - Guided Runtime Setup (Priority: P4)

A first-time user without Docker (or without the PHP image) sees where they stand
right from the Home screen, gets one specific next step, can open the Docker download
page in their browser, watches the image pull with progress feedback, and lands in a
healthy state without reading docs.

**Why this priority**: Highest-friction moment of the product; independent of the
viewer track.

**Independent Test**: With Docker stopped → Home and notebook both show the specific
state and remedy; starting Docker + re-check transitions correctly; pulling shows
progress and ends healthy (SC-007 carries over).

**Acceptance Scenarios**:

1. **Given** any unhealthy runtime state, **When** the user is on the Home screen,
   **Then** a status card shows the same detail/remedy the notebook banner shows.
2. **Given** `dockerNotInstalled`, **When** the user clicks the remedy action,
   **Then** the Docker Desktop download page opens in the default browser.
3. **Given** `imageMissing`, **When** the user pulls in-app, **Then** visible
   progress feedback appears (staged at minimum, streamed when feasible) and success
   re-probes to healthy.
4. **Given** the runtime becomes available while the app is open, **When** the user
   re-checks (or refocuses the window), **Then** the healthy state appears without a
   restart.

---

### User Story 5 - Example Notebook Library (Priority: P5)

A new user opens a bundled example straight from the Home screen — a welcome tour, an
API-testing notebook showing env vars and a masked secret, and a PHP tour showing
output, errors, and sandbox limits — each opening as a copy so the originals stay
pristine.

**Why this priority**: Cheap onboarding value; depends only on Home screen touch
points.

**Independent Test**: Each example validates against the v1 schema, opens from Home
via the open-a-copy flow, and every cell runs successfully (given a healthy runtime).

**Acceptance Scenarios**:

1. **Given** the Home screen, **When** the user picks an example, **Then** a save
   dialog creates their own copy which opens as a normal notebook.
2. **Given** the api-testing example, **When** it opens, **Then** it demonstrates
   `{{name}}` interpolation and a secret-flagged variable holding a placeholder value
   only — no real secrets ship in examples.
3. **Given** any example, **When** its cells run against a healthy runtime, **Then**
   they succeed (or demonstrate their intended failure, e.g. the sandbox network
   block).

---

### Edge Cases

- Binary body: Tree/Pretty disabled with a note; Raw shows the existing size +
  content-type summary; copy raw body copies what was captured.
- Empty body: all views render an explicit "(empty body)" state; copy actions for the
  body are disabled.
- JSON deeper than the guard depth: nodes beyond it load on expand; expand-all warns
  or clamps above a node-count threshold instead of freezing.
- JSON beyond the hard safety limits (depth or total node count): Tree is not
  attempted at all — Pretty/Raw fallback with a clear message (FR-208).
- Scalar-only JSON body (`"ok"`, `42`, `true`): Tree/Pretty render it, but "Copy as
  PHP array" stays unavailable (FR-212 covers objects/arrays only).
- Clipboard write fails (webview denies): a dialog shows the content selectable for
  manual copy; the failure is not logged with the content.
- Huge single-line JSON (minified 2 MB): Pretty and Tree stay responsive or fall back
  with a notice; Raw always renders.
- `pull` interrupted mid-download: state returns to `imageMissing` with a retry
  remedy; partial layers are Docker's concern, not ours.
- Example save dialog cancelled: nothing opens, nothing is created.

## Requirements *(mandatory)*

### Functional Requirements

Result viewer:

- **FR-201**: HTTP results MUST show a metadata summary: status code, method,
  authored URL (as written, placeholders unresolved), duration, response body size,
  content type, and run timestamp.
- **FR-202**: The transport-failure vs HTTP-error-status distinction (Phase 1 FR-021)
  MUST hold in every view and in copied summaries.
- **FR-203**: Common HTTP error statuses MUST show a one-line friendly explanation
  that never replaces the raw status or body. Explanations are static, deterministic
  copy authored in the app, keyed only on the status code or transport error kind —
  never AI-generated, and never derived from inspecting or transmitting the response
  body.

View modes:

- **FR-204**: Users MUST be able to switch between Tree, Pretty, Raw, and Headers
  views; Raw MUST always be available for every response.
- **FR-205**: View mode is runtime UI state only — the default derives from content
  type (JSON → Tree, otherwise Raw) and the choice is NOT persisted in the notebook
  file (no schema change in this phase).

JSON tree:

- **FR-206**: Valid JSON bodies MUST render as a collapsible tree with per-node key
  counts / array lengths when collapsed, plus expand-all and collapse-all.
- **FR-207**: Tree values MUST be visually typed (string/number/boolean/null/object/
  array) using theme tokens only, with indentation guides.
- **FR-208**: Trees over large or deep bodies MUST stay responsive via hard depth
  limits, node-count guards, lazy expansion, and an expand-all clamp. When parsed
  JSON exceeds the safe limits, the viewer MUST fall back to Pretty/Raw with a clear
  message — the UI never freezes attempting to render the tree.
- **FR-209**: A body that fails JSON parsing MUST fall back to Raw with a
  non-blocking notice — never an error state that hides the response.

Copy/export:

- **FR-210**: Users MUST be able to copy: raw body, pretty-printed JSON, headers (as
  `Name: value` lines), and a one-line response summary. Every copy happens only on
  explicit user action — the app never auto-copies — and copies exactly what the
  action names: no silent redaction, truncation, or transformation unless the action
  label says so (e.g. "Copy as PHP array" is the transformation).
- **FR-211**: In the Tree view, users MUST be able to copy a selected node's value or
  its subtree as JSON.
- **FR-212**: For valid JSON **object or array** bodies — or a selected JSON
  object/array tree node — users MUST be able to copy the value as a PHP array
  literal (short array syntax, correctly escaped) that parses under `php -l`. The
  action MUST be unavailable (disabled, with the reason shown) for plain text, HTML,
  binary, invalid JSON, scalar-only bodies, and transport errors.
- **FR-213**: Copy/export actions MUST NOT mutate the notebook document or file.
- **FR-214**: Copy/export actions MUST NOT log the copied content (logging policy).

Runtime setup:

- **FR-215**: Runtime health MUST be visible from the Home screen, not only inside a
  notebook.
- **FR-216**: The in-app image pull MUST show progress feedback — staged status at
  minimum, streamed progress where feasible.
- **FR-217**: Remedies MUST be actionable in-app where possible: open the Docker
  download page via the opener plugin, one-click re-check, and automatic re-probe
  after a successful pull. Guidance stops at linking and explaining — Phase 2 does
  NOT implement any Docker installer, updater, or daemon management.
- **FR-218**: Setup guidance MUST distinguish a first-run experience (nothing
  installed yet) from a degraded one (was healthy, now isn't).

Examples:

- **FR-219**: At least three bundled examples MUST exist (welcome tour, API testing,
  PHP tour), each valid against the v1 notebook schema.
- **FR-220**: Examples MUST be openable from the Home screen through an open-a-copy
  flow (save dialog → user-owned file); bundled originals are never written to.
- **FR-221**: Examples MUST target safe public endpoints (e.g. httpbin.org), local
  endpoints, or `{{placeholder}}` URLs only — never real tokens, private URLs, or
  credentials. Example env vars MUST contain placeholder values only; secret-flagged
  examples ship with dummy values and a note to replace them.

### Key Entities

- **ResponseMeta** (derived, never persisted): size, parsed content type, JSON
  validity — computed from the existing `HttpResponseSummary`.
- **JsonTreeNode** (derived, never persisted): typed node model built from a parsed
  body; drives Tree view and node-level copy.
- No notebook file schema changes in this phase. No IPC contract shape changes except
  an optional additive pull-progress event channel (see plan).

## Success Criteria *(mandatory)*

- **SC-201**: A 2 MB JSON body reaches an interactive Tree within 1 s of parse
  completion on the reference dev machine; scrolling and node toggling stay
  responsive.
- **SC-202**: Raw view output is byte-identical to the captured body for every
  fixture (within the Phase 1 2 MB cap and truncation flag).
- **SC-203**: Copy-as-PHP-array output for the representative JSON fixture set parses
  clean under `php -l` (verified inside the existing Docker sandbox in gated tests).
- **SC-204**: From each unhealthy runtime state, a user reaches a healthy state using
  only in-app guidance (no docs), with pull progress visible throughout.
- **SC-205**: All Phase 1 gates and tests stay green; Tauri capabilities gain at most
  a clipboard-write permission (if the spike proves the plugin necessary).
- **SC-206**: Zero secret values in logs or copied summaries across the Phase 2
  manual pass (SC-009 discipline carried forward; response bodies remain
  displayed/copied as received per the Phase 1 boundary).

## Scope Rules (binding)

- Raw output always remains available; rich previews never execute HTML/scripts
  (FR-024 carries over).
- Phase 3/4 Output Intelligence items are OUT: JSON path inspector, test snippet
  generation, save-value-as-env-var, fixtures, docs-cell conversion, output history,
  pinning, diffing, redaction, advanced previews.
- No Laravel project mode, no Composer, no host mounts, no network-enabled PHP, no
  cloud/AI/collaboration, no telemetry.
- No Docker installer/updater/daemon management — runtime setup guidance links and
  explains only.
- All viewer copy (explanations, notices, remedies) is static deterministic text
  shipped with the app; nothing is AI-generated and nothing inspects or transmits
  response bodies to produce it.
- Copying is always an explicit user action; the app never writes to the clipboard
  on its own, and Phase 2 copy actions never silently redact or transform beyond
  what the action name states.
- No notebook file schema changes; forward-tolerance rules unchanged.
- Logging policy unchanged: no bodies, no secrets, no PHP source/output, no notebook
  contents — and still effectively "nothing logs at all".

## Assumptions

- Phase 1 result caps (2 MB HTTP body, 1 MB PHP streams) stay authoritative; the
  viewer works within them.
- Clipboard mechanism is decided by a spike (T001): prefer `navigator.clipboard` in
  the webview; fall back to `tauri-plugin-clipboard-manager` with a write-only
  capability if needed — either way constitution-checked before adoption.
- Pull progress streaming is best-effort: if parsing `docker pull` output for
  streamed progress proves brittle, staged progress (starting → downloading →
  verifying → done) satisfies FR-216.
- PhpResultView keeps its Phase 1 presentation this phase; PHP output enhancements
  arrive with later Output Intelligence slices.
