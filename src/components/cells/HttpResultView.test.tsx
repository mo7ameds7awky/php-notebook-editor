import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HttpResultView } from "./HttpResultView";
import type { HttpRequestSpec, HttpRunResult } from "../../types/notebook";

const request = (partial: Partial<HttpRequestSpec> = {}): HttpRequestSpec => ({
  method: "GET",
  url: "{{base_url}}/users",
  headers: [],
  body: "",
  timeoutMs: 30_000,
  ...partial,
});

const succeeded = (partial: Partial<HttpRunResult["response"] & object> = {}): HttpRunResult => ({
  status: "succeeded",
  response: {
    statusCode: 200,
    headers: [{ name: "Content-Type", value: "application/json; charset=utf-8" }],
    body: '{"ok":true}',
    bodyTruncated: false,
    ...partial,
  },
  durationMs: 123,
  ranAt: "2026-08-05T19:00:00.000Z",
});

const failed = (kind: "network" | "timeout" | "cancelled" | "invalidRequest"): HttpRunResult => ({
  status: kind === "cancelled" ? "cancelled" : "failed",
  error: { kind, message: "raw transport detail" },
  durationMs: 45,
  ranAt: "2026-08-05T19:00:00.000Z",
});

describe("HttpResultView metadata summary", () => {
  it("shows method, authored URL with placeholders, duration, size, type, and timestamp", () => {
    render(<HttpResultView request={request()} lastRun={succeeded()} running={false} />);

    expect(screen.getByText("GET")).toBeInTheDocument();
    expect(screen.getByText("{{base_url}}/users")).toHaveAttribute(
      "title",
      "{{base_url}}/users",
    );
    expect(screen.getByText(/123 ms · 11 B · application\/json/)).toBeInTheDocument();
    expect(screen.getByTitle("2026-08-05T19:00:00.000Z")).toBeInTheDocument();
  });

  it("labels the status with its reason phrase and keeps the raw body visible", () => {
    render(<HttpResultView request={request()} lastRun={succeeded()} running={false} />);
    expect(screen.getByText("HTTP 200 OK")).toBeInTheDocument();
    expect(screen.getByText('{"ok":true}')).toBeInTheDocument();
  });

  it("renders 404 as an HTTP response with a static explanation, not a transport failure", () => {
    render(
      <HttpResultView
        request={request()}
        lastRun={succeeded({ statusCode: 404, body: "missing" })}
        running={false}
      />,
    );
    expect(screen.getByText("HTTP 404 Not Found")).toBeInTheDocument();
    expect(screen.getByText(/Nothing exists at this URL/)).toBeInTheDocument();
    expect(screen.queryByText(/transport failure/)).toBeNull();
    expect(screen.getByText("missing")).toBeInTheDocument();
  });

  it("renders 500 with the server-side explanation", () => {
    render(
      <HttpResultView
        request={request()}
        lastRun={succeeded({ statusCode: 500, body: "boom" })}
        running={false}
      />,
    );
    expect(screen.getByText("HTTP 500 Internal Server Error")).toBeInTheDocument();
    expect(screen.getByText(/problem is on the server side/)).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("shows no explanation line for plain success", () => {
    render(<HttpResultView request={request()} lastRun={succeeded()} running={false} />);
    expect(screen.queryByText(/client-side|server-side|check the/i)).toBeNull();
  });

  it("keeps the truncation badge", () => {
    render(
      <HttpResultView
        request={request()}
        lastRun={succeeded({ bodyTruncated: true })}
        running={false}
      />,
    );
    expect(screen.getByText("Truncated")).toBeInTheDocument();
  });

  it("keeps the empty-body state", () => {
    render(
      <HttpResultView request={request()} lastRun={succeeded({ body: "" })} running={false} />,
    );
    expect(screen.getByText("(empty body)")).toBeInTheDocument();
  });
});

describe("HttpResultView transport failures", () => {
  it("renders network failures distinctly with the static explanation and summary", () => {
    render(<HttpResultView request={request()} lastRun={failed("network")} running={false} />);
    expect(screen.getByText("Network failure")).toBeInTheDocument();
    expect(screen.getByText(/transport failure — no HTTP response/)).toBeInTheDocument();
    expect(screen.getByText(/never got a response/)).toBeInTheDocument();
    expect(screen.getByText("GET")).toBeInTheDocument();
    expect(screen.getByText("{{base_url}}/users")).toBeInTheDocument();
    expect(screen.getByText("raw transport detail")).toBeInTheDocument();
    expect(screen.queryByText(/HTTP \d/)).toBeNull();
  });

  it("explains timeouts with the static copy", () => {
    render(<HttpResultView request={request()} lastRun={failed("timeout")} running={false} />);
    expect(screen.getByText("Timed out")).toBeInTheDocument();
    expect(screen.getByText(/ran past its timeout/)).toBeInTheDocument();
  });

  it("explains cancellation neutrally", () => {
    render(<HttpResultView request={request()} lastRun={failed("cancelled")} running={false} />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText(/cancelled before a response/)).toBeInTheDocument();
  });
});

describe("HttpResultView passive states", () => {
  it("shows the running state", () => {
    render(<HttpResultView request={request()} lastRun={null} running />);
    expect(screen.getByText(/Running…/)).toBeInTheDocument();
  });

  it("shows the empty placeholder before any run", () => {
    render(<HttpResultView request={request()} lastRun={null} running={false} />);
    expect(screen.getByText(/No response yet/)).toBeInTheDocument();
  });
});
