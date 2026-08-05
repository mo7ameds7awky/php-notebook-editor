import { Play, Square } from "lucide-react";
import type { PhpCell as PhpCellModel } from "../../types/notebook";
import { CodeEditor } from "../common/CodeEditor";
import { Button } from "../common/Button";
import { PhpResultView } from "./PhpResultView";

interface PhpCellProps {
  cell: PhpCellModel;
  onChangeSource: (source: string) => void;
  running: boolean;
  onRun: () => void;
  onCancel: () => void;
  /** Runtime-health gate for running only; authoring is never gated. */
  canRun: boolean;
  runDisabledReason?: string;
}

/** PHP authoring and sandboxed execution: editor, run/cancel, result view. */
export function PhpCell({
  cell,
  onChangeSource,
  running,
  onRun,
  onCancel,
  canRun,
  runDisabledReason,
}: PhpCellProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <Button size="sm" onClick={onCancel} aria-label="Cancel PHP run">
            <Square size={12} aria-hidden />
            Cancel
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={onRun}
            disabled={!canRun}
            title={canRun ? undefined : runDisabledReason}
            aria-label="Run PHP cell"
          >
            <Play size={12} aria-hidden />
            Run
          </Button>
        )}
        {!running && !canRun && runDisabledReason && (
          <span className="text-xs text-warning">{runDisabledReason}</span>
        )}
      </div>

      <CodeEditor
        value={cell.source}
        language="php"
        onChange={onChangeSource}
        ariaLabel="PHP source"
      />

      <PhpResultView lastRun={cell.lastRun} running={running} />
    </>
  );
}
