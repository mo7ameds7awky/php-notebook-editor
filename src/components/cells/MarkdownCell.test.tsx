import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownCell } from "./MarkdownCell";
import type { MarkdownCell as MarkdownCellModel } from "../../types/notebook";

const cell = (source: string): MarkdownCellModel => ({
  id: "md-1",
  type: "markdown",
  source,
});

const noop = () => undefined;

describe("MarkdownCell preview", () => {
  it("renders script tags inert — never executed, never in the DOM as script", () => {
    const source = 'Before\n\n<script>window.__pwned = true;</script>\n\nAfter';
    const { container } = render(
      <MarkdownCell cell={cell(source)} onChangeSource={noop} defaultMode="preview" />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    expect(screen.getByText(/Before/)).toBeInTheDocument();
    expect(screen.getByText(/After/)).toBeInTheDocument();
  });

  it("strips raw HTML event handlers and iframes", () => {
    const source = '<img src="x" onerror="window.__pwned = true" />\n\n<iframe src="https://evil.test"></iframe>';
    const { container } = render(
      <MarkdownCell cell={cell(source)} onChangeSource={noop} defaultMode="preview" />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    const img = container.querySelector("img");
    if (img) expect(img.getAttribute("onerror")).toBeNull();
  });

  it("renders GFM tables and headings", () => {
    const source = "# Title\n\n| Col A | Col B |\n| --- | --- |\n| a1 | b1 |";
    render(<MarkdownCell cell={cell(source)} onChangeSource={noop} defaultMode="preview" />);
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("b1")).toBeInTheDocument();
  });

  it("shows an empty-preview hint for blank source", () => {
    render(<MarkdownCell cell={cell("  ")} onChangeSource={noop} defaultMode="preview" />);
    expect(screen.getByText(/Nothing to preview/)).toBeInTheDocument();
  });
});
