import { useState } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "../common/LogoMark";
import { Button } from "../common/Button";
import { Panel } from "../common/Panel";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { ErrorDialog } from "../common/ErrorDialog";
import { useAppStore } from "../../state/appStore";
import { useNotebookStore } from "../../state/notebookStore";
import { ensurePnbExtension, fileNameFromPath } from "../../lib/paths";
import { describeError, type UserFacingError } from "../../lib/errors";
import { IpcError } from "../../ipc/invoke";

const PNB_FILTERS = [{ name: "PHP Notebook", extensions: ["pnb.json"] }];

type PendingDialog = "none" | "discard" | "conflict" | "fileMissing";

export function NotebookShell() {
  const setView = useAppStore((s) => s.setView);
  const notebook = useNotebookStore((s) => s.notebook);
  const path = useNotebookStore((s) => s.path);
  const dirty = useNotebookStore((s) => s.dirty);
  const { save, forceSave, saveAs, setTitle, close } = useNotebookStore();

  const [pending, setPending] = useState<PendingDialog>("none");
  const [error, setError] = useState<UserFacingError | null>(null);

  if (!notebook) return null;

  async function saveAsFlow() {
    const chosen = await saveDialog({
      title: "Save notebook as",
      defaultPath: path ? fileNameFromPath(path) : "Untitled.pnb.json",
      filters: PNB_FILTERS,
    });
    if (!chosen) return;
    try {
      await saveAs(ensurePnbExtension(chosen));
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function handleSave() {
    try {
      await save();
    } catch (e) {
      if (e instanceof IpcError && e.command === "save_notebook") {
        if (e.code === "conflictOnDisk") {
          setPending("conflict");
          return;
        }
        if (e.code === "fileNotFound") {
          setPending("fileMissing");
          return;
        }
      }
      setError(describeError(e));
    }
  }

  function handleBack() {
    if (dirty) {
      setPending("discard");
      return;
    }
    close();
    setView("home");
  }

  return (
    <main className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-1 border-b border-subtle px-4 py-3 md:px-6">
        <header className="flex flex-wrap items-center gap-2 md:gap-3">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft size={14} aria-hidden />
            <span className="hidden sm:inline">Home</span>
          </Button>
          <LogoMark size={24} />
          <input
            className="min-w-40 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-base font-semibold text-primary outline-none hover:border-subtle focus:border-default focus:bg-surface"
            value={notebook.title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Notebook title"
          />
          {dirty && (
            <span
              className="size-2 shrink-0 rounded-full bg-warning"
              role="status"
              aria-label="Unsaved changes"
              title="Unsaved changes"
            >
              <span className="sr-only">Unsaved changes</span>
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button onClick={() => void saveAsFlow()}>Save As…</Button>
            <Button variant="primary" onClick={() => void handleSave()}>
              Save
            </Button>
          </div>
        </header>
        <p className="truncate font-mono text-xs text-muted">{path}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <Panel variant="subtle" dashed className="mx-auto max-w-xl p-8 text-muted">
          <p>
            This notebook has no cells yet. Markdown, PHP, and HTTP cells arrive with
            the next slice.
          </p>
        </Panel>
      </div>

      <ConfirmDialog
        open={pending === "discard"}
        title="Discard unsaved changes?"
        message="This notebook has unsaved changes. Leaving now will discard them."
        confirmLabel="Discard changes"
        cancelLabel="Stay"
        danger
        onConfirm={() => {
          setPending("none");
          close();
          setView("home");
        }}
        onCancel={() => setPending("none")}
      />

      <ConfirmDialog
        open={pending === "conflict"}
        title="File changed on disk"
        message="Another program modified this notebook file since it was opened. Overwrite it with your version?"
        confirmLabel="Overwrite"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {
          setPending("none");
          void forceSave().catch((e) => setError(describeError(e)));
        }}
        onCancel={() => setPending("none")}
      />

      <ConfirmDialog
        open={pending === "fileMissing"}
        title="Notebook file was moved or deleted"
        message="The original file no longer exists at its path. Save your work to a new location?"
        confirmLabel="Save As…"
        cancelLabel="Cancel"
        onConfirm={() => {
          setPending("none");
          void saveAsFlow();
        }}
        onCancel={() => setPending("none")}
      />

      <ErrorDialog error={error} onClose={() => setError(null)} />
    </main>
  );
}
