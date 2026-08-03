# Feature Specification: PHP Notebook Editor — Phase 1 MVP

**Feature Branch**: `001-notebook-mvp`

**Created**: 2026-08-03

**Status**: Draft

**Input**: User description: "Build the Phase 1 MVP for a local-first desktop PHP Notebook Editor. Users can create/open/save .pnb.json notebooks, add Markdown/PHP/HTTP cells, edit/delete/reorder cells, manage notebook environment variables, run HTTP request cells, and later run PHP cells through Docker. Focus on what users need and why, not implementation details."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create, Save, and Reopen Notebooks (Priority: P1)

A PHP developer wants a durable place to keep an experiment or learning session. They create a new notebook, give it a name and location on their machine, work in it, save it, close the app, and later reopen the same notebook with everything intact. Recently used notebooks are one click away.

**Why this priority**: Without reliable local files there is no product. Every other capability builds on being able to create, persist, and reopen a notebook. It also delivers standalone value immediately: a structured, local document for developer notes.

**Independent Test**: Can be fully tested by creating a notebook, saving it, closing and relaunching the app, and reopening the notebook from the recent list — content and structure must match exactly what was saved.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user creates a new notebook and chooses a name/location, **Then** a new `.pnb.json` file exists at that location and the notebook opens for editing.
2. **Given** a notebook with unsaved changes, **When** the user saves, **Then** the file on disk reflects the current content and the unsaved-changes indicator clears.
3. **Given** a previously saved notebook, **When** the user reopens it (via file picker or recent list), **Then** all content appears exactly as last saved.
4. **Given** a notebook with unsaved changes, **When** the user attempts to close it or open another notebook, **Then** the app asks for confirmation before discarding changes.
5. **Given** a recent-list entry whose file was moved or deleted outside the app, **When** the user clicks it, **Then** the app explains the file is missing and offers to remove the entry — it does not crash.
6. **Given** a file that is not a valid notebook (corrupted or wrong format), **When** the user tries to open it, **Then** the app shows a clear, actionable error and leaves the file untouched.

---

### User Story 2 - Compose Notebooks from Cells (Priority: P2)

A developer structures their notebook as an ordered list of cells: Markdown cells for explanation, PHP cells for code snippets, and HTTP cells for API calls. They add cells of any type at any position, edit them, delete ones they no longer need, and reorder them so the document reads top-to-bottom as a coherent narrative.

**Why this priority**: Cells are the core authoring model. Even before anything is runnable, a mixed-cell notebook is a useful executable-documentation draft: tutorials, debugging playbooks, API notes.

**Independent Test**: Can be fully tested by building a notebook with all three cell types, editing, deleting, and reordering them, saving, and reopening — the cell sequence and contents must persist exactly.

**Acceptance Scenarios**:

1. **Given** an open notebook, **When** the user adds a cell and picks a type (Markdown, PHP, HTTP), **Then** the new cell appears at the chosen position ready to edit.
2. **Given** a Markdown cell, **When** the user toggles preview, **Then** the rendered view reflects the source text; switching back returns to editing.
3. **Given** any cell, **When** the user deletes it, **Then** the app asks for confirmation and, on confirm, removes the cell.
4. **Given** a notebook with several cells, **When** the user moves a cell up or down, **Then** the order updates immediately and persists on save.
5. **Given** a notebook containing all three cell types, **When** the user saves and reopens it, **Then** every cell's type, content, and position is preserved.

---

### User Story 3 - Run HTTP Request Cells (Priority: P3)

A developer testing a local API adds an HTTP cell, sets the method and URL, optionally adds headers and a body, and runs it. They see the response status, headers, body, and how long the request took — all inside the notebook, next to their notes.

**Why this priority**: First "live" capability. It replaces switching to a separate API client for quick checks and makes the notebook genuinely interactive, independent of any PHP runtime setup.

**Independent Test**: Can be fully tested by pointing an HTTP cell at a known endpoint, running it, and verifying the displayed status, headers, body, and timing; error paths tested with an unreachable host.

**Acceptance Scenarios**:

