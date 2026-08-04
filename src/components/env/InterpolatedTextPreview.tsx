import type { EnvVar } from "../../types/notebook";
import { tokenizePlaceholders, type PlaceholderSegment } from "../../lib/interpolate";
import { useNotebookStore } from "../../state/notebookStore";

const NO_VARS: EnvVar[] = [];

const CHIP_CLASSES: Record<"resolved" | "missing", string> = {
  resolved: "border-info/40 bg-info/10 text-info",
  missing: "border-warning/40 bg-warning/10 text-warning",
};

function tooltipFor(segment: Extract<PlaceholderSegment, { kind: "placeholder" }>): string {
  if (segment.status === "missing") return `${segment.name} is not defined`;
  if (segment.secret) return `${segment.name} = •••••••• Secret`;
  return `${segment.name} = ${segment.value ?? ""}`;
}

interface InterpolatedTextPreviewProps {
  text: string;
  className?: string;
  /** Disable for previews that appear/disappear with field focus, so tabbing
   *  cannot land on a chip that is about to unmount. */
  focusableChips?: boolean;
}

/** Inline preview of {{name}} tokens in a text: resolved tokens in info tone,
 *  missing tokens in warning tone, secrets never revealed. Renders nothing
 *  when the text has no valid placeholder. */
export function InterpolatedTextPreview({
  text,
  className = "",
  focusableChips = true,
}: InterpolatedTextPreviewProps) {
  const envVars = useNotebookStore((s) => s.notebook?.envVars ?? NO_VARS);
  const segments = tokenizePlaceholders(text, envVars);
  if (!segments.some((segment) => segment.kind === "placeholder")) return null;

  return (
    <p className={`break-all font-mono text-xs leading-6 text-muted ${className}`}>
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <span
            key={index}
            tabIndex={focusableChips ? 0 : undefined}
            title={tooltipFor(segment)}
            aria-label={tooltipFor(segment)}
            className={`rounded border px-1 py-0.5 ${CHIP_CLASSES[segment.status]}`}
          >
            {segment.text}
          </span>
        ),
      )}
    </p>
  );
}
