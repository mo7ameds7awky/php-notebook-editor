import { describe, expect, it } from "vitest";
import { parseCurlCommand } from "./curlImport";

function expectOk(input: string) {
  const result = parseCurlCommand(input);
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result;
}

describe("parseCurlCommand — basics", () => {
  it("parses a simple GET", () => {
    const result = expectOk("curl https://api.example.test/users?page=2");
    expect(result.request.method).toBe("GET");
    expect(result.request.url).toBe("https://api.example.test/users?page=2");
    expect(result.request.headers).toEqual([]);
    expect(result.request.body).toBe("");
    expect(result.warnings).toEqual([]);
  });

  it("parses POST with JSON body, explicit content type, and headers", () => {
    const result = expectOk(
      `curl -X POST 'https://api.example.test/users' -H 'Content-Type: application/json' -H 'Accept: application/json' -d '{"name":"pnb"}'`,
    );
    expect(result.request.method).toBe("POST");
    expect(result.request.url).toBe("https://api.example.test/users");
    expect(result.request.headers).toEqual([
      { name: "Content-Type", value: "application/json" },
      { name: "Accept", value: "application/json" },
    ]);
    expect(result.request.body).toBe('{"name":"pnb"}');
  });

  it("preserves {{name}} placeholders in url, headers, and body untouched", () => {
    const result = expectOk(
      `curl -X POST '{{base_url}}/login' -H 'Authorization: Bearer {{token}}' -d '{"t":"{{token}}"}'`,
    );
    expect(result.request.url).toBe("{{base_url}}/login");
    expect(result.request.headers).toContainEqual({
      name: "Authorization",
      value: "Bearer {{token}}",
    });
    expect(result.request.body).toBe('{"t":"{{token}}"}');
  });

  it("defaults to POST when data is present without -X", () => {
    const result = expectOk("curl https://x.test -d 'a=1'");
    expect(result.request.method).toBe("POST");
    expect(result.request.body).toBe("a=1");
  });

  it("auto-adds a JSON content type when the body is JSON and none is set", () => {
    const result = expectOk(`curl https://x.test -d '{"ok":true}'`);
    expect(result.request.headers).toEqual([
      { name: "Content-Type", value: "application/json" },
    ]);
    expect(result.warnings.some((w) => w.includes("Content-Type"))).toBe(true);
  });

  it("keeps a raw text body without inventing a content type", () => {
    const result = expectOk("curl https://x.test --data-raw 'plain text here'");
    expect(result.request.body).toBe("plain text here");
    expect(result.request.headers).toEqual([]);
  });

  it("supports attached -XPUT, --request=DELETE, and --url=", () => {
    expect(expectOk("curl -XPUT https://x.test").request.method).toBe("PUT");
    const eq = expectOk("curl --request=DELETE --url=https://y.test");
    expect(eq.request.method).toBe("DELETE");
    expect(eq.request.url).toBe("https://y.test");
  });

  it("joins multiple -d parts with & like curl does", () => {
    const result = expectOk("curl https://x.test -d a=1 -d b=2");
    expect(result.request.body).toBe("a=1&b=2");
  });

  it("maps --max-time to a clamped timeout", () => {
    expect(expectOk("curl -m 5 https://x.test").request.timeoutMs).toBe(5000);
    expect(expectOk("curl --max-time 9999 https://x.test").request.timeoutMs).toBe(300_000);
  });

  it("handles multi-line commands with backslash continuations", () => {
    const result = expectOk(
      "curl -X POST \\\n  'https://api.example.test/orders' \\\n  -H 'Accept: application/json' \\\n  -d '{\"qty\":2}'",
    );
    expect(result.request.method).toBe("POST");
    expect(result.request.url).toBe("https://api.example.test/orders");
    expect(result.request.headers[0]).toEqual({ name: "Accept", value: "application/json" });
    expect(result.request.body).toBe('{"qty":2}');
  });

  it("handles double quotes with escapes and a leading shell prompt", () => {
    const result = expectOk('$ curl "https://x.test/path" -H "X-Note: say \\"hi\\""');
    expect(result.request.url).toBe("https://x.test/path");
    expect(result.request.headers[0]).toEqual({ name: "X-Note", value: 'say "hi"' });
  });
});

describe("parseCurlCommand — unsupported options", () => {
  it("warns on unsupported flags without crashing or losing the request", () => {
    const result = expectOk(
      "curl --compressed -F 'file=@photo.png' --proxy http://p.test:8080 -k -L https://x.test",
    );
    expect(result.request.url).toBe("https://x.test");
    expect(result.warnings.length).toBeGreaterThanOrEqual(4);
    expect(result.warnings.join(" ")).toContain("multipart");
    expect(result.warnings.join(" ")).toContain("proxies");
  });

  it("skips @file bodies with a warning", () => {
    const result = expectOk("curl https://x.test -d @payload.json");
    expect(result.request.body).toBe("");
    expect(result.warnings.join(" ")).toContain("@payload.json");
  });

  it("warns on unknown flags and unsupported methods", () => {
    const result = expectOk("curl --wat -X HEAD https://x.test");
    expect(result.warnings.join(" ")).toContain("--wat");
    expect(result.warnings.join(" ")).toContain("HEAD");
    expect(result.request.method).toBe("GET");
  });
});

describe("parseCurlCommand — failures", () => {
  it("rejects input that is not a curl command", () => {
    const result = parseCurlCommand("wget https://x.test");
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects empty input", () => {
    expect(parseCurlCommand("   ")).toMatchObject({ ok: false });
  });

  it("rejects unterminated quotes", () => {
    const result = parseCurlCommand("curl 'https://x.test");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("quote");
  });

  it("rejects commands without a URL", () => {
    const result = parseCurlCommand("curl -X POST -H 'A: b'");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("URL");
  });
});

describe("parseCurlCommand — sensitive headers", () => {
  it("flags Authorization, Cookie, X-API-Key, and bearer-like values", () => {
    const result = expectOk(
      "curl https://x.test -H 'Authorization: Bearer abc123' -H 'Cookie: sid=1' -H 'X-API-Key: k' -H 'X-Custom: Bearer tok'",
    );
    expect(result.sensitiveHeaders).toEqual([
      "Authorization",
      "Cookie",
      "X-API-Key",
      "X-Custom",
    ]);
  });

  it("does not flag ordinary headers", () => {
    const result = expectOk("curl https://x.test -H 'Accept: application/json'");
    expect(result.sensitiveHeaders).toEqual([]);
  });
});
