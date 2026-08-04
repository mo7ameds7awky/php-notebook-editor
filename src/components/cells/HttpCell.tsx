import { useState } from "react";
import { ClipboardPaste, Play, Plus, Square, X } from "lucide-react";
import type {
  HttpCell as HttpCellModel,
  HttpMethod,
  HttpRequestSpec,
} from "../../types/notebook";
import { HTTP_METHODS } from "../../types/notebook";
import { HTTP_TIMEOUT_MAX_MS, HTTP_TIMEOUT_MIN_MS } from "../../lib/config";
import { CodeEditor } from "../common/CodeEditor";
import { Button } from "../common/Button";
import { EnvAwareInput } from "../env/EnvAwareInput";
import { InterpolatedTextPreview } from "../env/InterpolatedTextPreview";
import { HttpResultView } from "./HttpResultView";
import { ImportCurlDialog } from "./ImportCurlDialog";
import type { ParsedCurlRequest } from "../../lib/curlImport";

interface HttpCellProps {
  cell: HttpCellModel;
  onChangeRequest: (request: HttpRequestSpec) => void;
  running: boolean;
  onRun: () => void;
  onCancel: () => void;
}

const FIELD_CLASSES =
  "rounded-md border border-default bg-subtle px-2 py-1.5 text-[13px] text-primary outline-none focus:border-strong";

/** HTTP request authoring and execution: method, URL, headers, body, timeout, result. */
export function HttpCell({ cell, onChangeRequest, running, onRun, onCancel }: HttpCellProps) {
  const { request } = cell;
  const [importOpen, setImportOpen] = useState(false);
  const patch = (partial: Partial<HttpRequestSpec>) =>
    onChangeRequest({ ...request, ...partial });

  function applyImport(parsed: ParsedCurlRequest) {
    onChangeRequest({
      method: parsed.method,
      url: parsed.url,
      headers: parsed.headers,
      body: parsed.body,
      timeoutMs: parsed.timeoutMs ?? request.timeoutMs,
    });
  }

  const timeoutSeconds = Math.round((request.timeoutMs ?? 30_000) / 1000);

  function setTimeoutSeconds(raw: string) {
    const seconds = Number.parseInt(raw, 10);
    if (Number.isNaN(seconds)) return;
    const clamped = Math.max(HTTP_TIMEOUT_MIN_MS / 1000, Math.min(seconds, HTTP_TIMEOUT_MAX_MS / 1000));
    patch({ timeoutMs: clamped * 1000 });
  }

  function updateHeader(index: number, key: "name" | "value", value: string) {
    const headers = request.headers.map((h, i) => (i === index ? { ...h, [key]: value } : h));
    patch({ headers });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <Button size="sm" onClick={onCancel} aria-label="Cancel request">
            <Square size={12} aria-hidden />
            Cancel
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onRun} aria-label="Run request">
            <Play size={12} aria-hidden />
            Run
          </Button>
        )}
        <select
          className={FIELD_CLASSES}
          value={request.method}
          onChange={(e) => patch({ method: e.target.value as HttpMethod })}
          aria-label="HTTP method"
        >
          {HTTP_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
        <EnvAwareInput
          className="min-w-40 flex-1"
          inputClassName={`${FIELD_CLASSES} font-mono`}
          value={request.url}
          onChange={(url) => patch({ url })}
          placeholder="https://api.example.test/path or {{base_url}}/path"
          aria-label="Request URL"
          spellCheck={false}
          showPreview
        />
        <Button size="sm" onClick={() => setImportOpen(true)} disabled={running}>
          <ClipboardPaste size={12} aria-hidden />
          Import cURL
        </Button>
        <label className="flex items-center gap-1.5 text-xs text-secondary">
          Timeout
          <input
            type="number"
            className={`${FIELD_CLASSES} w-16`}
            min={HTTP_TIMEOUT_MIN_MS / 1000}
            max={HTTP_TIMEOUT_MAX_MS / 1000}
            value={timeoutSeconds}
            onChange={(e) => setTimeoutSeconds(e.target.value)}
            aria-label="Timeout in seconds"
          />
          s
        </label>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">Headers</span>
        {request.headers.length === 0 && (
          <p className="text-xs text-muted">No headers.</p>
        )}
        {request.headers.map((header, index) => (
          <div key={index} className="flex min-w-0 flex-wrap items-center gap-1.5">
            <input
              className={`${FIELD_CLASSES} w-40 min-w-0 font-mono`}
              value={header.name}
              onChange={(e) => updateHeader(index, "name", e.target.value)}
              placeholder="Name"
              aria-label={`Header ${index + 1} name`}
              spellCheck={false}
            />
            <EnvAwareInput
              className="min-w-40 flex-1"
              inputClassName={`${FIELD_CLASSES} font-mono`}
              value={header.value}
              onChange={(value) => updateHeader(index, "value", value)}
              placeholder="Value"
              aria-label={`Header ${index + 1} value`}
              spellCheck={false}
              showPreview
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => patch({ headers: request.headers.filter((_, i) => i !== index) })}
              aria-label={`Remove header ${index + 1}`}
            >
              <X size={12} aria-hidden />
            </Button>
          </div>
        ))}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => patch({ headers: [...request.headers, { name: "", value: "" }] })}
          >
            <Plus size={12} aria-hidden />
            Add header
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">Body</span>
        <CodeEditor
          value={request.body}
          language="text"
          onChange={(body) => patch({ body })}
          ariaLabel="Request body"
        />
        <InterpolatedTextPreview text={request.body} />
      </div>

      <HttpResultView lastRun={cell.lastRun} running={running} />

      <ImportCurlDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={applyImport}
      />
    </>
  );
}
