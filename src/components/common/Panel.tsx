import type { HTMLAttributes } from "react";

export type PanelVariant = "surface" | "subtle" | "elevated";

const VARIANT_CLASSES: Record<PanelVariant, string> = {
  surface: "bg-surface border-subtle",
  subtle: "bg-subtle border-subtle",
  elevated: "bg-elevated border-default",
};

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: PanelVariant;
  dashed?: boolean;
}

/** Basic surface container with themed background and border. */
export function Panel({
  variant = "surface",
  dashed = false,
  className = "",
  ...rest
}: PanelProps) {
  return (
    <div
      className={`w-full min-w-0 rounded-lg border p-6 ${dashed ? "border-dashed" : ""} ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    />
  );
}
