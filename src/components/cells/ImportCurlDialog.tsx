import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ShieldAlert, TriangleAlert } from "lucide-react";
import { Button } from "../common/Button";
import { parseCurlCommand, type ParsedCurlRequest } from "../../lib/curlImport";

interface ImportCurlDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (request: ParsedCurlRequest) => void;
}

/** Paste-a-cURL dialog: parses on Import, applies the request, then shows any notes. */
export function ImportCurlDialog({ open, onClose, onImport }: ImportCurlDialogProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<{ warnings: string[]; sensitive: string[] } | null>(null);

  function reset() {
    setText("");
    setError(null);
    setNotes(null);
  }

  function close() {
    reset();
    onClose();
  }

  function handleImport() {
    const result = parseCurlCommand(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onImport(result.request);
    if (result.warnings.length > 0 || result.sensitiveHeaders.length > 0) {
      setNotes({ warnings: result.warnings, sensitive: result.sensitiveHeaders });
      return;
    }
    close();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(85vh,640px)] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-lg border border-default bg-elevated p-6 md:p-8">
          <Dialog.Title className="text-base font-semibold">Import cURL</Dialog.Title>

          {notes === null ? (
            <>
              <Dialog.Description className="text-[13px] leading-relaxed text-secondary">
                Paste a cURL command. Method, URL, headers, and body will fill this
                cell. The request is not run automatically.
              </Dialog.Description>
              <textarea
                className="min-h-40 w-full min-w-0 resize-y rounded-md border border-default bg-code-bg p-3 font-mono text-xs text-primary outline-none focus:border-strong"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(null);
                }}
                placeholder={"curl -X POST 'https://api.example.test/users' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"name\":\"pnb\"}'"}
                spellCheck={false}
                aria-label="cURL command"
                autoFocus
              />
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="mt-1 flex justify-end gap-2">
                <Button onClick={close}>Cancel</Button>
                <Button variant="primary" onClick={handleImport} disabled={text.trim() === ""}>
                  Import
                </Button>
              </div>
            </>
          ) : (
            <>
              <Dialog.Description className="text-[13px] leading-relaxed text-secondary">
                Imported with notes — review before running.
              </Dialog.Description>
              <ul className="flex list-none flex-col gap-1.5 p-0 text-xs">
                {notes.sensitive.map((name) => (
                  <li key={`s-${name}`} className="flex items-start gap-1.5 text-warning">
                    <ShieldAlert size={13} className="mt-0.5 shrink-0" aria-hidden />
                    Header “{name}” looks sensitive — review its value before running or
                    sharing this notebook.
                  </li>
                ))}
                {notes.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start gap-1.5 text-secondary">
                    <TriangleAlert size={13} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                    {warning}
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex justify-end">
                <Button variant="primary" onClick={close}>
                  Done
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
