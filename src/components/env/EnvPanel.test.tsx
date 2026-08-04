import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvPanel } from "./EnvPanel";
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

const storeVars = () => useNotebookStore.getState().notebook?.envVars ?? [];

async function renderExpanded() {
  const user = userEvent.setup();
  render(<EnvPanel />);
  await user.click(screen.getByRole("button", { name: /environment variables/i }));
  return user;
}

beforeEach(() => {
  seed([]);
});

describe("EnvPanel", () => {
  it("masks secret values by default and reveals only on explicit action", async () => {
    seed([{ name: "token", value: "secret-123", secret: true }]);
    const user = await renderExpanded();

    const valueInput = screen.getByLabelText("Variable token value");
    expect(valueInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Reveal value of token" }));
    expect(screen.getByLabelText("Variable token value")).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Conceal value of token" }));
    expect(screen.getByLabelText("Variable token value")).toHaveAttribute("type", "password");
  });

  it("shows non-secret values as plain text without a reveal control", async () => {
    seed([{ name: "base_url", value: "https://api.test", secret: false }]);
    await renderExpanded();
    expect(screen.getByLabelText("Variable base_url value")).toHaveAttribute("type", "text");
    expect(screen.queryByRole("button", { name: /reveal value/i })).toBeNull();
  });

  it("adds a variable and clears the form", async () => {
    const user = await renderExpanded();
    await user.type(screen.getByLabelText("New variable name"), "base_url");
    await user.type(screen.getByLabelText("New variable value"), "https://api.test");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(storeVars()).toEqual([
      { name: "base_url", value: "https://api.test", secret: false },
    ]);
    expect(screen.getByLabelText("New variable name")).toHaveValue("");
    expect(screen.getByLabelText("New variable value")).toHaveValue("");
  });

  it("rejects a duplicate name with an inline error and no store change", async () => {
    seed([{ name: "token", value: "a", secret: true }]);
    const user = await renderExpanded();
    await user.type(screen.getByLabelText("New variable name"), "token");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i);
    expect(storeVars()).toHaveLength(1);
  });

  it("rejects an invalid name with an inline error", async () => {
    const user = await renderExpanded();
    await user.type(screen.getByLabelText("New variable name"), "1bad");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/start with a letter/i);
    expect(storeVars()).toHaveLength(0);
  });

  it("commits a rename on blur", async () => {
    seed([{ name: "old_name", value: "v", secret: false }]);
    const user = await renderExpanded();
    const nameInput = screen.getByLabelText("Variable old_name name");
    await user.clear(nameInput);
    await user.type(nameInput, "new_name");
    await user.tab();

    expect(storeVars().map((v) => v.name)).toEqual(["new_name"]);
  });

  it("shows a row error when a rename collides and keeps the store unchanged", async () => {
    seed([
      { name: "a", value: "1", secret: false },
      { name: "b", value: "2", secret: false },
    ]);
    const user = await renderExpanded();
    const nameInput = screen.getByLabelText("Variable a name");
    await user.clear(nameInput);
    await user.type(nameInput, "b");
    await user.tab();

    expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i);
    expect(storeVars().map((v) => v.name)).toEqual(["a", "b"]);
  });

  it("deletes a variable row", async () => {
    seed([{ name: "token", value: "secret-123", secret: true }]);
    const user = await renderExpanded();
    await user.click(screen.getByRole("button", { name: "Delete variable token" }));
    expect(storeVars()).toEqual([]);
  });
});
