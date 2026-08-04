import { Fragment, useState } from "react";
import type { Cell, CellType } from "../../types/notebook";
import { useNotebookStore } from "../../state/notebookStore";
import { CellView } from "../cells/CellView";
import { AddCellDivider } from "./AddCellDivider";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { Button } from "../common/Button";
import { Panel } from "../common/Panel";

const NO_CELLS: Cell[] = [];

/** Ordered cell list with insert points, reorder/delete controls, and empty state. */
export function CellList() {
  const cells = useNotebookStore((s) => s.notebook?.cells ?? NO_CELLS);
  const addCell = useNotebookStore((s) => s.addCell);
  const deleteCell = useNotebookStore((s) => s.deleteCell);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const add = (type: CellType, index: number) => addCell(type, index);

  if (cells.length === 0) {
    return (
      <Panel variant="subtle" dashed className="mx-auto max-w-xl p-8 text-center">
        <p className="mb-4 text-[13px] text-muted">
          This notebook has no cells yet. Add your first one:
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button className="text-cell-markdown" onClick={() => add("markdown", 0)}>
            Markdown
          </Button>
          <Button className="text-cell-php" onClick={() => add("php", 0)}>
            PHP
          </Button>
          <Button className="text-cell-http" onClick={() => add("http", 0)}>
            HTTP
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col">
      {cells.map((cell, index) => (
        <Fragment key={cell.id}>
          <AddCellDivider index={index} onAdd={add} />
          <CellView
            cell={cell}
            index={index}
            count={cells.length}
            onRequestDelete={setPendingDelete}
          />
        </Fragment>
      ))}
      <AddCellDivider index={cells.length} onAdd={add} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this cell?"
        message="The cell and its content will be removed from the notebook."
        confirmLabel="Delete cell"
        cancelLabel="Keep"
        danger
        onConfirm={() => {
          if (pendingDelete) deleteCell(pendingDelete);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
