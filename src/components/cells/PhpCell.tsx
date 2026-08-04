import type { PhpCell as PhpCellModel } from "../../types/notebook";
import { CodeEditor } from "../common/CodeEditor";

interface PhpCellProps {
  cell: PhpCellModel;
  onChangeSource: (source: string) => void;
}

/** PHP authoring: source editor plus a placeholder result section. */
export function PhpCell({ cell, onChangeSource }: PhpCellProps) {
  return (
    <>
      <CodeEditor
        value={cell.source}
        language="php"
        onChange={onChangeSource}
        ariaLabel="PHP source"
      />
      <div className="rounded-md border border-dashed border-subtle bg-subtle px-3 py-2 text-xs text-muted">
        Output appears here once PHP execution lands.
      </div>
    </>
  );
}
