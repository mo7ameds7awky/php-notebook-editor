/** IPC contract types shared with the Rust backend; wire format is camelCase JSON. */

export const CELL_TYPES = ["markdown", "php", "http"] as const;
export type CellType = (typeof CELL_TYPES)[number];

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const PHP_RUN_STATUSES = ["succeeded", "failed", "terminated", "cancelled"] as const;
export type PhpRunStatus = (typeof PHP_RUN_STATUSES)[number];

export const HTTP_RUN_STATUSES = ["succeeded", "failed", "cancelled"] as const;
export type HttpRunStatus = (typeof HTTP_RUN_STATUSES)[number];

export const TERMINATION_REASONS = ["timeout", "memory"] as const;
export type TerminationReason = (typeof TERMINATION_REASONS)[number];

export const HTTP_ERROR_KINDS = ["network", "timeout", "invalidRequest", "cancelled"] as const;
export type HttpErrorKind = (typeof HTTP_ERROR_KINDS)[number];

export const RUNTIME_HEALTH_STATUSES = [
  "ok",
  "dockerNotInstalled",
  "daemonNotRunning",
  "imageMissing",
] as const;
export type RuntimeHealthStatus = (typeof RUNTIME_HEALTH_STATUSES)[number];

export const ERROR_CODES = [
  "fileNotFound",
  "io",
  "invalidNotebook",
  "versionUnsupported",
  "conflictOnDisk",
  "runtimeUnavailable",
  "pullFailed",
  "invalidInput",
  "internal",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface NameValue {
  name: string;
  value: string;
}

export interface HttpRequestSpec {
  method: HttpMethod;
  url: string;
  headers: NameValue[];
  body: string;
  timeoutMs?: number;
}

export interface PhpRunResult {
  status: PhpRunStatus;
  stdout: string;
  stderr: string;
  exitCode?: number | null;
  terminationReason?: TerminationReason | null;
  truncated: boolean;
  durationMs: number;
  ranAt: string;
}

export interface HttpRunError {
  kind: HttpErrorKind;
  message: string;
}

export interface HttpResponseSummary {
  statusCode: number;
  headers: NameValue[];
  body: string;
  bodyTruncated: boolean;
}

export interface HttpRunResult {
  status: HttpRunStatus;
  response?: HttpResponseSummary | null;
  error?: HttpRunError | null;
  durationMs: number;
  ranAt: string;
}

export interface MarkdownCell {
  id: string;
  type: "markdown";
  source: string;
}

export interface PhpCell {
  id: string;
  type: "php";
  source: string;
  lastRun?: PhpRunResult | null;
}

export interface HttpCell {
  id: string;
  type: "http";
  request: HttpRequestSpec;
  lastRun?: HttpRunResult | null;
}

export type Cell = MarkdownCell | PhpCell | HttpCell;

export interface EnvVar {
  name: string;
  value: string;
  secret: boolean;
}

export interface Notebook {
  schemaVersion: 1;
  title: string;
  cells: Cell[];
  envVars: EnvVar[];
  /** Unknown top-level fields are preserved through load/edit/save (forward-tolerance). */
  [key: string]: unknown;
}

export interface RuntimeHealth {
  status: RuntimeHealthStatus;
  detail: string;
  remedy: string;
}

export interface RecentEntry {
  path: string;
  title: string;
  lastOpenedAt: string;
}

export interface CommandError {
  code: ErrorCode;
  message: string;
}

/* IPC response envelopes */

export interface LoadNotebookResult {
  notebook: Notebook;
  fileMtimeMs: number;
}

export interface SaveNotebookResult {
  fileMtimeMs: number;
}

export interface ListRecentsResult {
  entries: RecentEntry[];
}

export interface CancelRunResult {
  cancelled: boolean;
}

/* Type guards */

const inList = (list: readonly string[], v: unknown): boolean =>
  typeof v === "string" && list.includes(v);

export const isCellType = (v: unknown): v is CellType => inList(CELL_TYPES, v);
export const isHttpMethod = (v: unknown): v is HttpMethod => inList(HTTP_METHODS, v);
export const isPhpRunStatus = (v: unknown): v is PhpRunStatus => inList(PHP_RUN_STATUSES, v);
export const isHttpRunStatus = (v: unknown): v is HttpRunStatus => inList(HTTP_RUN_STATUSES, v);
export const isRuntimeHealthStatus = (v: unknown): v is RuntimeHealthStatus =>
  inList(RUNTIME_HEALTH_STATUSES, v);
export const isErrorCode = (v: unknown): v is ErrorCode => inList(ERROR_CODES, v);
