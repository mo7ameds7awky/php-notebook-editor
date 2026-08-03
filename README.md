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