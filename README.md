# PHP Notebook Editor

A local-first desktop notebook app for PHP and Laravel developers.

PHP Notebook Editor lets developers write notes, run PHP snippets, test HTTP requests, and document backend experiments in one place. It is inspired by notebook tools like Jupyter, but focused on PHP/Laravel learning, API testing, local development, and executable backend documentation.

The app is built as a desktop application using **Tauri + React + TypeScript + Bun**, with planned isolated PHP execution through Docker.

---

## Project status

This project is currently in early MVP development.

Current milestone:

- [x] Tauri + React app scaffolded
- [x] Bun selected as package manager/runtime
- [ ] Notebook file format
- [ ] Notebook CRUD
- [ ] Markdown cells
- [ ] PHP code cells
- [ ] HTTP request cells
- [ ] Docker-based PHP execution
- [ ] Environment variables
- [ ] Local project folder detection

---

## Product vision

PHP developers often use a mix of tools while learning, debugging, and prototyping:

- scratch files
- `php artisan tinker`
- temporary routes/controllers
- Postman or Insomnia
- Markdown docs
- terminal commands
- database clients
- browser tabs

PHP Notebook Editor aims to bring part of that workflow into a single local-first desktop experience.

The goal is not to replace a full IDE, Postman, or Tinkerwell. Instead, the goal is to provide a structured notebook workspace where developers can combine:

- explanation
- executable PHP snippets
- HTTP/API requests
- outputs
- examples
- learning notes
- debugging playbooks

---

## Core idea

A notebook is made of multiple cells.

Planned cell types:

1. **Markdown cells**
   - Write explanations, notes, documentation, tutorials, and observations.

2. **PHP cells**
   - Write and run PHP snippets in an isolated runtime.
   - View stdout, stderr, errors, return values, and execution duration.

3. **HTTP request cells**
   - Run GET/POST/PUT/PATCH/DELETE requests.
   - Inspect status code, headers, response body, timing, and errors.
   - Use environment variables such as `{{base_url}}` or `{{token}}`.

---

## Why desktop?

This project is intentionally desktop-first.

A desktop app is a strong fit because the product needs to interact with local developer environments:

- local project folders
- local notebook files
- Docker
- PHP runtimes
- Composer projects
- Laravel apps
- environment variables
- local APIs
- local-only execution

Keeping the app local-first also improves trust. Developers do not need to upload code snippets, API tokens, project paths, or private application details to a hosted service.

---

## Tech stack

### Current stack

- **Desktop shell:** Tauri
- **Frontend:** React
- **Language:** TypeScript
- **Package manager/runtime:** Bun
- **Build tool:** Vite
- **Desktop backend:** Rust through Tauri commands

### Planned runtime stack

- **PHP execution:** Docker-based PHP container
- **Notebook storage:** local `.pnb.json` files
- **Optional storage:** SQLite for app metadata/recent notebooks
- **Editor:** CodeMirror or Monaco Editor

---

## Recommended development environment

Before running the project, install:

- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri prerequisites](https://tauri.app/start/prerequisites/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — required later for PHP execution
- PHP and Composer — optional for local project detection and Laravel-related features

---

## Getting started

### 1. Clone the repository

```bash
git clone <repo-url>
cd php-notebook-editor
```

### 2. Install dependencies

```bash
bun install
```

### 3. Run the desktop app in development mode

```bash
bun run tauri dev
```

If everything is working, a desktop window should open with the Tauri + React starter UI.

---

## Common commands

```bash
# Install dependencies
bun install

# Run the Tauri desktop app
bun run tauri dev

# Build the frontend
bun run build

# Preview frontend build
bun run preview

# Build desktop app
bun run tauri build
```

---

## MVP scope

The first usable MVP should include:

- Tauri desktop shell
- React + TypeScript notebook UI
- Bun-based development workflow
- Create notebook
- Open notebook
- Save notebook
- Recent notebooks list
- Local `.pnb.json` notebook files
- Markdown cells
- PHP code cells
- HTTP request cells
- Basic environment variables
- Docker-based isolated PHP execution
- Basic project folder detection
- Runtime health checks for Docker/PHP availability

---

## Out of scope for MVP

The following features are intentionally postponed:

- Cloud sync
- Real-time collaboration
- AI assistant
- Laravel in-app package mode
- Production arbitrary code execution
- Full IDE replacement
- Full Postman/Insomnia replacement
- Advanced debugger
- App signing
- Auto-updates
- Marketplace distribution polish

---

## Security model

This project involves executing user-written PHP code, so security is a core design concern.

### Non-negotiable rules

- Do **not** execute arbitrary PHP using `eval` inside the Tauri/Rust process.
- Do **not** execute arbitrary PHP inside the main desktop app process.
- PHP snippets should run inside Docker or another isolated runtime.
- Execution must have timeouts.
- Execution should have memory limits.
- The full host filesystem should not be mounted by default.
- Network access should be explicit/configurable.
- Secrets should be masked in the UI.
- Logs should avoid printing secret values.

---

## First implementation tasks

Recommended order:

1. Finalize project structure.
2. Define `.pnb.json` notebook schema.
3. Implement notebook create/open/save.
4. Build cell editor UI.
5. Implement Markdown preview.
6. Implement HTTP request cells.
7. Implement Docker PHP execution.
8. Add environment variables.
9. Add project folder detection.
10. Create example notebooks.

---

## Author

Created by Mohamed Shawky.
