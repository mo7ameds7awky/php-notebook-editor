<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0 (2026-08-04)
- Modified principles: V. Clear, Honest UX — added responsive resizable-desktop-UI
  requirement (materially expanded guidance → MINOR bump)
- Added sections: none
- Removed sections: none
- Follow-up TODOs: none
- Prior report (1.0.0, 2026-08-03): initial ratification — Core Principles I–V,
  Security & Execution Constraints, Development Workflow & Quality Gates, Governance
-->

# PHP Notebook Editor Constitution

## Core Principles

### I. Sandboxed Execution — Never In-Process (NON-NEGOTIABLE)

User-written PHP MUST NOT execute inside the desktop app process.

- No `eval`, embedded interpreter, or in-process execution of notebook PHP in the
  Tauri/Rust backend, the webview, or any Bun/Node tooling process.
- All PHP cell execution MUST run inside an isolated Docker container (or an equally
  isolated runtime approved by amendment to this constitution).
- Every execution MUST enforce a wall-clock timeout and MUST enforce a memory limit;
  runs exceeding limits are terminated and reported as terminated.
- Containers MUST NOT mount the host filesystem by default. Mounts are opt-in, scoped
  to user-selected paths, and visible in the UI before execution.
- Container network access MUST be explicit and configurable; the default posture is
  restricted.

Rationale: the product's core action is running untrusted code. A single in-process
shortcut compromises the whole machine; isolation is the identity of the app, not a
feature.

### II. Local-First Data

The user's machine is the source of truth.

- Notebooks MUST be stored as local, human-readable `.pnb.json` files the user can
  open, diff, and back up without this app.
- The notebook schema MUST carry a version field; readers MUST fail with a clear
  message on unknown future versions rather than corrupting data.
- The app MUST be fully functional offline except for actions that inherently require
  a network (HTTP request cells, Docker image pulls).
- No account, cloud service, or remote sync is required for any feature. Nothing
  leaves the machine (code, tokens, paths, telemetry) without explicit user opt-in.

Rationale: local-first is the trust proposition that justifies a desktop app for
developers handling private code and credentials.

### III. Testability

Every feature MUST be designed so its core behavior is verifiable without launching
the full desktop app.

- Pure logic (notebook schema parse/serialize, cell state transitions, env-var
  interpolation, HTTP request building) MUST live in plainly unit-testable modules.
- The frontend↔backend IPC boundary MUST be a typed contract; Tauri commands are
  tested in Rust, and the TypeScript side is tested against the same contract shape.
- External boundaries (Docker, filesystem, network) MUST sit behind interfaces that
  can be faked in tests; the real Docker execution path MUST have integration tests.
- A vertical slice is not done until its tests exist and pass.

Rationale: an app that executes code and mutates user files cannot stay correct
through manual click-testing alone.

### IV. Small Vertical Slices

Work MUST be planned and delivered as thin end-to-end slices.

- A slice cuts through the stack (UI → IPC → Rust/execution → persistence) and
  produces a user-visible, demoable behavior.
- Slices SHOULD be completable in days, not weeks; larger work is split before it
  starts, not after it stalls.
- No speculative abstraction: build what the current slice needs (YAGNI). Generalize
  only when a second concrete use exists.
- The MVP out-of-scope list in the README is binding; scope additions require explicit
  agreement before implementation begins.

Rationale: an early-stage project survives on momentum and continuously integrated
working software, not on half-built horizontal layers.

### V. Clear, Honest UX

The interface MUST always tell the user what is happening and never lie by omission.

- Execution state MUST be visible per cell — idle, running, success, failure — with
  duration; stdout, stderr, and exit information are shown, not swallowed.
- Failures MUST be actionable: runtime health checks (Docker installed, daemon
  running, image present) run before execution and produce specific guidance, not
  generic errors.
- No silent failures: every user action yields visible success, visible failure, or
  visible progress.
- Destructive actions (delete notebook, overwrite file, discard changes) MUST require
  confirmation.
- Secrets and sensitive env values MUST be masked in the UI by default and MUST NOT
  appear in logs.
- The UI MUST remain fully usable in resizable desktop windows: minimum supported
  viewport 1024×700 (best-effort down to 900×650); no fixed app-shell dimensions;
  content regions scroll intentionally; no important content may clip, and nothing
  may overflow horizontally outside code/output areas.

Rationale: a developer tool earns trust through predictability; unclear state around
code execution and file mutation destroys that trust fastest.

## Security & Execution Constraints

These constraints apply to all features, current and future:

- Technology stack is fixed for MVP: Tauri (Rust) desktop shell, React + TypeScript
  frontend, Bun runtime/package manager, Vite build, Docker for PHP execution. Stack
  changes require a constitution amendment.
- Tauri capabilities/permissions MUST be minimal: only the commands and filesystem
  scopes a shipped feature needs. Broad filesystem or shell access is prohibited.
- Notebook content is untrusted input: Markdown rendering MUST be sanitized; no
  notebook content may inject script into the webview.
- HTTP request cells send user-configured requests; responses MUST be treated as
  data — never evaluated, never rendered as live HTML.
- Environment variables holding secrets MUST be masked in the UI, redacted from logs,
  and MUST NOT be written into notebook files unless the user explicitly stores them
  there.
- Execution logs and error reports MUST NOT include secret values.

## Development Workflow & Quality Gates

- Features follow the Spec Kit flow: specify → clarify (as needed) → plan → tasks →
  implement, one vertical slice at a time.
- Every change MUST pass before merge: TypeScript type-check, lint, frontend unit
  tests, and `cargo test` (plus `cargo clippy` with no new warnings) when Rust code
  changes.
- Code review MUST verify constitution compliance, checking Principle I explicitly
  for any change touching execution, IPC, or filesystem access.
- Any deviation from a principle MUST be recorded in the feature plan's Complexity
  Tracking section with a justification and the simpler alternative that was
  rejected.

## Governance

- This constitution supersedes all other development practices in this repository.
  Where a template, plan, or habit conflicts with it, the constitution wins.
- Amendments are made by editing this file in a dedicated commit/PR that includes the
  change, an updated Sync Impact Report, and a version bump.
- Versioning policy (semantic):
  - MAJOR: backward-incompatible governance changes; removing or redefining a
    principle.
  - MINOR: new principle or section added, or materially expanded guidance.
  - PATCH: clarifications and wording fixes that do not change meaning.
- Compliance review: every feature plan's Constitution Check MUST be evaluated
  against the current version of this document; violations block implementation
  until justified in Complexity Tracking or resolved.
- Runtime development guidance for agents and tooling (e.g., `CLAUDE.md`) MUST stay
  consistent with this constitution.

**Version**: 1.1.0 | **Ratified**: 2026-08-03 | **Last Amended**: 2026-08-04
