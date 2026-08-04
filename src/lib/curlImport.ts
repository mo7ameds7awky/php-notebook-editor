/**
 * Parses a pasted cURL command into an HTTP request. Never logs its input —
 * pasted commands routinely contain tokens and credentials.
 */

import type { HttpMethod, NameValue } from "../types/notebook";
import { isHttpMethod } from "../types/notebook";
import { HTTP_TIMEOUT_MAX_MS, HTTP_TIMEOUT_MIN_MS } from "./config";

export interface ParsedCurlRequest {
  method: HttpMethod;
  url: string;
  headers: NameValue[];
  body: string;
  timeoutMs?: number;
}

export type CurlImport =
  | {
      ok: true;
      request: ParsedCurlRequest;
      warnings: string[];
      sensitiveHeaders: string[];
    }
  | { ok: false; error: string };

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "x-api-key",
  "api-key",
  "x-auth-token",
  "proxy-authorization",
]);

const SILENT_FLAGS = new Set(["-s", "-S", "-v", "-i", "--verbose", "--silent", "--include"]);

const UNSUPPORTED_WITH_VALUE: Record<string, string> = {
  "-F": "multipart form uploads",
  "--form": "multipart form uploads",
  "-b": "cookies",
  "--cookie": "cookies",
  "--cookie-jar": "cookie jars",
  "--cert": "client certificates",
  "--key": "client certificates",
  "--cacert": "certificate authorities",
  "-x": "proxies",
  "--proxy": "proxies",
  "-u": "basic auth flags (use an Authorization header instead)",
  "--user": "basic auth flags (use an Authorization header instead)",
  "-o": "output files",
  "--output": "output files",
  "--data-urlencode": "URL-encoded data building",
};

const UNSUPPORTED_BARE: Record<string, string> = {
  "--compressed": "compressed transfer negotiation",
  "-k": "TLS verification flags",
  "--insecure": "TLS verification flags",
  "-G": "converting data into query parameters",
  "--get": "converting data into query parameters",
  "-I": "HEAD requests",
  "--head": "HEAD requests",
  "-L": "redirect flags (redirects are already followed automatically)",
  "--location": "redirect flags (redirects are already followed automatically)",
  "--http2": "HTTP/2-specific flags",
  "--http1.1": "HTTP-version flags",
};

function tokenize(input: string): string[] | null {
  const tokens: string[] = [];
  let current = "";
  let hasCurrent = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (ch === "'") {
      const end = input.indexOf("'", i + 1);
      if (end === -1) return null;
      current += input.slice(i + 1, end);
      hasCurrent = true;
      i = end + 1;
      continue;
    }
    if (ch === '"') {
      i++;
      let out = "";
      let closed = false;
      while (i < input.length) {
        const c = input[i];
        if (c === "\\" && i + 1 < input.length && '"\\$`'.includes(input[i + 1])) {
          out += input[i + 1];
          i += 2;
          continue;
        }
        if (c === '"') {
          closed = true;
          i++;
          break;
        }
        out += c;
        i++;
      }
      if (!closed) return null;
      current += out;
      hasCurrent = true;
      continue;
    }
    if (ch === "\\" && i + 1 < input.length) {
      current += input[i + 1];
      hasCurrent = true;
      i += 2;
      continue;
    }
    if (/\s/.test(ch)) {
      if (hasCurrent) {
        tokens.push(current);
        current = "";
        hasCurrent = false;
      }
      i++;
      continue;
    }
    current += ch;
    hasCurrent = true;
    i++;
  }
  if (hasCurrent) tokens.push(current);
  return tokens;
}

