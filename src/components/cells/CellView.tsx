import type { Cell } from "../../types/notebook";
import { useNotebookStore } from "../../state/notebookStore";
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

  function body() {
    switch (cell.type) {
      case "markdown":
        return (
          <MarkdownCell cell={cell} onChangeSource={(s) => updateCellSource(cell.id, s)} />
        );
      case "php":
        return <PhpCell cell={cell} onChangeSource={(s) => updateCellSource(cell.id, s)} />;
      case "http":
        return <HttpCell cell={cell} onChangeRequest={(r) => updateHttpRequest(cell.id, r)} />;
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
    </CellFrame>
  );
}
