import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { CellType } from "../../types/notebook";
import { Button } from "../common/Button";

interface AddCellDividerProps {
  index: number;
  onAdd: (type: CellType, index: number) => void;
}

/** Insert point between cells: collapsed plus button expanding to a type picker. */
export function AddCellDivider({ index, onAdd }: AddCellDividerProps) {
  const [open, setOpen] = useState(false);

  function add(type: CellType) {
    onAdd(type, index);
    setOpen(false);
  }

  return (
    <div className="flex items-center justify-center gap-2 py-1">
      {open ? (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <Button size="sm" className="text-cell-markdown" onClick={() => add("markdown")}>
            Markdown
          </Button>
          <Button size="sm" className="text-cell-php" onClick={() => add("php")}>
            PHP
          </Button>
          <Button size="sm" className="text-cell-http" onClick={() => add("http")}>
            HTTP
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            aria-label="Cancel adding cell"
          >
            <X size={12} aria-hidden />
          </Button>
        </div>
      ) : (
        <>
          <span className="h-px flex-1 bg-(--pnb-border-subtle)" aria-hidden />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(true)}
            aria-label={`Add cell at position ${index + 1}`}
          >
            <Plus size={12} aria-hidden />
            Add cell
          </Button>
          <span className="h-px flex-1 bg-(--pnb-border-subtle)" aria-hidden />
        </>
      )}
    </div>
  );
}
