import { useState } from "react";
import type { Cell } from "../../types/notebook";
import { useNotebookStore } from "../../state/notebookStore";
import { useAppStore } from "../../state/appStore";
import { describeError, type UserFacingError } from "../../lib/errors";
import { IpcError } from "../../ipc/invoke";
import { ErrorDialog } from "../common/ErrorDialog";
import { CellFrame } from "./CellFrame";
import { MarkdownCell } from "./MarkdownCell";
import { PhpCell } from "./PhpCell";
import { HttpCell } from "./HttpCell";

interface CellViewProps {
  cell: Cell;
  index: number;
  count: number;
  onRequestDelete: (id: string) => void;
}

/** Discriminated cell renderer: picks the body by cell type inside the shared frame. */
export function CellView({ cell, index, count, onRequestDelete }: CellViewProps) {
  const moveCell = useNotebookStore((s) => s.moveCell);
  const updateCellSource = useNotebookStore((s) => s.updateCellSource);
  const updateHttpRequest = useNotebookStore((s) => s.updateHttpRequest);
  const startHttpRun = useNotebookStore((s) => s.startHttpRun);
  const startPhpRun = useNotebookStore((s) => s.startPhpRun);
  const cancelCellRun = useNotebookStore((s) => s.cancelCellRun);
  const running = useNotebookStore((s) => s.cellRuns[cell.id] !== undefined);
  const runtimeHealth = useAppStore((s) => s.runtimeHealth);

  const [runError, setRunError] = useState<UserFacingError | null>(null);

  function handlePhpRunError(e: unknown) {
    setRunError(describeError(e));
    // A run-time probe failure means the banner state is stale — resync it.
    if (e instanceof IpcError && e.code === "runtimeUnavailable") {
      void useAppStore.getState().refreshRuntimeHealth();
    }
  }

  function body() {
    switch (cell.type) {
      case "markdown":
        return (
          <MarkdownCell cell={cell} onChangeSource={(s) => updateCellSource(cell.id, s)} />
        );
      case "php":
        return (
          <PhpCell
            cell={cell}
            onChangeSource={(s) => updateCellSource(cell.id, s)}
            running={running}
            onRun={() => void startPhpRun(cell.id).catch(handlePhpRunError)}
            onCancel={() => cancelCellRun(cell.id)}
            canRun={runtimeHealth?.status === "ok"}
            runDisabledReason={
              runtimeHealth === null
                ? "Checking the PHP runtime…"
                : runtimeHealth.status !== "ok"
                  ? "PHP runtime unavailable — see the banner above."
                  : undefined
            }
          />
        );
      case "http":
        return (
          <HttpCell
            cell={cell}
            onChangeRequest={(r) => updateHttpRequest(cell.id, r)}
            running={running}
            onRun={() => void startHttpRun(cell.id).catch((e) => setRunError(describeError(e)))}
            onCancel={() => cancelCellRun(cell.id)}
          />
        );
      default: {
        const exhaustive: never = cell;
        return exhaustive;
      }
    }
  }

  return (
    <CellFrame
      type={cell.type}
      canMoveUp={index > 0}
      canMoveDown={index < count - 1}
      onMoveUp={() => moveCell(cell.id, "up")}
      onMoveDown={() => moveCell(cell.id, "down")}
      onDelete={() => onRequestDelete(cell.id)}
    >
      {body()}
      <ErrorDialog error={runError} onClose={() => setRunError(null)} />
    </CellFrame>
  );
}
