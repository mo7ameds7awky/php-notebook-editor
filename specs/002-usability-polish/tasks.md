# Tasks: Phase 2 — Usability Polish & Output Intelligence (first slice)

**Input**: [spec.md](./spec.md) + [plan.md](./plan.md)
**Status**: PLANNED — do not execute until implementation is explicitly ordered

**Tests**: INCLUDED — Constitution Principle III applies to every slice: pure-logic
unit tests, component tests, and gated Docker validation where the sandbox is the
verifier (`php -l` for exported arrays).

**Organization**: Setup → Foundational (pure libs) → US1…US5 → Polish. Story phases
are independently completable and demoable. Format: `[ID] [P?] [Story] Description`.

## Phase 1: Setup & Decisions

- [ ] T001 Clipboard spike: verify `navigator.clipboard.writeText` inside the Tauri
  webview on macOS (WKWebView) and note Windows/Linux expectations; if denied, adopt
  `tauri-plugin-clipboard-manager` adding ONLY `clipboard-manager:allow-write-text`
  to `src-tauri/capabilities/default.json`; record the decision + rationale in
  `specs/002-usability-polish/research.md` (constitution re-check either way)
- [ ] T002 [P] Pull-progress spike: capture `docker pull` stdout samples across a
  cold and warm pull, decide streamed-percent vs staged progress, record in
  `research.md`; if streamed, document the additive progress event channel in
  `specs/001-notebook-mvp/contracts/ipc-commands.md` per the contract change policy

## Phase 2: Foundational (pure logic — blocks all UI stories)

- [ ] T003 [P] `src/lib/responseMeta.ts`: derive size (formatted + bytes), parsed
  content type, JSON-validity flag from `HttpResponseSummary`; unit tests in
  `responseMeta.test.ts` (charset params, missing content-type, binary summary, empty
  body)
- [ ] T004 [P] `src/lib/jsonTree.ts`: `safeParseJson`, `buildTree(value)` returning
  typed nodes (kind, key, preview, childCount/length, depth), plus guard config
  (initial-depth cap, expand-all node clamp); unit tests covering deep nesting, big
  arrays, all JSON types, parse failure
- [ ] T005 [P] `src/lib/phpExport.ts`: `toPhpArray(json)` emitting short-syntax PHP
  array literals (assoc/list detection, string escaping incl. quotes/backslashes/
  unicode, ints/floats/bool/null, nested); unit tests with an exported fixture set
  reused by the gated sandbox check (T007)
- [ ] T006 [P] `src/lib/httpExplain.ts`: status-code → friendly one-liner map (families
  4xx/5xx + specific 400/401/403/404/409/422/429/500/502/503/504) and transport-kind
  explanations; unit tests assert coverage and that text never claims to replace the
  raw status
- [ ] T007 `src-tauri/tests/docker_exec.rs`: add `#[ignore]`d test piping each
  `phpExport` fixture through `php -l` in the sandbox → all parse clean (SC-203)
  (depends on T005 fixtures)
- [ ] T008 `src/lib/clipboard.ts`: `copyText(text)` on the T001 mechanism with a
  typed failure result (never throws content into logs); unit tests with a mocked
  backend (depends on T001)

**Checkpoint**: all inspection logic proven pure + tested before any component work

## Phase 3: User Story 1 - Rich HTTP Result Viewer (P1)

- [ ] T009 [US1] Refactor `src/components/cells/HttpResultView.tsx` into the viewer
  shell: metadata summary row (status badge, method, authored URL, duration, size,
  content type, timestamp via T003), preserving Phase 1 transport-vs-status rendering
  and truncation badge; extend existing component tests (FR-201/202)
- [ ] T010 [US1] Friendly explanation line via T006 rendered for error statuses and
  transport failures; component tests assert raw status/body remain visible
  (FR-203)
- [ ] T011 [US1] CHECKPOINT: manual scenarios — 200/404/500/timeout/unreachable
  against httpbin; summary fields verified; story demoable

## Phase 4: User Story 2 - View Modes & JSON Tree (P2)

- [ ] T012 [US2] `src/components/cells/ResponseViewTabs.tsx`: Tree | Pretty | Raw |
  Headers tab strip (session-only state, smart default per content type via T003,
  Tree/Pretty disabled with note for non-JSON/binary); Tailwind semantic utilities +
  a11y (tablist/tab/tabpanel roles, keyboard switching); component tests
  (FR-204/205, FR-209 fallback)
- [ ] T013 [US2] `src/components/cells/JsonTreeView.tsx`: collapsible nodes from T004
  model — type-toned values via theme tokens, indentation guides, collapsed
  key-count/length labels, expand-all/collapse-all with clamp, lazy child rendering
  past the depth guard; component tests incl. deep/large fixtures (FR-206/207/208)
- [ ] T014 [US2] Pretty + Raw + Headers panes: pretty-printed JSON on `bg-code-bg`,
  Raw byte-exact (SC-202) reusing the existing pre, Headers reusing the Phase 1
  list; binary/empty-body states; component tests
