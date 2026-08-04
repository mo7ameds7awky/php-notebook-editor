/** Pure notebook logic: creation, zod-backed validation, cell factories. */

import { z } from "zod";
import type { Cell, CellType, HttpRequestSpec, Notebook } from "../types/notebook";
import { HTTP_METHODS } from "../types/notebook";
import {
  DEFAULT_HTTP_TIMEOUT_MS,
  HTTP_TIMEOUT_MAX_MS,
  HTTP_TIMEOUT_MIN_MS,
} from "./config";

export const NOTEBOOK_SCHEMA_VERSION = 1;
export const TITLE_MAX_LENGTH = 200;
export const CELL_ID_MAX_LENGTH = 64;
export const ENV_VAR_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const nameValueSchema = z.object({ name: z.string(), value: z.string() });

const httpRequestSchema = z.object({
  method: z.enum(HTTP_METHODS),
  url: z.string(),
  headers: z.array(nameValueSchema),
  body: z.string(),
  timeoutMs: z
    .number()
    .int()
    .min(HTTP_TIMEOUT_MIN_MS)
    .max(HTTP_TIMEOUT_MAX_MS)
    .optional(),
});

const cellId = z.string().min(1).max(CELL_ID_MAX_LENGTH);
const lastRun = z.record(z.string(), z.unknown()).nullish();

const cellSchema = z.discriminatedUnion("type", [
  z.object({ id: cellId, type: z.literal("markdown"), source: z.string() }),
  z.object({ id: cellId, type: z.literal("php"), source: z.string(), lastRun }),
  z.object({ id: cellId, type: z.literal("http"), request: httpRequestSchema, lastRun }),
]);

const envVarSchema = z.object({
  name: z.string().regex(ENV_VAR_NAME_PATTERN, "must be a valid variable name"),
  value: z.string(),
  secret: z.boolean(),
});

const notebookSchema = z
  .looseObject({
    schemaVersion: z.literal(NOTEBOOK_SCHEMA_VERSION),
    title: z.string().min(1).max(TITLE_MAX_LENGTH),
    cells: z.array(cellSchema),
    envVars: z.array(envVarSchema),
  })
  .superRefine((value, ctx) => {
    const cellIds = new Set<string>();
    value.cells.forEach((cell, index) => {
      if (cellIds.has(cell.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["cells", index, "id"],
          message: `duplicate cell id "${cell.id}"`,
        });
      }
      cellIds.add(cell.id);
    });
    const envNames = new Set<string>();
    value.envVars.forEach((envVar, index) => {
      if (envNames.has(envVar.name)) {
        ctx.addIssue({
          code: "custom",
          path: ["envVars", index, "name"],
          message: `duplicate variable name "${envVar.name}"`,
        });
      }
      envNames.add(envVar.name);
    });
  });

export type NotebookValidation =
  | { ok: true; notebook: Notebook }
  | { ok: false; error: "versionUnsupported"; reason: string }
  | { ok: false; error: "invalidNotebook"; reason: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function firstIssueReason(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "notebook shape is invalid";
  const path = issue.path.length > 0 ? issue.path.join(".") : "notebook";
  return `${path}: ${issue.message}`;
}

export function validateNotebook(value: unknown): NotebookValidation {
  if (!isRecord(value)) {
    return { ok: false, error: "invalidNotebook", reason: "notebook file must contain a JSON object" };
  }

  const version = value.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    return { ok: false, error: "invalidNotebook", reason: "schemaVersion must be an integer" };
  }
  if (version > NOTEBOOK_SCHEMA_VERSION) {
    return {
      ok: false,
      error: "versionUnsupported",
      reason: `file uses schema version ${version}; this app supports up to ${NOTEBOOK_SCHEMA_VERSION}`,
    };
  }

  const parsed = notebookSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: "invalidNotebook", reason: firstIssueReason(parsed.error) };
  }

  // Returning the original object keeps unknown top-level fields intact.
  return { ok: true, notebook: value as unknown as Notebook };
}

export type EnvVarNameError = "invalidName" | "duplicateName";

/** Validates an env var name against the identifier rule and sibling uniqueness. */
export function validateEnvVarName(
  name: string,
  takenNames: readonly string[],
): EnvVarNameError | null {
  if (!ENV_VAR_NAME_PATTERN.test(name)) return "invalidName";
  if (takenNames.includes(name)) return "duplicateName";
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
