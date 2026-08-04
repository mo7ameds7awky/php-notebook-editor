import { Loader2 } from "lucide-react";
import type { HttpRunResult } from "../../types/notebook";
import { Badge, type BadgeTone } from "../common/Badge";

function statusTone(statusCode: number): BadgeTone {
  if (statusCode >= 500) return "danger";
  if (statusCode >= 400) return "warning";
  if (statusCode >= 300) return "info";
  return "success";
}

const FAILURE_LABEL: Record<string, string> = {
  network: "Network failure",
  timeout: "Timed out",
  cancelled: "Cancelled",
  invalidRequest: "Invalid request",
};

const FAILURE_TONE: Record<string, BadgeTone> = {
  network: "danger",
  timeout: "warning",
  cancelled: "neutral",
  invalidRequest: "danger",
};

interface HttpResultViewProps {
  lastRun: HttpRunResult | null | undefined;
  running: boolean;
}

/** Renders the latest HTTP run: response with status, or a transport failure. */
export function HttpResultView({ lastRun, running }: HttpResultViewProps) {
  if (running) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-subtle bg-subtle px-3 py-2 text-xs text-secondary">
        <Loader2 size={13} className="animate-spin text-info" aria-hidden />
        Running…
      </div>
    );
  }

  if (!lastRun) {
    return (
      <div className="rounded-md border border-dashed border-subtle bg-subtle px-3 py-2 text-xs text-muted">
        No response yet — run the request.
      </div>
    );
  }

  if (lastRun.status !== "succeeded" || !lastRun.response) {
    const kind = lastRun.error?.kind ?? "network";
    return (
      <div className="flex min-w-0 flex-col gap-1.5 rounded-md border border-subtle bg-subtle p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={FAILURE_TONE[kind] ?? "danger"}>{FAILURE_LABEL[kind] ?? "Failed"}</Badge>
          <span className="text-xs text-muted">
            transport failure — no HTTP response · {lastRun.durationMs} ms
          </span>
        </div>
        {lastRun.error?.message && (
          <p className="break-words font-mono text-xs text-secondary">{lastRun.error.message}</p>
        )}
      </div>
    );
  }

  const { response } = lastRun;
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-subtle bg-subtle p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(response.statusCode)}>HTTP {response.statusCode}</Badge>
        <span className="text-xs text-muted">{lastRun.durationMs} ms</span>
        {response.bodyTruncated && <Badge tone="warning">Truncated</Badge>}
      </div>

      {response.headers.length > 0 && (
        <details className="min-w-0 text-xs">
          <summary className="cursor-pointer select-none text-secondary">
            Headers ({response.headers.length})
          </summary>
          <ul className="mt-1.5 flex list-none flex-col gap-0.5 p-0 font-mono text-muted">
            {response.headers.map((header, index) => (
              <li key={index} className="break-all">
                <span className="text-secondary">{header.name}</span>: {header.value}
              </li>
            ))}
          </ul>
        </details>
      )}

      <pre className="max-h-80 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md bg-code-bg p-3 text-xs">
        {response.body === "" ? <span className="text-muted">(empty body)</span> : response.body}
      </pre>
    </div>
  );
}
