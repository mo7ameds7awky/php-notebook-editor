/** Pure derivation of display metadata from an HTTP response summary. */

import type { HttpResponseSummary, NameValue } from "../types/notebook";

export type ContentKind = "json" | "html" | "xml" | "text" | "binary" | "unknown";

export interface ResponseMeta {
  /** UTF-8 byte size of the captured (possibly truncated) body. */
  sizeBytes: number;
  /** Human-readable size, e.g. "1.2 KB". */
  sizeLabel: string;
  /** Media type without parameters, lowercased; null when absent. */
  contentType: string | null;
  kind: ContentKind;
  /** True when the body parses as JSON (independent of the declared type). */
  bodyIsValidJson: boolean;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function headerValue(headers: readonly NameValue[], name: string): string | null {
  const match = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return match ? match.value : null;
}

/** Media type with parameters stripped: "application/json; charset=utf-8" → "application/json". */
export function parseContentType(raw: string | null): string | null {
  if (!raw) return null;
  const mime = raw.split(";")[0].trim().toLowerCase();
  return mime === "" ? null : mime;
}

const BINARY_PREFIXES = ["image/", "audio/", "video/", "font/"];
const BINARY_TYPES = new Set([
  "application/octet-stream",
  "application/pdf",
  "application/zip",
  "application/gzip",
]);

export function classifyContentType(mime: string | null): ContentKind {
  if (!mime) return "unknown";
  if (mime === "application/json" || mime.endsWith("+json")) return "json";
  if (mime === "text/html" || mime === "application/xhtml+xml") return "html";
  if (mime === "text/xml" || mime === "application/xml" || mime.endsWith("+xml")) return "xml";
  if (BINARY_PREFIXES.some((prefix) => mime.startsWith(prefix)) || BINARY_TYPES.has(mime)) {
    return "binary";
  }
  if (mime.startsWith("text/")) return "text";
  return "unknown";
}

function isValidJson(body: string): boolean {
  if (body.trim() === "") return false;
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

/** Derives all display metadata for a response in one pass. */
export function deriveResponseMeta(response: HttpResponseSummary): ResponseMeta {
  const sizeBytes = new TextEncoder().encode(response.body).length;
  const contentType = parseContentType(headerValue(response.headers, "content-type"));
  return {
    sizeBytes,
    sizeLabel: formatBytes(sizeBytes),
    contentType,
    kind: classifyContentType(contentType),
    bodyIsValidJson: isValidJson(response.body),
  };
}
