import type { HTMLAttributes } from "react";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "cellMarkdown"
  | "cellPhp"
  | "cellHttp";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "text-secondary border-default bg-surface",
  success: "text-success border-success/40 bg-success/10",
  warning: "text-warning border-warning/40 bg-warning/10",
  danger: "text-danger border-danger/40 bg-danger/10",
  info: "text-info border-info/40 bg-info/10",
  cellMarkdown: "text-cell-markdown border-cell-markdown/40 bg-cell-markdown/10",
  cellPhp: "text-cell-php border-cell-php/40 bg-cell-php/10",
  cellHttp: "text-cell-http border-cell-http/40 bg-cell-http/10",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Small inline status/type label. */
export function Badge({ tone = "neutral", className = "", ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
      {...rest}
    />
  );
}
