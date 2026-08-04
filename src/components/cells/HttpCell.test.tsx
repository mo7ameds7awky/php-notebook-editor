import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpCell } from "./HttpCell";
import { useNotebookStore } from "../../state/notebookStore";
import type { EnvVar, HttpCell as HttpCellModel, Notebook } from "../../types/notebook";

vi.mock("../../ipc", () => ({
  loadNotebook: vi.fn(),
  saveNotebook: vi.fn(),
  runHttp: vi.fn(),
  cancelRun: vi.fn(),
}));

vi.mock("../common/CodeEditor", () => ({
  CodeEditor: ({ value, ariaLabel }: { value: string; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} readOnly />
  ),
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

const cell = (request: Partial<HttpCellModel["request"]>): HttpCellModel => ({
  id: "http-1",
  type: "http",
  request: {
    method: "GET",
    url: "",
    headers: [],
    body: "",
    timeoutMs: 30_000,
    ...request,
  },
});

const noop = () => undefined;

function Harness({ initial }: { initial: HttpCellModel }) {
  const [model, setModel] = useState(initial);
  return (
    <HttpCell
      cell={model}
      onChangeRequest={(request) => setModel((m) => ({ ...m, request }))}
      running={false}
      onRun={noop}
      onCancel={noop}
    />
  );
}

const renderCell = (model: HttpCellModel) => render(<Harness initial={model} />);

beforeEach(() => {
  seed([
    { name: "base_url", value: "https://api.test", secret: false },
    { name: "token", value: "secret-123", secret: true },
  ]);
});

describe("HttpCell env integration", () => {
  it("previews placeholder status for url, header values, and body without leaking secrets", () => {
    const { container } = renderCell(
      cell({
        url: "{{base_url}}/users/{{missing}}",
        headers: [{ name: "Authorization", value: "Bearer {{token}}" }],
        body: '{"t":"{{token}}"}',
      }),
    );

    expect(screen.getByText("{{base_url}}")).toHaveAttribute(
      "title",
      "base_url = https://api.test",
    );
    expect(screen.getByText("{{missing}}")).toHaveAttribute("title", "missing is not defined");
    for (const chip of screen.getAllByText("{{token}}")) {
      expect(chip).toHaveAttribute("title", "token = •••••••• Secret");
    }
    expect(container.innerHTML).not.toContain("secret-123");
  });

  it("offers env suggestions in the URL field", async () => {
    const user = userEvent.setup();
    renderCell(cell({ url: "" }));

    await user.type(screen.getByRole("combobox", { name: "Request URL" }), "{{{{ba");
    const listbox = screen.getByRole("listbox", { name: "Environment variable suggestions" });
    expect(within(listbox).getByRole("option", { selected: true })).toHaveTextContent("base_url");
  });

  it("offers env suggestions in header value fields", async () => {
    const user = userEvent.setup();
    renderCell(cell({ headers: [{ name: "Authorization", value: "" }] }));

    await user.type(screen.getByRole("combobox", { name: "Header 1 value" }), "{{{{to");
    const listbox = screen.getByRole("listbox", { name: "Environment variable suggestions" });
    const option = within(listbox).getByRole("option", { selected: true });
    expect(option).toHaveTextContent("token");
    expect(option.textContent).not.toContain("secret-123");
  });
});
