import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { HomeScreen } from "./components/home/HomeScreen";
import { NotebookShell } from "./components/notebook/NotebookShell";
import { ConfirmDialog } from "./components/common/ConfirmDialog";
import { useAppStore } from "./state/appStore";
import { useNotebookStore } from "./state/notebookStore";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function App() {
  const view = useAppStore((s) => s.view);
  const notebook = useNotebookStore((s) => s.notebook);

  const [closeRequested, setCloseRequested] = useState(false);
  const allowClose = useRef(false);

  useEffect(() => {
    if (!isTauri) return;
    void useAppStore.getState().refreshRuntimeHealth();
  }, []);

  useEffect(() => {
    if (!isTauri) return;
    const win = getCurrentWindow();
    const unlisten = win.onCloseRequested((event) => {
      if (!allowClose.current && useNotebookStore.getState().dirty) {
        event.preventDefault();
        setCloseRequested(true);
      }
    });
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-app text-primary">
      {view === "notebook" && notebook ? <NotebookShell /> : <HomeScreen />}

      <ConfirmDialog
        open={closeRequested}
        title="Quit with unsaved changes?"
        message="This notebook has unsaved changes. Quitting now will discard them."
        confirmLabel="Discard and quit"
        cancelLabel="Stay"
        danger
        onConfirm={() => {
          allowClose.current = true;
          void getCurrentWindow().close();
        }}
        onCancel={() => setCloseRequested(false)}
      />
    </div>
  );
}

export default App;
