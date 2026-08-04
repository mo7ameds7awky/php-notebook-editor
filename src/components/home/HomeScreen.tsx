import { useEffect, useState } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Plus } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "../../theme/appIdentity";
import { LogoMark } from "../common/LogoMark";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { ErrorDialog } from "../common/ErrorDialog";
import { useAppStore } from "../../state/appStore";
import { useNotebookStore } from "../../state/notebookStore";
import { ensurePnbExtension, titleFromPath } from "../../lib/paths";
import { describeError, type UserFacingError } from "../../lib/errors";
import { IpcError } from "../../ipc/invoke";

const PNB_FILTERS = [{ name: "PHP Notebook", extensions: ["pnb.json"] }];

export function HomeScreen() {
  const { recents, setView, refreshRecents, removeRecentEntry } = useAppStore();
  const createNew = useNotebookStore((s) => s.createNew);
  const openFromPath = useNotebookStore((s) => s.openFromPath);

  const [error, setError] = useState<UserFacingError | null>(null);
  const [missingPath, setMissingPath] = useState<string | null>(null);

  useEffect(() => {
    void refreshRecents().catch(() => undefined);
  }, [refreshRecents]);

  async function openPath(path: string, fromRecents: boolean) {
    try {
      await openFromPath(path);
      setView("notebook");
      void refreshRecents().catch(() => undefined);
    } catch (e) {
      if (fromRecents && e instanceof IpcError && e.code === "fileNotFound") {
        setMissingPath(path);
        return;
      }
      setError(describeError(e));
    }
  }

  async function handleCreate() {
    const chosen = await saveDialog({
      title: "Create notebook",
      defaultPath: "Untitled.pnb.json",
      filters: PNB_FILTERS,
    });
    if (!chosen) return;
    const path = ensurePnbExtension(chosen);
    try {
      await createNew(path, titleFromPath(path));
      setView("notebook");
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function handleOpen() {
    const chosen = await openDialog({
      title: "Open notebook",
      multiple: false,
      filters: PNB_FILTERS,
    });
    if (typeof chosen !== "string") return;
    await openPath(chosen, false);
  }

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 md:gap-8 md:p-8">
        <header className="flex min-w-0 items-center gap-3">
          <LogoMark size={40} />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">
              {APP_NAME}
            </h1>
            <p className="truncate text-[13px] text-secondary">{APP_TAGLINE}</p>
          </div>
        </header>

        <section className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => void handleCreate()}>
            <Plus size={14} aria-hidden />
            New Notebook
          </Button>
          <Button onClick={() => void handleOpen()}>
            <FolderOpen size={14} aria-hidden />
            Open Notebook…
          </Button>
        </section>

        <section className="min-w-0">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Recent notebooks
          </h2>
          {recents.length === 0 ? (
            <p className="text-[13px] text-muted">
              Nothing yet — create or open a notebook to get started.
            </p>
          ) : (
            <ul className="grid list-none grid-cols-1 gap-2 p-0 lg:grid-cols-2 2xl:grid-cols-3">
              {recents.map((entry) => (
                <li key={entry.path} className="min-w-0">
                  <button
                    type="button"
                    className="flex w-full min-w-0 cursor-pointer flex-col gap-0.5 rounded-md border border-subtle bg-surface p-3 text-left font-sans hover:border-default hover:bg-elevated"
                    onClick={() => void openPath(entry.path, true)}
                  >
                    <span className="truncate text-sm font-medium text-primary">
                      {entry.title}
                    </span>
                    <span className="truncate font-mono text-xs text-muted">
                      {entry.path}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={missingPath !== null}
        title="Notebook file missing"
        message={`The file no longer exists at:\n${missingPath ?? ""}\n\nRemove it from recent notebooks?`}
        confirmLabel="Remove entry"
        cancelLabel="Keep"
        danger
        onConfirm={() => {
          if (missingPath) void removeRecentEntry(missingPath);
          setMissingPath(null);
        }}
        onCancel={() => setMissingPath(null)}
      />

      <ErrorDialog error={error} onClose={() => setError(null)} />
    </main>
  );
}
