/** Pure JSON → PHP array literal conversion for the explicit "Copy as PHP
 *  array" action. Only JSON objects and arrays convert; anything else refuses
 *  so the UI can disable the action with a reason. */

import type { JsonValue } from "./jsonTree";

export type PhpExportResult =
  | { ok: true; php: string }
  | { ok: false; reason: "notJsonContainer" };

const INDENT = "    ";

/** Single-quoted PHP string: only backslash and the quote need escaping;
 *  everything else (unicode, newlines) is literal and stays intact. */
function phpString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function phpScalar(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "string") return phpString(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

function emit(value: JsonValue, depth: number): string {
  const pad = INDENT.repeat(depth + 1);
  const closePad = INDENT.repeat(depth);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item) => `${pad}${emit(item, depth + 1)},`);
    return `[\n${items.join("\n")}\n${closePad}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "[]";
    const items = entries.map(
      ([key, item]) => `${pad}${phpString(key)} => ${emit(item, depth + 1)},`,
    );
    return `[\n${items.join("\n")}\n${closePad}]`;
  }
  return phpScalar(value);
}

/** Converts a parsed JSON object or array into a short-syntax PHP array
 *  literal. Scalar roots (and non-JSON input) refuse with a typed reason. */
export function toPhpArray(value: JsonValue): PhpExportResult {
  if (value === null || typeof value !== "object") {
    return { ok: false, reason: "notJsonContainer" };
  }
  return { ok: true, php: emit(value, 0) };
}
