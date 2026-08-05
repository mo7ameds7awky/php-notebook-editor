import { useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useAppStore } from "../../state/appStore";
import { describeError, type UserFacingError } from "../../lib/errors";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { ErrorDialog } from "./ErrorDialog";

const STATUS_LABEL: Record<string, string> = {
  dockerNotInstalled: "Docker not installed",
  daemonNotRunning: "Docker not running",
  imageMissing: "PHP image missing",
};

/** Warns when the PHP runtime is unhealthy: status, detail, remedy, and an
 *  in-app pull action for a missing image. Renders nothing while healthy. */
export function RuntimeHealthBanner() {
  const health = useAppStore((s) => s.runtimeHealth);
  const pulling = useAppStore((s) => s.pullingImage);
  const refreshRuntimeHealth = useAppStore((s) => s.refreshRuntimeHealth);
  const pullImage = useAppStore((s) => s.pullImage);

  const [error, setError] = useState<UserFacingError | null>(null);

  if (!health || health.status === "ok") return null;

  return (
    <div
      role="status"
      className="mx-auto mb-4 flex w-full max-w-3xl min-w-0 flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2"
    >
      <Badge tone="warning">{STATUS_LABEL[health.status] ?? "PHP runtime problem"}</Badge>
      <span className="min-w-0 flex-1 break-words text-xs text-secondary">
        {health.detail} <span className="text-primary">{health.remedy}</span>
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {health.status === "imageMissing" && (
          <Button
            size="sm"
            onClick={() => void pullImage().catch((e) => setError(describeError(e)))}
            disabled={pulling}
            aria-label="Pull PHP image"
          >
            {pulling ? (
              <Loader2 size={12} className="animate-spin" aria-hidden />
            ) : (
              <Download size={12} aria-hidden />
            )}
            {pulling ? "Pulling…" : "Pull image"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refreshRuntimeHealth()}
          disabled={pulling}
          aria-label="Re-check PHP runtime"
        >
          <RefreshCw size={12} aria-hidden />
          Re-check
        </Button>
      </div>
      <ErrorDialog error={error} onClose={() => setError(null)} />
    </div>
  );
}
