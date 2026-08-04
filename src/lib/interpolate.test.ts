import { describe, expect, it } from "vitest";
import {
  collectUnresolved,
  interpolate,
  resolveRequest,
  tokenizePlaceholders,
  UnresolvedPlaceholdersError,
} from "./interpolate";
import type { EnvVar, HttpRequestSpec } from "../types/notebook";

const vars = (...entries: Array<[string, string]>): EnvVar[] =>
  entries.map(([name, value]) => ({ name, value, secret: false }));

const request = (partial: Partial<HttpRequestSpec> = {}): HttpRequestSpec => ({
  method: "GET",
  url: "",
  headers: [],
  body: "",
  timeoutMs: 30_000,
  ...partial,
});

describe("interpolate", () => {
  it("replaces a defined token", () => {
    expect(interpolate("{{base_url}}/users", vars(["base_url", "https://api.test"]))).toBe(
      "https://api.test/users",
    );
  });

  it("replaces adjacent tokens independently", () => {
    expect(interpolate("{{a}}{{b}}", vars(["a", "1"], ["b", "2"]))).toBe("12");
  });

  it("replaces repeated tokens everywhere they appear", () => {
    expect(interpolate("{{a}}-{{a}}", vars(["a", "x"]))).toBe("x-x");
  });

  it("substitutes empty values", () => {
    expect(interpolate("a{{gap}}b", vars(["gap", ""]))).toBe("ab");
  });

  it("leaves undefined tokens literal", () => {
    expect(interpolate("{{missing}}/x", vars(["other", "1"]))).toBe("{{missing}}/x");
  });

  it("leaves stray braces and invalid names literal", () => {
    const empty = vars();
    expect(interpolate("{{", empty)).toBe("{{");
    expect(interpolate("a }} b {{ c", empty)).toBe("a }} b {{ c");
    expect(interpolate("{{1bad}}", vars(["1bad", "x"]))).toBe("{{1bad}}");
    expect(interpolate("{{has space}}", empty)).toBe("{{has space}}");
    expect(interpolate("{{ padded }}", vars(["padded", "x"]))).toBe("{{ padded }}");
  });

  it("does not recurse into substituted values", () => {
    expect(interpolate("{{a}}", vars(["a", "{{b}}"], ["b", "deep"]))).toBe("{{b}}");
  });

  it("does not treat replacement-pattern characters in values specially", () => {
    expect(interpolate("{{a}}", vars(["a", "$& $1 $$"]))).toBe("$& $1 $$");
  });

  it("matches names case-sensitively", () => {
    expect(interpolate("{{Token}}", vars(["token", "low"]))).toBe("{{Token}}");
  });
});

describe("resolveRequest", () => {
  const env = vars(["base_url", "https://api.test"], ["token", "secret-123"], ["h", "X-Trace"]);

  it("interpolates url, header names, header values, and body", () => {
    const resolved = resolveRequest(
      request({
        url: "{{base_url}}/login",
        headers: [
          { name: "Authorization", value: "Bearer {{token}}" },
          { name: "{{h}}", value: "on" },
        ],
        body: '{"token":"{{token}}"}',
      }),
      env,
    );
    expect(resolved.url).toBe("https://api.test/login");
    expect(resolved.headers).toEqual([
      { name: "Authorization", value: "Bearer secret-123" },
      { name: "X-Trace", value: "on" },
    ]);
    expect(resolved.body).toBe('{"token":"secret-123"}');
  });

  it("keeps method and timeout untouched and does not mutate the input", () => {
    const original = request({
      method: "POST",
      url: "{{base_url}}",
      headers: [{ name: "A", value: "{{token}}" }],
      timeoutMs: 5000,
    });
    const resolved = resolveRequest(original, env);
    expect(resolved.method).toBe("POST");
    expect(resolved.timeoutMs).toBe(5000);
    expect(original.url).toBe("{{base_url}}");
    expect(original.headers[0].value).toBe("{{token}}");
  });
});

