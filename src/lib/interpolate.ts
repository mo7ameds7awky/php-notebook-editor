/** Pure {{name}} placeholder resolution for HTTP request specs. Single pass,
 *  no recursion: substituted values are never re-scanned for more placeholders. */

import type { EnvVar, HttpRequestSpec } from "../types/notebook";

/** Matches {{name}} tokens whose name is a valid env var identifier; anything
 *  else (stray braces, invalid names) is literal text. */
const PLACEHOLDER_RE = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

/** Thrown when a run is blocked because the request references undefined variables. */
export class UnresolvedPlaceholdersError extends Error {
  readonly names: readonly string[];

  constructor(names: readonly string[]) {
    super(`unresolved placeholders: ${names.map((n) => `{{${n}}}`).join(", ")}`);
    this.name = "UnresolvedPlaceholdersError";
    this.names = names;
  }
}

const toValueMap = (vars: readonly EnvVar[]): Map<string, string> =>
  new Map(vars.map((v) => [v.name, v.value]));

const substitute = (text: string, values: Map<string, string>): string =>
  text.replace(PLACEHOLDER_RE, (token, name: string) => values.get(name) ?? token);

/** Replaces every defined {{name}} token in the text; undefined tokens stay literal. */
export function interpolate(text: string, vars: readonly EnvVar[]): string {
  return substitute(text, toValueMap(vars));
}

/** Returns a new request with url, header names, header values, and body interpolated. */
export function resolveRequest(
  request: HttpRequestSpec,
  vars: readonly EnvVar[],
): HttpRequestSpec {
  const values = toValueMap(vars);
  return {
    ...request,
    url: substitute(request.url, values),
    headers: request.headers.map((header) => ({
      name: substitute(header.name, values),
      value: substitute(header.value, values),
    })),
    body: substitute(request.body, values),
  };
}

/** Placeholder names referenced anywhere in the request but not defined,
 *  deduplicated, in order of first appearance (url, then headers, then body). */
export function collectUnresolved(
  request: HttpRequestSpec,
  vars: readonly EnvVar[],
): string[] {
  const defined = new Set(vars.map((v) => v.name));
  const unresolved: string[] = [];
  const seen = new Set<string>();

  const scan = (text: string) => {
    for (const match of text.matchAll(PLACEHOLDER_RE)) {
      const name = match[1];
      if (!defined.has(name) && !seen.has(name)) {
        seen.add(name);
        unresolved.push(name);
      }
    }
  };

  scan(request.url);
  for (const header of request.headers) {
    scan(header.name);
    scan(header.value);
  }
  scan(request.body);
  return unresolved;
}
