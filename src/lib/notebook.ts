/** Pure notebook logic: creation, validation, normalization. */

import type { Cell, CellType, HttpRequestSpec, Notebook } from "../types/notebook";
import { isCellType, isHttpMethod } from "../types/notebook";

export const NOTEBOOK_SCHEMA_VERSION = 1;
export const TITLE_MAX_LENGTH = 200;
export const CELL_ID_MAX_LENGTH = 64;
export const ENV_VAR_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const HTTP_TIMEOUT_MIN_MS = 1_000;
export const HTTP_TIMEOUT_MAX_MS = 300_000;
export const DEFAULT_HTTP_TIMEOUT_MS = 30_000;

export type NotebookValidation =
  | { ok: true; notebook: Notebook }
  | { ok: false; error: "versionUnsupported"; reason: string }
  | { ok: false; error: "invalidNotebook"; reason: string };

const invalid = (reason: string): NotebookValidation => ({
  ok: false,
  error: "invalidNotebook",
  reason,
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function validateNotebook(value: unknown): NotebookValidation {
  if (!isRecord(value)) return invalid("notebook file must contain a JSON object");

  const version = value.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    return invalid("schemaVersion must be an integer");
  }
  if (version > NOTEBOOK_SCHEMA_VERSION) {
    return {
      ok: false,
      error: "versionUnsupported",
      reason: `file uses schema version ${version}; this app supports up to ${NOTEBOOK_SCHEMA_VERSION}`,
    };
  }
  if (version !== NOTEBOOK_SCHEMA_VERSION) {
    return invalid(`unsupported schema version ${version}`);
  }

  if (
    typeof value.title !== "string" ||
    value.title.length < 1 ||
    value.title.length > TITLE_MAX_LENGTH
  ) {
    return invalid(`title must be a string of 1–${TITLE_MAX_LENGTH} characters`);
  }

  if (!Array.isArray(value.cells)) return invalid("cells must be an array");
  const cellIds = new Set<string>();
  for (const [index, cell] of value.cells.entries()) {
    const problem = validateCell(cell, index, cellIds);
    if (problem) return invalid(problem);
  }

  if (!Array.isArray(value.envVars)) return invalid("envVars must be an array");
  const envNames = new Set<string>();
  for (const [index, envVar] of value.envVars.entries()) {
    const problem = validateEnvVar(envVar, index, envNames);
    if (problem) return invalid(problem);
  }

  // Returning the original object keeps unknown top-level fields intact.
  return { ok: true, notebook: value as unknown as Notebook };
}

function validateCell(cell: unknown, index: number, seenIds: Set<string>): string | null {
  const at = `cells[${index}]`;
  if (!isRecord(cell)) return `${at} must be an object`;

  const { id, type } = cell;
  if (typeof id !== "string" || id.length < 1 || id.length > CELL_ID_MAX_LENGTH) {
    return `${at}.id must be a string of 1–${CELL_ID_MAX_LENGTH} characters`;
  }
  if (seenIds.has(id)) return `${at}.id "${id}" is duplicated`;
  seenIds.add(id);

  if (!isCellType(type)) return `${at}.type must be one of markdown, php, http`;

  if (type === "markdown" || type === "php") {
    if (typeof cell.source !== "string") return `${at}.source must be a string`;
  }
  if (type === "http") {
    const problem = validateHttpRequest(cell.request, `${at}.request`);
    if (problem) return problem;
  }
  if ("lastRun" in cell && cell.lastRun !== null && cell.lastRun !== undefined) {
    if (!isRecord(cell.lastRun)) return `${at}.lastRun must be an object or null`;
  }
  return null;
}

function validateHttpRequest(request: unknown, at: string): string | null {
  if (!isRecord(request)) return `${at} must be an object`;
  if (!isHttpMethod(request.method)) {
    return `${at}.method must be one of GET, POST, PUT, PATCH, DELETE`;
  }
  if (typeof request.url !== "string") return `${at}.url must be a string`;
  if (!Array.isArray(request.headers)) return `${at}.headers must be an array`;
  for (const [i, header] of request.headers.entries()) {
    if (!isRecord(header) || typeof header.name !== "string" || typeof header.value !== "string") {
      return `${at}.headers[${i}] must be a { name, value } string pair`;
    }
  }
  if (typeof request.body !== "string") return `${at}.body must be a string`;
  if (request.timeoutMs !== undefined) {
    const t = request.timeoutMs;
    if (
      typeof t !== "number" ||
      !Number.isInteger(t) ||
      t < HTTP_TIMEOUT_MIN_MS ||
      t > HTTP_TIMEOUT_MAX_MS
    ) {
      return `${at}.timeoutMs must be an integer between ${HTTP_TIMEOUT_MIN_MS} and ${HTTP_TIMEOUT_MAX_MS}`;
    }
  }
  return null;
}

function validateEnvVar(envVar: unknown, index: number, seenNames: Set<string>): string | null {
  const at = `envVars[${index}]`;
  if (!isRecord(envVar)) return `${at} must be an object`;
  if (typeof envVar.name !== "string" || !ENV_VAR_NAME_PATTERN.test(envVar.name)) {
    return `${at}.name must match ${ENV_VAR_NAME_PATTERN}`;
  }
  if (seenNames.has(envVar.name)) return `${at}.name "${envVar.name}" is duplicated`;
  seenNames.add(envVar.name);
  if (typeof envVar.value !== "string") return `${at}.value must be a string`;
  if (typeof envVar.secret !== "boolean") return `${at}.secret must be a boolean`;
  return null;
}

export function newCellId(): string {
  return crypto.randomUUID();
}

export function defaultHttpRequest(): HttpRequestSpec {
  return {
    method: "GET",
    url: "",
    headers: [],
    body: "",
    timeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
  };
}

export function createCell(type: CellType): Cell {
  const id = newCellId();
  switch (type) {
    case "markdown":
      return { id, type, source: "" };
    case "php":
      return { id, type, source: "<?php\n" };
    case "http":
      return { id, type, request: defaultHttpRequest() };
  }
}

export function createEmptyNotebook(title: string): Notebook {
  const safeTitle = title.trim().slice(0, TITLE_MAX_LENGTH) || "Untitled notebook";
  return {
    schemaVersion: NOTEBOOK_SCHEMA_VERSION,
    title: safeTitle,
    cells: [],
    envVars: [],
  };
}
