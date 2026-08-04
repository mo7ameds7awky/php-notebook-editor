import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InterpolatedTextPreview } from "./InterpolatedTextPreview";
import { useNotebookStore } from "../../state/notebookStore";
import type { EnvVar, Notebook } from "../../types/notebook";

vi.mock("../../ipc", () => ({
  loadNotebook: vi.fn(),
  saveNotebook: vi.fn(),
  runHttp: vi.fn(),
  cancelRun: vi.fn(),
}));

const seed = (envVars: EnvVar[]) => {
  const notebook: Notebook = { schemaVersion: 1, title: "T", cells: [], envVars };
  useNotebookStore.setState({
    notebook,
    path: "/x/t.pnb.json",
    fileMtimeMs: 1,
    dirty: false,
    cellRuns: {},
  });
};

beforeEach(() => {
  seed([
    { name: "base_url", value: "https://api.test", secret: false },
    { name: "token", value: "secret-123", secret: true },
  ]);
});

describe("InterpolatedTextPreview", () => {
  it("shows a resolved chip with a name = value tooltip for non-secret variables", () => {
    render(<InterpolatedTextPreview text="{{base_url}}/users" />);
    const chip = screen.getByText("{{base_url}}");
    expect(chip).toHaveAttribute("title", "base_url = https://api.test");
    expect(chip.className).toContain("text-info");
  });

  it("shows a missing chip with a not-defined tooltip", () => {
    render(<InterpolatedTextPreview text="{{missing}}" />);
    const chip = screen.getByText("{{missing}}");
    expect(chip).toHaveAttribute("title", "missing is not defined");
    expect(chip.className).toContain("text-warning");
  });

  it("masks secret variables in the tooltip and never renders the value", () => {
    const { container } = render(<InterpolatedTextPreview text="{{token}}" />);
    const chip = screen.getByText("{{token}}");
    expect(chip).toHaveAttribute("title", "token = •••••••• Secret");
    expect(chip.className).toContain("text-info");
    expect(container.innerHTML).not.toContain("secret-123");
  });

  it("renders nothing when the text has no valid placeholder", () => {
    const { container } = render(
      <InterpolatedTextPreview text="plain {{1bad}} {{ spaced }} {{" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders adjacent and repeated tokens as separate chips", () => {
    render(<InterpolatedTextPreview text="{{base_url}}{{base_url}}{{missing}}" />);
    expect(screen.getAllByText("{{base_url}}")).toHaveLength(2);
    expect(screen.getByText("{{missing}}")).toBeInTheDocument();
  });

  it("keeps literal text around tokens visible", () => {
    render(<InterpolatedTextPreview text="GET {{base_url}}/users" />);
    expect(screen.getByText("/users")).toBeInTheDocument();
  });
});