1. **Given** an HTTP cell with method and URL set, **When** the user runs it, **Then** the cell shows a running state and, on completion, the response status, headers, body, and duration.
2. **Given** a request to an unreachable or invalid destination, **When** the run fails, **Then** the cell shows a clear failure message that distinguishes network failure from an HTTP error status returned by a server.
3. **Given** a running request, **When** the user cancels it, **Then** the request stops and the cell shows it was cancelled.
4. **Given** a request that exceeds the timeout, **When** the timeout elapses, **Then** the run terminates and the cell reports the timeout explicitly.
5. **Given** a very large response body, **When** results display, **Then** the visible output is capped with a clear indication that it was truncated.

---

### User Story 4 - Manage Notebook Environment Variables (Priority: P4)

A developer defines variables like `base_url` or `token` once per notebook, then references them in HTTP cells as `{{base_url}}`. Values marked as secret are masked on screen. Changing a variable updates every cell that references it on its next run.

**Why this priority**: Makes HTTP cells reusable and shareable-safe. Depends on HTTP cells existing (P3) to deliver visible value, hence sequenced after.

**Independent Test**: Can be fully tested by defining variables, referencing them in an HTTP cell, running it against a local endpoint that echoes the request, and confirming substitution; masking verified visually.

**Acceptance Scenarios**:

1. **Given** an open notebook, **When** the user adds, edits, or deletes an environment variable, **Then** the variable panel reflects the change and it persists with the notebook.
2. **Given** a variable referenced as `{{name}}` in an HTTP cell's URL, headers, or body, **When** the cell runs, **Then** the placeholder is replaced with the current value.
3. **Given** a variable marked as secret, **When** it is displayed anywhere in the app, **Then** its value is masked by default with an explicit action required to reveal it.
4. **Given** an HTTP cell referencing an undefined variable, **When** the user runs it, **Then** the app warns which placeholder is unresolved instead of silently sending a wrong request.

---

### User Story 5 - Run PHP Cells in an Isolated Runtime (Priority: P5)

A developer writes a PHP snippet in a cell and runs it. The code executes in an isolated sandbox on their machine — never inside the app itself — and the cell shows printed output, errors, and how long execution took. Before running, the app checks the sandbox runtime is available and, if not, explains exactly what is missing and how to fix it.

**Why this priority**: The flagship capability, sequenced last because it depends on an external runtime prerequisite on the user's machine and on the notebook/cell foundation (P1–P2). All earlier stories ship value without it.

**Independent Test**: Can be fully tested by running a snippet that prints output, one that raises an error, and one that loops forever — verifying output display, error display, and forced termination at the time limit; health-check path tested with the runtime stopped.

**Acceptance Scenarios**:

1. **Given** the sandbox runtime is available and a PHP cell contains code that prints output, **When** the user runs it, **Then** the cell shows a running state, then the printed output and execution duration.
2. **Given** code that produces an error, **When** the cell runs, **Then** the error output is displayed distinctly from normal output and marked as a failed run.
3. **Given** code that runs longer than the time limit or exceeds the memory limit, **When** the limit is hit, **Then** execution is terminated and the cell explicitly reports termination by limit — the app stays responsive throughout.
4. **Given** the sandbox runtime is not installed or not running, **When** the user tries to run a PHP cell, **Then** the app reports the specific problem and what to do about it, before any execution attempt.
5. **Given** the runtime is unavailable, **When** the user authors and saves PHP cells, **Then** authoring and saving work normally — only running is blocked.

---

### Edge Cases

- Notebook file is corrupted or not valid notebook content → clear, actionable error; the file is never modified or overwritten by the failed open.
- Notebook file was created by a newer app version (unknown format version) → app declines to open it with an explanatory message rather than guessing and corrupting data.
- Notebook file is moved, renamed, or deleted outside the app while open → saving falls back to save-as with an explanation.
- File on disk changed by another program since it was opened → app warns before overwriting.
- Cell produces extremely large output (PHP or HTTP) → display is truncated with an indicator; app stays responsive.
- Runaway PHP code (infinite loop, memory exhaustion) → terminated at limits, reported as such, machine and app unaffected.
- Sandbox runtime missing, stopped, or unhealthy → specific pre-run guidance per failure mode, not a generic error.
- HTTP request while offline → network failure reported clearly; the rest of the app remains fully usable.
- Reordering at boundaries (moving first cell up, last cell down) → no-op, no error, no data loss.
- Empty notebook (zero cells) → saves, closes, and reopens without issue.
- Secret variable values → never shown unmasked without explicit user action, never present in application logs.
- Deleting a variable still referenced by cells → allowed; affected cells warn about the unresolved placeholder on next run.

