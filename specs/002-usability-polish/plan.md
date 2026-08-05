# Implementation Plan: Phase 2 — Usability Polish & Output Intelligence (first slice)

**Branch**: `002-usability-polish` | **Date**: 2026-08-05 | **Spec**: [spec.md](./spec.md)
**Status**: DRAFT — planning only; implementation not yet authorized

## Summary

Build the Phase 2 usability slice on top of the shipped Phase 1 architecture with
zero contract or schema churn: a rich HTTP result viewer (metadata summary, friendly
error explanations), Tree/Pretty/Raw/Headers view modes with a guarded JSON tree,
copy/export actions including copy-as-PHP-array (valid JSON objects/arrays only,
explicit user action, copies exactly what the action names), a guided runtime setup
path (Home status card, actionable remedies, pull progress — links and explanations
only, no Docker installer/updater), and a three-notebook example library opened via
an open-a-copy flow (safe public/local/placeholder endpoints, placeholder secrets
only). All inspection logic lands as pure
`src/lib/**` modules per Constitution Principle III; all rendering mounts inside the
existing `HttpResultView` seam identified in Phase 1's forward-compatibility notes.

## Technical Context

**Stack**: unchanged from Phase 1 (React 19 + TS frontend, Zustand, Tailwind v4
semantic tokens, Radix dialogs, lucide icons; Rust/Tauri 2 backend). No new heavy UI
dependencies — the JSON tree is hand-rolled on theme tokens, not a component
library.

**Data**: viewer renders the persisted `lastRun` / `HttpResponseSummary` contract
shapes as-is. Derived models (`ResponseMeta`, `JsonTreeNode`) are computed, never
persisted. No `.pnb.json` schema change; no IPC request/response shape change.

**Additive backend surface (only if streamed pull progress lands)**: a
`pull_php_image` progress event channel (Tauri event, additive) documented in
contracts/ipc-commands.md per the contract change policy — the command's
request/response stays identical, so both mirrors are untouched.

**Open technical decisions (spike first, research.md records the outcome)**:

1. **Clipboard**: try `navigator.clipboard.writeText` inside WKWebView/WebView2; if
   denied, adopt `tauri-plugin-clipboard-manager` with ONLY
   `clipboard-manager:allow-write-text` added to capabilities (write-only; no read
   permission ever).
2. **Pull progress**: parse `docker pull` stdout lines → streamed percent via event
   channel; fallback is staged progress (starting → downloading → verifying → done)
   which already satisfies FR-216.
3. **Example delivery**: examples are imported as JSON modules into the frontend
   bundle (Vite `import ... from "../examples/x.pnb.json"`), so opening a copy is
   template → save dialog → `save_notebook` — zero new filesystem capability, no
   Tauri resource bundling.

## Constitution Check

| Gate | Verdict | Evidence |
|------|---------|----------|
| I. Sandboxed Execution | PASS | No execution surface touched; `php -l` validation of exported arrays runs inside the existing gated Docker tests only. |
| II. Local-First Data | PASS | No schema change, no new storage, examples open as user-owned copies; nothing leaves the machine. |
| III. Testability | PASS | Tree building, meta derivation, PHP export, explanations, clipboard wrapper — all pure `src/lib/**` modules with unit tests; components tested with RTL; PHP-array validity verified by gated sandbox tests. |
| IV. Small Vertical Slices | PASS | Five independently demoable stories; viewer track and runtime/examples track can ship separately. |
| V. Clear, Honest UX | PASS | Raw always available, parse failures fall back visibly, remedies stay specific and actionable, progress states are explicit. |
| Security & Execution Constraints | PASS | HTML/scripts never rendered (source view only); capabilities grow by at most write-only clipboard after the spike; logging policy unchanged (nothing logs). |

## Project Structure (planned additions)

```text
src/lib/
├── responseMeta.ts        # size/content-type/JSON-validity derivation (+ tests)
├── jsonTree.ts            # safe parse + typed tree model, depth/size guards (+ tests)
├── phpExport.ts           # JSON object/array → PHP array literal, escaping (+ tests)
├── httpExplain.ts         # static status→explanation copy map — deterministic,
│                          #   keyed on code/kind only, never body-derived (+ tests)
└── clipboard.ts           # explicit-action copy wrapper w/ graceful failure (+ tests)

src/components/cells/
├── HttpResultView.tsx     # becomes the viewer shell: summary row + view tabs
├── ResponseViewTabs.tsx   # Tree | Pretty | Raw | Headers (session-only state)
├── JsonTreeView.tsx       # collapsible tree, node copy hooks
└── CopyActions.tsx        # copy/export menu

src/components/home/
└── RuntimeSetupCard.tsx   # Home health card, first-run vs degraded copy

examples/
├── welcome.pnb.json       # improved tour
├── api-testing.pnb.json   # env vars + masked placeholder secret + several requests
└── php-tour.pnb.json      # output, errors, limits demonstrations

src-tauri/src/services/docker.rs   # (optional) pull progress line parsing + event emit
```

## Risks

| Risk | Mitigation |
|------|------------|
| Webview clipboard permission varies by platform | T001 spike decides mechanism before any UI work; plugin fallback is write-only and constitution-checked |
| `docker pull` output parsing is brittle across Docker versions | Streamed progress is best-effort; staged progress is the contract-satisfying fallback; parser isolated + unit-tested on captured samples |
| Large/deep JSON tree jank | Pure tree model with hard depth limits + node-count guards + lazy expansion + expand-all clamp; beyond safe limits the tree is not attempted — Pretty/Raw fallback with a clear message; virtualization only if SC-201 fails without it |
| PHP array export escaping bugs | Exhaustive unit fixtures (unicode, quotes, nested, empty, numeric keys) + gated `php -l` validation inside the sandbox |
| Viewer refactor regresses Phase 1 semantics (transport vs status, truncation badge) | Existing HttpResultView tests kept and extended; FR-202 asserted per view |
| Example drift as features evolve | Examples validated against the schema in a unit test so CI catches breakage |

## Recommended implementation order

1. **T001 clipboard spike** (unblocks copy/export design and the capability question).
2. **Foundational pure libs** (responseMeta, jsonTree, phpExport, httpExplain,
   clipboard) — parallelizable, all unit-tested before any UI.
3. **US1 viewer shell** (summary + explanations) — the mount everything else lands in.
4. **US2 view modes + JSON tree** — the differentiator.
5. **US3 copy/export** — quick once US2 exists.
6. **US4 runtime setup UX** — independent track; can run parallel with US2/US3 after
   the foundational phase (second developer-track option).
7. **US5 example library** — content plus the small Home affordance; last because it
   benefits from every earlier feature existing.
8. **Polish**: quickstart-002 manual pass, gates sweep, roadmap/CHANGELOG updates.
