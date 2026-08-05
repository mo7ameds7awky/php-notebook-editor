import { describe, expect, it } from "vitest";
import {
  classifyContentType,
  deriveResponseMeta,
  formatBytes,
  parseContentType,
} from "./responseMeta";
import type { HttpResponseSummary } from "../types/notebook";

const response = (partial: Partial<HttpResponseSummary>): HttpResponseSummary => ({
  statusCode: 200,
  headers: [],
  body: "",
  bodyTruncated: false,
  ...partial,
});

describe("formatBytes", () => {
  it("formats bytes, kilobytes, and megabytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

describe("parseContentType", () => {
  it("strips parameters and lowercases", () => {
    expect(parseContentType("Application/JSON; charset=utf-8")).toBe("application/json");
    expect(parseContentType("text/html")).toBe("text/html");
  });

  it("returns null for absent or empty values", () => {
    expect(parseContentType(null)).toBeNull();
    expect(parseContentType("  ; charset=utf-8")).toBeNull();
  });
});

describe("classifyContentType", () => {
  it("classifies the content families", () => {
    expect(classifyContentType("application/json")).toBe("json");
    expect(classifyContentType("application/problem+json")).toBe("json");
    expect(classifyContentType("text/html")).toBe("html");
    expect(classifyContentType("application/xml")).toBe("xml");
    expect(classifyContentType("image/svg+xml")).toBe("xml");
    expect(classifyContentType("text/plain")).toBe("text");
    expect(classifyContentType("image/png")).toBe("binary");
    expect(classifyContentType("application/octet-stream")).toBe("binary");
    expect(classifyContentType("application/x-custom")).toBe("unknown");
    expect(classifyContentType(null)).toBe("unknown");
  });
});

describe("deriveResponseMeta", () => {
  it("derives size, content type, and JSON validity", () => {
    const meta = deriveResponseMeta(
      response({
        body: '{"ok":true}',
        headers: [{ name: "Content-Type", value: "application/json; charset=utf-8" }],
      }),
    );
    expect(meta.sizeBytes).toBe(11);
    expect(meta.sizeLabel).toBe("11 B");
    expect(meta.contentType).toBe("application/json");
    expect(meta.kind).toBe("json");
    expect(meta.bodyIsValidJson).toBe(true);
  });

  it("counts multi-byte characters as UTF-8 bytes", () => {
    const meta = deriveResponseMeta(response({ body: "héllo" }));
    expect(meta.sizeBytes).toBe(6);
  });

  it("flags invalid JSON bodies regardless of the declared type", () => {
    const meta = deriveResponseMeta(
      response({
        body: "{broken",
        headers: [{ name: "content-type", value: "application/json" }],
      }),
    );
    expect(meta.kind).toBe("json");
    expect(meta.bodyIsValidJson).toBe(false);
  });

  it("treats an empty body as not-JSON with a missing content type", () => {
    const meta = deriveResponseMeta(response({}));
    expect(meta.sizeBytes).toBe(0);
    expect(meta.contentType).toBeNull();
    expect(meta.kind).toBe("unknown");
    expect(meta.bodyIsValidJson).toBe(false);
  });
});
