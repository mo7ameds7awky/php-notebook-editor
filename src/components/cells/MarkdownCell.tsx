import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Eye, Pencil } from "lucide-react";
import type { MarkdownCell as MarkdownCellModel } from "../../types/notebook";
import { CodeEditor } from "../common/CodeEditor";
import { Button } from "../common/Button";

type Mode = "edit" | "preview";

interface MarkdownCellProps {
  cell: MarkdownCellModel;
  onChangeSource: (source: string) => void;
  defaultMode?: Mode;
}

/** Markdown authoring: source editor with a sanitized rendered preview. */
export function MarkdownCell({ cell, onChangeSource, defaultMode = "edit" }: MarkdownCellProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant={mode === "edit" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setMode("edit")}
          aria-pressed={mode === "edit"}
        >
          <Pencil size={12} aria-hidden />
          Edit
        </Button>
        <Button
          variant={mode === "preview" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setMode("preview")}
          aria-pressed={mode === "preview"}
        >
          <Eye size={12} aria-hidden />
          Preview
        </Button>
      </div>

      {mode === "edit" ? (
        <CodeEditor
          value={cell.source}
          language="markdown"
          onChange={onChangeSource}
          ariaLabel="Markdown source"
        />
      ) : cell.source.trim() === "" ? (
        <p className="text-[13px] text-muted">Nothing to preview yet.</p>
      ) : (
        <div className="markdown-preview min-w-0 text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {cell.source}
          </ReactMarkdown>
        </div>
      )}
    </>
  );
}
