import { Loader2 } from "lucide-react";
import type { PhpRunResult } from "../../types/notebook";
import { Badge, type BadgeTone } from "../common/Badge";

const STATUS_LABEL: Record<PhpRunResult["status"], string> = {
  succeeded: "Succeeded",
  failed: "Failed",
  terminated: "Terminated",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<PhpRunResult["status"], BadgeTone> = {
  succeeded: "success",
  failed: "danger",
  terminated: "warning",
  cancelled: "neutral",
};

const REASON_LABEL: Record<string, string> = {
  timeout: "time limit",
  memory: "memory limit",
};

interface PhpResultViewProps {
  lastRun: PhpRunResult | null | undefined;
  running: boolean;
}

/** Renders the latest PHP run: status, duration, stdout, and visually distinct
 *  stderr. Output passes through exactly as the sandbox produced it. */
export function PhpResultView({ lastRun, running }: PhpResultViewProps) {
  if (running) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-subtle bg-subtle px-3 py-2 text-xs text-secondary">
        <Loader2 size={13} className="animate-spin text-info" aria-hidden />
        Running in sandbox…
      </div>
    );
  }

  if (!lastRun) {
    return (
      <div className="rounded-md border border-dashed border-subtle bg-subtle px-3 py-2 text-xs text-muted">
        No output yet — run the cell.
      </div>
    );
  }

  const hasOutput = lastRun.stdout !== "" || lastRun.stderr !== "";

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-subtle bg-subtle p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[lastRun.status]}>
          {STATUS_LABEL[lastRun.status]}
          {lastRun.status === "terminated" && lastRun.terminationReason
            ? ` · ${REASON_LABEL[lastRun.terminationReason] ?? lastRun.terminationReason}`
            : ""}
        </Badge>
        <span className="text-xs text-muted">{lastRun.durationMs} ms</span>
        {typeof lastRun.exitCode === "number" && lastRun.exitCode !== 0 && (
          <span className="text-xs text-muted">exit {lastRun.exitCode}</span>
        )}
        {lastRun.truncated && <Badge tone="warning">Truncated</Badge>}
      </div>

      {lastRun.stdout !== "" && (
        <pre
          aria-label="Standard output"
          className="max-h-80 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md bg-code-bg p-3 text-xs"
        >
          {lastRun.stdout}
        </pre>
      )}

      {lastRun.stderr !== "" && (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-danger">
            Errors
          </span>
          <pre
            aria-label="Error output"
            className="max-h-80 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md border border-danger/40 bg-code-bg p-3 text-xs text-danger"
          >
            {lastRun.stderr}
          </pre>
        </div>
      )}

      {!hasOutput && <p className="text-xs text-muted">(no output)</p>}
    </div>
  );
}
