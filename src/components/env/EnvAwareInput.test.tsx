import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvAwareInput } from "./EnvAwareInput";
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

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <EnvAwareInput value={value} onChange={setValue} aria-label="URL" showPreview />;
}

const input = () => screen.getByRole("combobox", { name: "URL" }) as HTMLInputElement;

beforeEach(() => {
  seed([
    { name: "base_url", value: "https://api.test", secret: false },
    { name: "token", value: "secret-123", secret: true },
    { name: "abase", value: "w", secret: false },
  ]);
});

describe("EnvAwareInput autocomplete", () => {
  it("opens with every variable after typing {{", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(input(), "{{{{");

    expect(input()).toHaveAttribute("aria-expanded", "true");
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "abasew",
      "base_urlhttps://api.test",
      "tokenSecret",
    ]);
  });

  it("filters to matching variables for a fragment", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(input(), "{{{{ba");

    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["base_urlhttps://api.test", "abasew"]);
  });

  it("never shows a secret value in suggestions", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(input(), "{{{{to");

    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("token");
    expect(screen.queryByText(/secret-123/)).toBeNull();
  });

  it("inserts the highlighted variable with Enter and closes the list", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(input(), "{{{{ba");
    await user.keyboard("{Enter}");

    expect(input()).toHaveValue("{{base_url}}");
    expect(input().selectionStart).toBe("{{base_url}}".length);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("moves the selection with ArrowDown/ArrowUp and inserts with Tab", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(input(), "{{{{");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("base_url");

    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("token");

    await user.keyboard("{Tab}");
    expect(input()).toHaveValue("{{token}}");
  });

  it("keeps surrounding text and replaces only the active fragment", async () => {
    const user = userEvent.setup();
    render(<Harness initial="{{abase}}/v1" />);
    const el = input();
    await user.click(el);
    await user.keyboard("{End}");
    await user.type(el, "/{{{{ba");
    await user.keyboard("{Enter}");

    expect(el).toHaveValue("{{abase}}/v1/{{base_url}}");
  });

  it("closes on Escape without changing the value", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(input(), "{{{{ba");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input()).toHaveValue("{{ba");
    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("inserts on option click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(input(), "{{{{ab");
    await user.click(screen.getByRole("option", { name: /abase/ }));

    expect(input()).toHaveValue("{{abase}}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(input(), "{{{{zzz");

    expect(screen.getByText("No matching variables")).toBeInTheDocument();
  });

  it("does not open inside an already closed placeholder", async () => {
    const user = userEvent.setup();
    render(<Harness initial="{{base_url}}" />);
    const el = input();
    await user.click(el);
    await user.keyboard("{End}");
    await user.type(el, "x");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(el).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the floating preview only while the field is focused", async () => {
    const user = userEvent.setup();
    render(<Harness initial="{{base_url}}/{{missing}}" />);
    expect(screen.queryByText("{{base_url}}")).toBeNull();

    await user.click(input());
    expect(screen.getByText("{{base_url}}")).toHaveAttribute(
      "title",
      "base_url = https://api.test",
    );
    expect(screen.getByText("{{missing}}")).toHaveAttribute("title", "missing is not defined");

    await user.tab();
    expect(screen.queryByText("{{base_url}}")).toBeNull();
  });

  it("hides the preview while the suggestion list is open", async () => {
    const user = userEvent.setup();
    render(<Harness initial="{{base_url}}/" />);
    const el = input();
    await user.click(el);
    expect(screen.getByText("{{base_url}}")).toBeInTheDocument();

    await user.type(el, "{{{{");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.queryByText("{{base_url}}")).toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByText("{{base_url}}")).toBeInTheDocument();
  });
});
