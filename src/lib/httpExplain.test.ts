import { describe, expect, it } from "vitest";
import { explainHttpStatus, explainTransportFailure, httpStatusText } from "./httpExplain";
import { HTTP_ERROR_KINDS } from "../types/notebook";

describe("explainHttpStatus", () => {
  it("covers every documented specific status", () => {
    for (const code of [400, 401, 403, 404, 405, 409, 422, 429, 500, 502, 503, 504]) {
      const text = explainHttpStatus(code);
      expect(text, `status ${code}`).toBeTruthy();
      expect(text!.length).toBeGreaterThan(20);
    }
  });

  it("falls back to family explanations for uncommon error codes", () => {
    expect(explainHttpStatus(418)).toMatch(/client/i);
    expect(explainHttpStatus(599)).toMatch(/server/i);
  });

  it("returns null for success and redirect statuses", () => {
    expect(explainHttpStatus(200)).toBeNull();
    expect(explainHttpStatus(204)).toBeNull();
    expect(explainHttpStatus(301)).toBeNull();
  });

  it("never claims to replace the raw response", () => {
    for (const code of [400, 404, 500]) {
      expect(explainHttpStatus(code)).not.toMatch(/instead of|replaces/i);
    }
  });
});

describe("httpStatusText", () => {
  it("returns standard reason phrases for common codes", () => {
    expect(httpStatusText(200)).toBe("OK");
    expect(httpStatusText(404)).toBe("Not Found");
    expect(httpStatusText(500)).toBe("Internal Server Error");
  });

  it("returns null for uncommon codes", () => {
    expect(httpStatusText(299)).toBeNull();
    expect(httpStatusText(599)).toBeNull();
  });
});

describe("explainTransportFailure", () => {
  it("covers every transport error kind", () => {
    for (const kind of HTTP_ERROR_KINDS) {
      expect(explainTransportFailure(kind).length).toBeGreaterThan(20);
    }
  });
});
