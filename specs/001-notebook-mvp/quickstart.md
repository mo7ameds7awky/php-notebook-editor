# Quickstart & Validation Guide: PHP Notebook Editor — Phase 1 MVP

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) ·
**Contracts**: [contracts/](./contracts/)

## Prerequisites

- [Bun](https://bun.sh/) ≥ 1.1
- [Rust](https://www.rust-lang.org/tools/install) stable + [Tauri prerequisites](https://tauri.app/start/prerequisites/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — only for PHP
  execution (User Story 5); everything else works without it

## Setup & run

```bash
bun install                # JS dependencies
bun run tauri dev          # launch desktop app (dev)
```

## Test commands

```bash
bun run test                            # frontend: Vitest unit/component tests
cd src-tauri && cargo test              # Rust unit tests (no Docker needed)
cd src-tauri && cargo test -- --ignored # Docker integration tests (Docker required)
cd src-tauri && cargo clippy            # lint gate (no new warnings)
bunx tsc --noEmit                       # type-check gate
```

All gates above must pass before merge (Constitution: Development Workflow).

## Manual validation scenarios

Run top-to-bottom for a full acceptance pass; each block is independently runnable and
maps to a spec user story.

### US1 — Notebooks: create / save / reopen (P1)

1. Launch app → create notebook → pick location/name. **Expect**: `.pnb.json` exists
   at that path; editor opens; title shown.
2. Type anything, note the unsaved-changes indicator → save. **Expect**: indicator
   clears; file content updates (open the file in a text editor — human-readable,
   pretty JSON).
3. Quit, relaunch → open via recent list. **Expect**: identical content.
4. With unsaved changes, try to close the notebook/window. **Expect**: confirmation
   prompt; cancel keeps everything.
5. Delete the file in Finder → click its recent entry. **Expect**: friendly "file
   missing" message + offer to remove entry; no crash.
6. Point open-dialog at a non-notebook JSON / corrupted file. **Expect**: actionable
   error; file untouched afterward.
7. Edit the file externally: set `"schemaVersion": 2` → open. **Expect**: "created by
   a newer version" message; file not modified.

### US2 — Cells: add / edit / delete / reorder (P2)

1. Add one cell of each type (Markdown, PHP, HTTP) at various positions. **Expect**:
   cells appear at chosen positions, editable immediately.
2. Markdown cell: write GFM (headings, table, code fence, a raw `<script>alert(1)</script>`)
   → toggle preview. **Expect**: rendered view correct; the script tag renders inert
   (sanitized), never executes.
3. Delete a cell. **Expect**: confirmation before removal.
4. Move first cell up / last cell down. **Expect**: no-op, no error. Move middle cells
   both directions. **Expect**: order updates immediately.
5. Save → reopen. **Expect**: cell types, contents, order identical (SC-002).

### US3 — HTTP request cells (P3)

Use any reachable endpoint; `https://httpbin.org` shown here (needs network).

1. HTTP cell: `GET https://httpbin.org/get` → run. **Expect**: running state visible →
   status 200, headers, body, duration shown in the cell.
2. `POST https://httpbin.org/post` with a JSON body + `Content-Type: application/json`
   header. **Expect**: echoed body visible in response.
3. `GET https://httpbin.org/status/500`. **Expect**: shown as an HTTP error status
   (500), visually distinct from transport failure — the run itself "succeeded".
4. `GET https://no-such-host.invalid`. **Expect**: network failure message (transport
   failure, not an HTTP status).
5. `GET https://httpbin.org/delay/10` with timeout set to 2 s. **Expect**: run ends at
   ~2 s reporting timeout.
6. Start `GET https://httpbin.org/delay/10` → cancel while running. **Expect**: cell
   shows cancelled state.
7. Fetch a large body (e.g. `https://httpbin.org/bytes/4000000` or a big text URL).
   **Expect**: display truncated with an explicit truncation indicator; app stays
   responsive.

### US4 — Environment variables (P4)

1. Add vars: `base_url = https://httpbin.org`, `token = secret-123` (mark secret).
   **Expect**: `token` value masked by default; explicit reveal action shows it.
2. HTTP cell: `GET {{base_url}}/headers` with header `Authorization: Bearer {{token}}`
   → run. **Expect**: httpbin echoes `Authorization: Bearer secret-123` (substitution
   worked).
3. Reference `{{missing}}` in the URL → run. **Expect**: warning naming `missing`;
   request not silently sent with the literal placeholder.
4. Save → reopen. **Expect**: vars persisted; secret still masked.
5. Inspect app logs after runs. **Expect**: no `secret-123` anywhere (SC-009).

### US5 — PHP execution via Docker (P5)

Health path first, with Docker Desktop **stopped**:

1. Run a PHP cell. **Expect**: specific "Docker daemon not running" message + remedy —
   no generic error, no hang (SC-007).
2. Start Docker Desktop, remove the image (`docker rmi php:8.4-cli` if present) → run
   again. **Expect**: "image missing" state offering in-app pull; pull succeeds →
   healthy.

Execution paths:

3. Cell `<?php echo "hello from sandbox";` → run. **Expect**: running state → output
   `hello from sandbox`, duration shown, succeeded state.
4. Cell `<?php throw new Exception("boom");` → run. **Expect**: failed state; error
   text displayed distinctly from stdout.
5. Cell `<?php while(true) {}` → run. **Expect**: terminated at the 30 s limit (or the
   configured limit), cause "timeout" reported; app responsive throughout; verify no
   leftover container: `docker ps -a | grep pnb-run` → empty (SC-005).
6. Cell `<?php $a = str_repeat("x", 1024*1024*1024);` → run. **Expect**: terminated,
   cause "memory".
7. Cell `<?php var_dump(file_get_contents("https://example.com"));` → run. **Expect**:
   network failure inside the sandbox (network disabled by default).
8. Cell `<?php print_r(scandir("/"));` → run. **Expect**: container filesystem only —
   no host paths visible.
9. Stop Docker again → confirm PHP cells still author/save fine; only running is
   blocked with guidance.

### Cross-cutting

- Every runnable cell always shows one of idle/running/succeeded/failed states
  (SC-004).
- Disconnect network → app fully usable except sending HTTP requests (FR-033).
- Watch for any silent failure: every action must produce visible feedback (FR-034).

## Success criteria spot-checks

| Criterion | How to verify here |
|-----------|--------------------|
| SC-001 | Time a fresh user through US1.1 + US2.1 + save — under 3 min |
| SC-002 | US2.5 diff: reopened notebook identical |
| SC-003 | US3.1 — results render immediately after response |
| SC-005 | US5.5/US5.6 — terminated at limits, app responsive, no debris |
| SC-006 | Open `.pnb.json` in a text editor; make two saves and `git diff` them |
| SC-007 | US5.1/US5.2 — specific remedy per failure mode |
| SC-009 | US4.5 — zero secret occurrences in logs/UI |
