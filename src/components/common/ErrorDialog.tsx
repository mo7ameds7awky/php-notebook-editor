import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./Button";
import type { UserFacingError } from "../../lib/errors";

interface ErrorDialogProps {
  error: UserFacingError | null;
  onClose: () => void;
}

/** Modal notice for a user-facing error; raw detail sits behind a disclosure. */
export function ErrorDialog({ error, onClose }: ErrorDialogProps) {
  return (
    <Dialog.Root open={error !== null} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(85vh,560px)] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-lg border border-default bg-elevated p-6 md:p-8">
          <Dialog.Title
            className={`text-base font-semibold ${error?.severity === "warning" ? "text-warning" : "text-danger"}`}
          >
            {error?.title}
          </Dialog.Title>
          <Dialog.Description className="whitespace-pre-line text-[13px] leading-relaxed text-secondary">
            {error?.message}
          </Dialog.Description>
          {error?.detail && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer select-none">Technical details</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap p-3">{error.detail}</pre>
            </details>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
