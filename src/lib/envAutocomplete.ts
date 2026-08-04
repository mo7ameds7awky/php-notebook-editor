/** Pure helpers for env var autocomplete inside single-line request fields. */

import type { EnvVar } from "../types/notebook";
import { ENV_VAR_NAME_PATTERN } from "./notebook";

export interface ActivePlaceholder {
  /** Index of the opening "{{" of the fragment being typed. */
  start: number;
  /** Text between the braces and the cursor; empty right after "{{". */
  query: string;
}

/** Matches an identifier tail followed by a closing "}}" directly after the cursor. */
const CLOSES_AHEAD_RE = /^[A-Za-z0-9_]*\}\}/;

/** Finds the unclosed {{fragment the cursor is inside, or null. Returns null
 *  inside already-closed placeholders and for non-identifier fragments. */
export function findActivePlaceholder(text: string, cursor: number): ActivePlaceholder | null {
  const before = text.slice(0, cursor);
  const start = before.lastIndexOf("{{");
  if (start < 0) return null;
  const query = before.slice(start + 2);
  if (query !== "" && !ENV_VAR_NAME_PATTERN.test(query)) return null;
  if (CLOSES_AHEAD_RE.test(text.slice(cursor))) return null;
  return { start, query };
}

const byNameAlpha = (a: EnvVar, b: EnvVar) =>
  a.name.toLowerCase().localeCompare(b.name.toLowerCase());

/** Case-insensitive filter: prefix matches first, then contains matches,
 *  each group alphabetical. An empty query returns every variable. */
export function getEnvSuggestions(query: string, vars: readonly EnvVar[]): EnvVar[] {
  const q = query.toLowerCase();
  const prefix: EnvVar[] = [];
  const contains: EnvVar[] = [];
  for (const variable of [...vars].sort(byNameAlpha)) {
    const name = variable.name.toLowerCase();
    if (name.startsWith(q)) prefix.push(variable);
    else if (name.includes(q)) contains.push(variable);
  }
  return [...prefix, ...contains];
}

/** Replaces the active {{fragment before the cursor with {{name}} and puts the
 *  cursor after the closing braces. Without an active fragment, returns the
 *  input unchanged. */
export function applyEnvSuggestion(
  text: string,
  cursor: number,
  name: string,
): { text: string; cursor: number } {
  const active = findActivePlaceholder(text, cursor);
  if (!active) return { text, cursor };
  const token = `{{${name}}}`;
  return {
    text: text.slice(0, active.start) + token + text.slice(cursor),
    cursor: active.start + token.length,
  };
}
