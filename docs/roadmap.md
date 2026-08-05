# Product Roadmap — Future Tracks

This document captures product direction beyond the Phase 1 MVP
([specs/001-notebook-mvp](../specs/001-notebook-mvp/spec.md)). Everything here is a
**non-binding backlog**: nothing in this file is part of the current US4/US5
implementation scope, and no Phase 1 work (including PHP execution) may be blocked on
it. When a track graduates to implementation, it gets its own Spec Kit feature
(spec → plan → tasks) and these notes become input, not contract.

## Track: Output Intelligence & Developer-Friendly Results

**Direction**: Cell outputs should not be raw text dumps only. They should become
developer-friendly result inspectors that help users inspect, understand, copy,
transform, document, and test outputs. The current MVP already has HTTP cells and
will later have PHP cells; richer output previews are a planned differentiator —
deliberately deferred until after Phase 1 ships.

### Phase 2 — Usable MVP output enhancements

> **Status (2026-08-05)**: spec drafted — this slice is now planned as feature
> [specs/002-usability-polish](../specs/002-usability-polish/spec.md) (spec + plan +
> tasks), which also folds in guided runtime setup UX (links and explanations only —
> no Docker installer/updater) and an example notebook library (safe
> public/local/placeholder endpoints, placeholder secrets only) beyond the original
> output-intelligence list. Friendly error explanations are static deterministic
> copy, never AI-generated and never body-derived; copy actions are explicit-only
> and copy exactly what they name. Implementation not yet started.

1. **Rich HTTP result viewer**
   - Response metadata summary: status, method, URL, duration, size, content type,
     timestamp.
   - Clear distinction between HTTP error statuses and transport failures
     (extends the Phase 1 FR-021 distinction).
   - Friendly HTTP error explanations (what a 404/422/500 typically means in an API
     workflow), never replacing the raw status/body.

2. **Response view modes**
   - Tree, Pretty, Raw, and Headers views.
   - The raw response always remains available regardless of selected mode.

3. **JSON tree preview**
   - Collapsible objects and arrays.
   - Colored keys and values by data type.
   - Indentation guides.
   - Object key count and array length shown on collapsed nodes.
   - Expand all / collapse all.
   - Large response handling (virtualized or depth-limited rendering so big bodies
     stay responsive).

4. **Copy/export actions**
   - Copy raw body.
   - Copy formatted (pretty-printed) JSON.
   - Copy selected JSON node.
   - Copy headers.
   - Copy response summary.
   - Copy as PHP array when the response is valid JSON.

5. **Content-type aware output rendering**
   - JSON: Tree / Pretty / Raw.
   - Text: plain viewer with wrapping and search.
   - HTML: raw/source view only (no rendering) for safety in this phase.
   - XML: pretty-printed text if practical.
   - Binary: metadata summary only (size, content type).

6. **Search inside output**
   - Search the response body.
   - Highlight matches.
   - Basic next/previous match navigation if practical.

### Phase 3 — Laravel/API differentiation

1. **JSON path inspector**
   - Click/select a JSON value.
   - Show its dot path and a JSONPath-style path.
   - Copy path, copy value, copy subtree.

2. **Generate test/assertion snippets**
   - Copy as Pest assertions.
   - Copy as PHPUnit assertions.
   - Copy as a Laravel HTTP test snippet.
   - Generate basic `assertJsonPath` examples from selected response data.

3. **Save response value as environment variable**
   - User selects a JSON value and chooses "save as env var".
   - Token-like values default to secret.
   - Confirmation is always required before the variable is written.
   - Extracted secret values are never logged (same policy as Phase 1 env vars).

4. **Save response as fixture**
   - Name the fixture.
   - Export/copy the fixture.
   - Use fixtures in future test generation.

5. **Convert output to documentation**
   - Convert a response summary/body into a Markdown cell.
   - Insert a request/response example under the current cell.
   - Supports a runnable-documentation workflow (docs that re-run against live
     endpoints).

### Phase 4 — Polish and sharing

1. **Output history**
   - Keep previous runs per cell.
   - Show timestamp, status, duration, and response size per entry.
   - Let the user choose the latest or a past run to display.

2. **Pin output**
   - Pin an important output so reruns do not replace it.
   - Useful for documentation and comparison workflows.

3. **Compare outputs**
   - Previous vs current run.
   - Expected vs actual.
   - Show JSON fields added/removed/changed.
   - Show status, header, and body differences.

4. **Redaction/privacy tools**
   - Mark an output as sensitive.
   - Copy a redacted response.
   - Manually redact selected values.
   - Optionally do not persist sensitive outputs when configured.

5. **Advanced previews**
   - Safe image preview.
   - Improved XML viewer.
   - Safe HTML source/preview only if the security model allows it.
   - Downloadable binary response handling.

### Scope rules (binding when implementation starts)

- None of the above is part of the current US4 or US5 implementation scope.
- PHP execution work (US5) is never blocked on these enhancements.
- The product does not become a full Postman replacement; output intelligence serves
  the notebook workflow, not full API-client feature parity.
- Raw output must always remain available in every view mode.
- Rich previews must never execute HTML/scripts from responses (extends the Phase 1
  sanitized-rendering rule, FR-024).
- Secret and output privacy rules must remain consistent with the logging policy
  (docs/architecture.md §Logging policy): no secrets or payloads in logs, ever.
- Server-returned response bodies are displayed as received unless a future
  redaction feature is explicitly used (same boundary as Phase 1 SC-009).
- Copy/export features must not mutate notebook data unless the user explicitly
  chooses an action that does (e.g., "insert as Markdown cell").
- Saving a response value as an env var always requires explicit confirmation.

### Acceptance criteria for future tasks

- JSON arrays/objects render in a collapsible tree.
- Raw and pretty views remain available alongside any richer view.
- "Copy as PHP array" works for valid JSON objects/arrays.
- JSON path copy works for nested objects and arrays.
- Test snippet generation uses selected response data safely (no code execution, no
  secret leakage into generated snippets beyond what the user selected).
- Output history/pinning never accidentally overwrites important results.
- Redaction tools never modify raw stored output unless the user explicitly saves a
  redacted copy.

### Backlog summary

The per-phase backlog items mirroring this track live in
[specs/001-notebook-mvp/tasks.md §Future backlog](../specs/001-notebook-mvp/tasks.md)
so they stay visible next to the Phase 1 task list without entering its execution
scope.
