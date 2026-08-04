# Changelog

All notable changes to PHP Notebook Editor are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Project constitution, Spec Kit feature workflow, and Phase 1 MVP specification.
- Brand and theme foundation: app identity, design tokens, dark-only theme, brand
  logo assets, generated app icons, Tailwind CSS v4 with semantic token utilities.
- Notebook lifecycle (User Story 1): create, open, save, and save-as for `.pnb.json`
  files; recent-notebooks list; unsaved-change protection; conflict detection for
  files changed on disk; save-as fallback for files moved or deleted externally;
  rejection of corrupted files and newer schema versions without modifying them.
- Frontend foundation libraries: lucide-react icons, Radix dialog primitives,
  zod-backed notebook validation, jest-dom test matchers.
- Frontend error-mapping layer turning IPC error codes into user-facing dialogs with
  optional technical details.
- Centralized configuration modules for runtime defaults (PHP image, timeouts,
  output caps, recents limit) on both the Rust and TypeScript sides.
- Baseline accessibility: managed dialog focus, labelled controls, visible focus
  rings, non-color status indicators, reduced-motion support.
- Notebook environment variables (User Story 4): per-notebook variable panel with
  name validation, uniqueness, secret masking with per-row reveal; `{{name}}`
  interpolation into HTTP URL, header names, header values, and body at run time;
  runs referencing undefined variables are blocked with a warning naming each
  placeholder; secret values never appear in logs.
- Environment variable highlighting and autocomplete in HTTP cells: placeholder
  chips show resolved/missing status with tooltips (secret values stay masked);
  typing `{{` in the URL or a header value suggests variables with keyboard and
  mouse insertion. Body shows the highlighting preview only — in-editor body
  autocomplete (CodeMirror integration) is a planned follow-up.