function looksLikeJson(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function isSensitive(header: NameValue): boolean {
  if (SENSITIVE_HEADER_NAMES.has(header.name.trim().toLowerCase())) return true;
  return /^(bearer|basic)\s+\S+/i.test(header.value.trim());
}

export function parseCurlCommand(input: string): CurlImport {
  const normalized = input
    .replace(/\\\r?\n/g, " ")
    .replace(/^\s*[$#]\s+/, "")
    .trim();
  if (normalized === "") return { ok: false, error: "Paste a cURL command first." };

  const tokens = tokenize(normalized);
  if (tokens === null) {
    return { ok: false, error: "The command has an unterminated quote." };
  }
  if (tokens.length === 0 || tokens[0].toLowerCase() !== "curl") {
    return { ok: false, error: "This does not look like a cURL command (it must start with \"curl\")." };
  }

  const warnings: string[] = [];
  const headers: NameValue[] = [];
  const dataParts: string[] = [];
  let method: HttpMethod | null = null;
  let url: string | null = null;
  let timeoutMs: number | undefined;

  const takeValue = (flag: string, index: number): string | null => {
    if (index + 1 >= tokens.length) {
      warnings.push(`Option ${flag} is missing its value and was ignored.`);
      return null;
    }
    return tokens[index + 1];
  };

  const applyMethod = (raw: string) => {
    const candidate = raw.toUpperCase();
    if (isHttpMethod(candidate)) {
      method = candidate;
    } else {
      warnings.push(`Method ${candidate} is not supported; using ${method ?? "the default"}.`);
    }
  };

  const applyData = (raw: string, flag: string) => {
    if (raw.startsWith("@")) {
      warnings.push(`File references like ${raw} (${flag}) are not supported; body skipped.`);
      return;
    }
    dataParts.push(raw);
  };

  let i = 1;
  while (i < tokens.length) {
    let token = tokens[i];

    if (token.startsWith("--") && token.includes("=")) {
      const eq = token.indexOf("=");
      const flag = token.slice(0, eq);
      const value = token.slice(eq + 1);
      tokens.splice(i, 1, flag, value);
      token = flag;
    }

    if (token === "-X" || token === "--request") {
      const value = takeValue(token, i);
      if (value !== null) {
        applyMethod(value);
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (token.startsWith("-X") && token.length > 2) {
      applyMethod(token.slice(2));
      i++;
      continue;
    }
    if (token === "-H" || token === "--header") {
      const value = takeValue(token, i);
      if (value !== null) {
        const colon = value.indexOf(":");
        if (colon === -1) {
          warnings.push(`Header "${value}" has no colon and was ignored.`);
        } else {
          headers.push({
            name: value.slice(0, colon).trim(),
            value: value.slice(colon + 1).trim(),
          });
        }
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (
      token === "-d" ||
      token === "--data" ||
      token === "--data-raw" ||
      token === "--data-binary" ||
      token === "--data-ascii"
    ) {
      const value = takeValue(token, i);
      if (value !== null) {
        applyData(value, token);
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (token === "-m" || token === "--max-time") {
      const value = takeValue(token, i);
      if (value !== null) {
        const seconds = Number.parseFloat(value);
        if (Number.isFinite(seconds) && seconds > 0) {
          timeoutMs = Math.max(HTTP_TIMEOUT_MIN_MS, Math.min(Math.round(seconds * 1000), HTTP_TIMEOUT_MAX_MS));
        } else {
          warnings.push(`Timeout value "${value}" is not a number and was ignored.`);
        }
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (token === "--url") {
      const value = takeValue(token, i);
      if (value !== null) {
        url = value;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (token in UNSUPPORTED_WITH_VALUE) {
      warnings.push(`${UNSUPPORTED_WITH_VALUE[token]} (${token}) are not supported; option ignored.`);
      const hasValue = i + 1 < tokens.length && !tokens[i + 1].startsWith("-");
      i += hasValue ? 2 : 1;
      continue;
    }
    if (token in UNSUPPORTED_BARE) {
      warnings.push(`${UNSUPPORTED_BARE[token]} (${token}) are not supported; option ignored.`);
      i++;
      continue;
    }
    if (SILENT_FLAGS.has(token)) {
      i++;
      continue;
    }
    if (token.startsWith("-")) {
      warnings.push(`Unsupported option ${token} was ignored.`);
      i++;
      continue;
    }
    if (url === null) {
      url = token;
    } else {
      warnings.push(`Extra argument "${token}" was ignored.`);
    }
    i++;
  }

  if (url === null) {
    return { ok: false, error: "No URL found in the command." };
  }

  const body = dataParts.join("&");
  const resolvedMethod: HttpMethod = method ?? (body !== "" ? "POST" : "GET");

  const hasContentType = headers.some((h) => h.name.trim().toLowerCase() === "content-type");
  if (body !== "" && !hasContentType && looksLikeJson(body)) {
    headers.push({ name: "Content-Type", value: "application/json" });
    warnings.push("Added Content-Type: application/json based on the JSON body.");
  }

  const sensitiveHeaders = headers.filter(isSensitive).map((h) => h.name);

  return {
    ok: true,
    request: {
      method: resolvedMethod,
      url,
      headers,
      body,
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    },
    warnings,
    sensitiveHeaders,
  };
}