describe("collectUnresolved", () => {
  it("returns nothing when every token is defined", () => {
    const req = request({
      url: "{{base_url}}/x",
      headers: [{ name: "Authorization", value: "Bearer {{token}}" }],
      body: "{{token}}",
    });
    expect(collectUnresolved(req, vars(["base_url", "u"], ["token", "t"]))).toEqual([]);
  });

  it("collects missing names from url, header names, header values, and body", () => {
    const req = request({
      url: "{{a}}/x",
      headers: [{ name: "{{b}}", value: "{{c}}" }],
      body: "{{d}}",
    });
    expect(collectUnresolved(req, vars())).toEqual(["a", "b", "c", "d"]);
  });

  it("deduplicates repeated missing names and keeps first-appearance order", () => {
    const req = request({ url: "{{z}}/{{a}}", body: "{{z}}" });
    expect(collectUnresolved(req, vars())).toEqual(["z", "a"]);
  });

  it("treats names case-sensitively", () => {
    const req = request({ url: "{{Token}}" });
    expect(collectUnresolved(req, vars(["token", "t"]))).toEqual(["Token"]);
  });

  it("ignores invalid placeholder syntax", () => {
    const req = request({ url: "{{ not valid }}{{1bad}}{{", body: "}}" });
    expect(collectUnresolved(req, vars())).toEqual([]);
  });

  it("does not flag placeholder-looking text inside substituted values", () => {
    const req = request({ url: "{{a}}" });
    expect(collectUnresolved(req, vars(["a", "{{b}}"]))).toEqual([]);
  });

  it("counts a variable with an empty value as resolved", () => {
    const req = request({ url: "{{gap}}" });
    expect(collectUnresolved(req, vars(["gap", ""]))).toEqual([]);
  });
});

describe("tokenizePlaceholders", () => {
  it("splits text around resolved and missing tokens", () => {
    const segments = tokenizePlaceholders(
      "{{base_url}}/users?x={{missing}}!",
      vars(["base_url", "https://api.test"]),
    );
    expect(segments).toEqual([
      {
        kind: "placeholder",
        text: "{{base_url}}",
        name: "base_url",
        status: "resolved",
        secret: false,
        value: "https://api.test",
      },
      { kind: "text", text: "/users?x=" },
      { kind: "placeholder", text: "{{missing}}", name: "missing", status: "missing", secret: false },
      { kind: "text", text: "!" },
    ]);
  });

  it("never carries the value of a secret variable", () => {
    const secretVar = { name: "token", value: "secret-123", secret: true };
    const [segment] = tokenizePlaceholders("{{token}}", [secretVar]);
    expect(segment).toEqual({
      kind: "placeholder",
      text: "{{token}}",
      name: "token",
      status: "resolved",
      secret: true,
    });
    expect(JSON.stringify(tokenizePlaceholders("{{token}}", [secretVar]))).not.toContain(
      "secret-123",
    );
  });

  it("keeps invalid tokens inside plain text segments", () => {
    expect(tokenizePlaceholders("{{1bad}} {{ spaced }} {{", vars(["1bad", "x"]))).toEqual([
      { kind: "text", text: "{{1bad}} {{ spaced }} {{" },
    ]);
  });

  it("handles adjacent and repeated tokens", () => {
    const segments = tokenizePlaceholders("{{a}}{{a}}{{b}}", vars(["a", "1"]));
    expect(segments.map((s) => s.kind)).toEqual(["placeholder", "placeholder", "placeholder"]);
    expect(segments.map((s) => (s.kind === "placeholder" ? s.status : ""))).toEqual([
      "resolved",
      "resolved",
      "missing",
    ]);
  });

  it("does not tokenize placeholder-looking text inside variable values", () => {
    const segments = tokenizePlaceholders("{{a}}", vars(["a", "{{b}}"], ["b", "deep"]));
    expect(segments).toEqual([
      { kind: "placeholder", text: "{{a}}", name: "a", status: "resolved", secret: false, value: "{{b}}" },
    ]);
  });

  it("returns a single text segment for placeholder-free text", () => {
    expect(tokenizePlaceholders("plain", vars(["a", "1"]))).toEqual([
      { kind: "text", text: "plain" },
    ]);
    expect(tokenizePlaceholders("", vars())).toEqual([]);
  });
});

describe("UnresolvedPlaceholdersError", () => {
  it("carries the names and lists them in the message", () => {
    const error = new UnresolvedPlaceholdersError(["a", "b"]);
    expect(error.names).toEqual(["a", "b"]);
    expect(error.message).toContain("{{a}}");
    expect(error.message).toContain("{{b}}");
    expect(error).toBeInstanceOf(Error);
  });
});