## Requirements *(mandatory)*

### Functional Requirements

**Notebook lifecycle**

- **FR-001**: System MUST let users create a new notebook, choosing its name and location on their machine, producing a `.pnb.json` file.
- **FR-002**: System MUST let users open existing notebook files via a file picker and via a recent-notebooks list.
- **FR-003**: System MUST let users save the open notebook to its file, and save a copy to a new location (save-as).
- **FR-004**: System MUST visibly indicate unsaved changes and MUST ask for confirmation before any action that would discard them (close notebook, open another, quit).
- **FR-005**: System MUST maintain a recent-notebooks list, and MUST handle entries whose files no longer exist by informing the user and offering to remove the entry.
- **FR-006**: Notebook files MUST be human-readable and carry a format version; the system MUST refuse to open files with an unknown newer version, with a clear message, without altering the file.
- **FR-007**: System MUST reject invalid or corrupted notebook files with an actionable error and without crashing or modifying the file.

**Cell authoring**

- **FR-008**: Users MUST be able to add cells of type Markdown, PHP, or HTTP request at any position in the notebook.
- **FR-009**: Users MUST be able to edit the content of any cell.
- **FR-010**: Users MUST be able to delete any cell, with confirmation before removal.
- **FR-011**: Users MUST be able to reorder cells; the new order is reflected immediately and persists on save.
- **FR-012**: Markdown cells MUST offer an edit view and a rendered preview; rendered content MUST be sanitized so notebook content cannot execute anything inside the app.
- **FR-013**: Saving MUST persist every cell's type, content, and position plus notebook environment variables; reopening MUST restore them exactly.

**Environment variables**

- **FR-014**: Users MUST be able to define, edit, and delete named variables scoped to the notebook.
- **FR-015**: Users MUST be able to mark a variable as secret; secret values MUST be masked in the interface by default and revealed only by explicit user action.
- **FR-016**: HTTP cells MUST support `{{name}}` placeholders in URL, headers, and body, resolved against notebook variables at run time.
- **FR-017**: Running a cell that references an undefined variable MUST produce a warning naming the unresolved placeholder.
- **FR-018**: Secret values MUST never appear in application logs or error reports.

**HTTP request cells**

- **FR-019**: HTTP cells MUST support at least GET, POST, PUT, PATCH, and DELETE, with editable URL, headers, and request body.
- **FR-020**: Running an HTTP cell MUST display response status, headers, body, and total duration.
- **FR-021**: Failures MUST be reported clearly, distinguishing network-level failure (unreachable, name resolution, timeout) from an HTTP error status returned by a server.
- **FR-022**: A running request MUST be visibly in progress and cancellable by the user.
- **FR-023**: HTTP requests MUST have a timeout (default 30 seconds); on expiry the run terminates and reports the timeout.
- **FR-024**: Response content MUST be treated strictly as data for display — never executed or rendered as live content.
- **FR-025**: Oversized outputs from any runnable cell (HTTP responses and PHP output streams alike) MUST be truncated in the display with a clear truncation indicator.

**PHP execution**

- **FR-026**: PHP cell code MUST execute only inside an isolated sandbox runtime on the user's machine — never inside the app's own processes.
- **FR-027**: A PHP run MUST display printed output, error output, failure state, and execution duration.
- **FR-028**: Every PHP run MUST be subject to a time limit and a memory limit; exceeding either terminates the run and reports the termination cause.
- **FR-029**: Before executing, the system MUST verify the sandbox runtime is available and healthy; if not, it MUST tell the user the specific problem and remedy.
- **FR-030**: Authoring, saving, and reopening PHP cells MUST work fully even when the sandbox runtime is unavailable.
- **FR-031**: Sandboxed execution MUST NOT access the user's files by default, and its network access MUST be restricted by default.

