import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PhpResultView } from "./PhpResultView";
import type { PhpRunResult } from "../../types/notebook";

const result = (partial: Partial<PhpRunResult>): PhpRunResult => ({
  status: "succeeded",
  stdout: "",
  stderr: "",
  exitCode: 0,
  truncated: false,
  durationMs: 12,
  ranAt: "2026-08-05T10:00:00Z",
  ...partial,
});

describe("PhpResultView", () => {
  it("shows a running state", () => {
    render(<PhpResultView lastRun={null} running />);
    expect(screen.getByText(/Running in sandbox/)).toBeInTheDocument();
  });

  it("shows a placeholder before the first run", () => {
    render(<PhpResultView lastRun={null} running={false} />);
    expect(screen.getByText(/No output yet/)).toBeInTheDocument();
  });

  it("renders stdout for a succeeded run with its duration", () => {
    render(
      <PhpResultView lastRun={result({ stdout: "hello from sandbox" })} running={false} />,
    );
    expect(screen.getByLabelText("Standard output")).toHaveTextContent("hello from sandbox");
    expect(screen.getByText("Succeeded")).toBeInTheDocument();
    expect(screen.getByText("12 ms")).toBeInTheDocument();
  });

  it("renders stderr distinctly for a failed run", () => {
    render(
      <PhpResultView
        lastRun={result({
          status: "failed",
          stdout: "partial",
          stderr: "Fatal error: boom",
          exitCode: 255,
        })}
        running={false}
      />,
    );
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByLabelText("Error output")).toHaveTextContent("Fatal error: boom");
    expect(screen.getByLabelText("Standard output")).toHaveTextContent("partial");
    expect(screen.getByText("exit 255")).toBeInTheDocument();
  });

  it("labels a termination with its cause", () => {
    render(
      <PhpResultView
        lastRun={result({
          status: "terminated",
          terminationReason: "timeout",
          exitCode: null,
        })}
        running={false}
      />,
    );
    expect(screen.getByText(/Terminated · time limit/)).toBeInTheDocument();
  });

  it("shows the memory cause and the truncation badge", () => {
    render(
      <PhpResultView
        lastRun={result({
          status: "terminated",
          terminationReason: "memory",
          truncated: true,
          exitCode: null,
        })}
        running={false}
      />,
    );
    expect(screen.getByText(/Terminated · memory limit/)).toBeInTheDocument();
    expect(screen.getByText("Truncated")).toBeInTheDocument();
  });

  it("notes when a run produced no output at all", () => {
    render(<PhpResultView lastRun={result({})} running={false} />);
    expect(screen.getByText("(no output)")).toBeInTheDocument();
  });
});
