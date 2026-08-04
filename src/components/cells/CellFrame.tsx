import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { CellType } from "../../types/notebook";
import { Badge, type BadgeTone } from "../common/Badge";
import { Button } from "../common/Button";

const ACCENT_BORDER: Record<CellType, string> = {
  markdown: "border-l-cell-markdown",
  php: "border-l-cell-php",
  http: "border-l-cell-http",
};

const BADGE_TONE: Record<CellType, BadgeTone> = {
  markdown: "cellMarkdown",
  php: "cellPhp",
  http: "cellHttp",
};

const TYPE_LABEL: Record<CellType, string> = {
  markdown: "Markdown",
  php: "PHP",
  http: "HTTP",
};

interface CellFrameProps {
  type: CellType;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  /** Extra controls rendered next to the type badge (e.g. edit/preview toggle). */
  headerExtra?: ReactNode;
  children: ReactNode;
}

/** Shared chrome for every cell: accent border, type badge, toolbar, body slot. */
export function CellFrame({
  type,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDelete,
  headerExtra,
  children,
}: CellFrameProps) {
  return (
    <article
      className={`w-full min-w-0 rounded-lg border border-subtle border-l-2 bg-surface ${ACCENT_BORDER[type]}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-subtle px-3 py-1.5">
        <Badge tone={BADGE_TONE[type]}>{TYPE_LABEL[type]}</Badge>
        {headerExtra}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            aria-label="Move cell up"
          >
            <ArrowUp size={14} aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            aria-label="Move cell down"
          >
            <ArrowDown size={14} aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete cell">
            <Trash2 size={14} aria-hidden />
          </Button>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3 p-3">{children}</div>
    </article>
  );
}