**General experience**

- **FR-032**: Every runnable cell MUST always show its execution state: idle, running, succeeded, or failed, including duration for completed runs.
- **FR-033**: The app MUST be fully usable offline except for actions that inherently need a network (sending HTTP requests, first-time runtime setup).
- **FR-034**: Every user action MUST yield visible feedback — success, failure, or progress; no silent failures.

### Key Entities

- **Notebook**: A single local document owned by the user; has a title, a format version, an ordered list of cells, and a set of environment variables. Stored as one human-readable `.pnb.json` file.
- **Cell**: One block within a notebook; has a type (Markdown, PHP, or HTTP request), content, and a position. Runnable cells also carry their latest execution result.
- **Markdown Cell**: Explanatory text; editable source with rendered preview.
- **PHP Cell**: A PHP snippet plus its latest run outcome (output, errors, duration, termination cause if any).
- **HTTP Request Cell**: Method, URL, headers, and body (all placeholder-capable) plus its latest response summary (status, headers, body, duration) or failure detail.
- **Environment Variable**: A named value scoped to one notebook; may be flagged secret, which controls masking.
- **Execution Result**: The outcome of one run of a runnable cell: state, outputs, duration, and error/termination details. The latest result is part of the notebook's saved content.
- **Recent Notebook Entry**: A pointer to a previously opened notebook file (name, path, last-opened time) kept by the app outside any notebook.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can create a notebook containing all three cell types and save it in under 3 minutes without consulting documentation.
- **SC-002**: 100% of notebook content — cell types, contents, order, environment variables — survives a save/close/reopen round trip exactly.
- **SC-003**: After an HTTP response arrives, its results are visible in the cell within 1 second.
- **SC-004**: The execution state of every runnable cell is determinable at a glance at all times (idle, running, succeeded, failed).
- **SC-005**: 100% of runaway PHP executions (infinite loop, memory exhaustion) are terminated at the configured limits with the termination cause reported, while the app remains responsive.
- **SC-006**: Notebook files remain readable and meaningfully diffable in a plain text editor.
- **SC-007**: When the sandbox runtime is unavailable, 100% of PHP run attempts produce a specific explanation and remedy rather than a generic failure.
- **SC-008**: At least 90% of users complete the core flow — create notebook, add a cell, run an HTTP request — on their first attempt without external help.
- **SC-009**: Zero occurrences of secret values displayed unmasked without explicit user action, and zero occurrences in application logs. Scope: environment-variable displays, stored-value views, and application logs — a value the user explicitly sends to an external server may reappear in that server's response body, which is displayed as received.

## Assumptions

- Single local user per machine; no accounts, sign-in, sharing, or collaboration in Phase 1.
- PHP execution depends on a user-installed container runtime (e.g., Docker Desktop) as an external prerequisite; the app checks for it and guides the user but does not install it. All other features work without it.
- The five user stories are sequenced so each ships value independently; PHP execution (P5) lands last within Phase 1.
- HTTP request cells inherently require network access to their targets; everything else works fully offline.
- One execution at a time per cell; the app stays responsive during any run.
- HTTP timeout is adjustable per request in Phase 1, with an allowed range of 1–300 seconds (default 30 seconds). PHP execution limits use fixed MVP defaults (30-second time limit, bounded memory); contracts may accept overrides for tests and future configuration, but PHP limits are not user-adjustable in Phase 1.
- Environment variable values are stored inside the notebook file; entering a value there is the user's explicit choice. Secret-flagged values are masked in the UI but stored with the notebook — keeping actual secrets out of shared files is the user's responsibility in Phase 1.
- The latest execution result of each runnable cell is saved with the notebook so reopened notebooks show their last-known outputs.
- Out of scope for Phase 1 (per project charter): cloud sync, real-time collaboration, AI assistance, full IDE/API-client replacement, advanced debugging, auto-updates, marketplace distribution.