- [ ] T015 [US2] CHECKPOINT: manual scenarios — JSON/text/HTML/binary responses,
  malformed JSON fallback, 2 MB body responsiveness spot-check (SC-201); story
  demoable

## Phase 5: User Story 3 - Copy & Export (P3)

- [ ] T016 [US3] `src/components/cells/CopyActions.tsx`: copy raw body / pretty JSON /
  headers / summary via T008 (disabled states: no body, invalid JSON for
  JSON-shaped actions; "Copy as PHP array" via T005); clipboard-failure dialog with
  selectable text; success feedback (transient "Copied" state); component tests
  (FR-210/212/213/214)
- [ ] T017 [US3] Node-level copy in `JsonTreeView`: copy value / copy subtree for the
  focused node (keyboard + mouse); component tests (FR-211)
- [ ] T018 [US3] CHECKPOINT: manual scenarios — every copy shape verified by pasting;
  `php -l` acceptance via gated test rerun; notebook file untouched after copies;
  story demoable

## Phase 6: User Story 4 - Guided Runtime Setup (P4)

- [ ] T019 [P] [US4] `src/components/home/RuntimeSetupCard.tsx`: Home health card
  reusing `appStore` health — first-run copy (nothing installed) vs degraded copy
  (was healthy), same detail/remedy as the banner, re-check + pull actions;
  component tests (FR-215/218)
- [ ] T020 [US4] Actionable remedies: `dockerNotInstalled` remedy opens the Docker
  Desktop download URL via the opener plugin; window-focus re-probe (guarded,
  throttled); tests (FR-217)
- [ ] T021 [US4] Pull progress per T002 decision: staged progress states in
  `appStore`/banner/card at minimum; streamed percent via the documented event
  channel if adopted (Rust parser unit-tested on captured samples; no payload
  logging); tests (FR-216)
- [ ] T022 [US4] CHECKPOINT: manual scenarios — Docker stopped → guided to healthy
  from Home only; pull progress visible; focus re-probe works; story demoable

## Phase 7: User Story 5 - Example Library (P5)

- [ ] T023 [P] [US5] Author `examples/api-testing.pnb.json` (env vars incl. a
  secret-flagged placeholder + several httpbin requests) and
  `examples/php-tour.pnb.json` (output, exception, limits demos); improve
  `examples/welcome.pnb.json`; add a unit test validating every example against
  `validateNotebook` (FR-219/221)
- [ ] T024 [US5] Home "Examples" section: bundled examples imported as JSON modules;
  choosing one runs the open-a-copy flow (save dialog → `createNew` from template →
  notebook opens); no new capabilities; component tests (FR-220)
- [ ] T025 [US5] CHECKPOINT: manual scenarios — each example opens as a copy and its
  cells run/demonstrate as designed; story demoable

## Phase 8: Polish & Cross-Cutting

- [ ] T026 [P] `specs/002-usability-polish/quickstart.md`: manual validation guide for
  US1–US5 + SC-201…SC-206 spot-check table
- [ ] T027 Gates sweep — all green: `bun run typecheck`, `bun run lint`,
  `bun run test`, `cd src-tauri && cargo test && cargo clippy`; gated suite
  (`cargo test -- --ignored`) where Docker present
- [ ] T028 Compliance re-review: capabilities diff (at most write-only clipboard),
  logging audit greps (still zero logging statements), secret sweep, brand audit;
  update `docs/roadmap.md` (Phase 2 slice → delivered) + `CHANGELOG.md`
- [ ] T029 Full manual acceptance: quickstart-002 top-to-bottom + Phase 1 quickstart
  regression skim (US1–US5 still work)

## Dependencies & Execution Order

```
T001 ─┬─▶ T008 ─▶ US3 (T016–T018)
T002 ─┼─▶ T021
      │
T003–T006 [P] ─▶ US1 (T009–T011) ─▶ US2 (T012–T015) ─▶ US3
T005 ─▶ T007 (gated php -l)
Foundational ─▶ US4 (T019–T022)  ← independent track, parallel with US2/US3
US4/T019 ─▶ US5 T024 (Home surface); T023 [P] any time after Foundational
All stories ─▶ Polish (T026–T029)
```

Two-track option: Track A = viewer (US1→US2→US3); Track B = runtime + examples
(US4→US5). Only shared file early on is `HttpResultView.tsx` (Track A owns it).

## Notes

- All UI consumes theme tokens/semantic utilities + common primitives; no raw hex, no
  new icon packs, a11y baseline applies (keyboard tree navigation, tablist roles).
- Responsive rules (Phase 1 T067) bind every new surface: tabs wrap/collapse, tree
  scrolls inside its pane, no fixed dimensions.
- Logging policy unchanged — copy/export and progress parsing must not introduce the
  first logging statement.
- No notebook schema changes; view mode and tree state are session-only.
- Phase 3/4 Output Intelligence items remain in `docs/roadmap.md` — do not pull them
  forward.
