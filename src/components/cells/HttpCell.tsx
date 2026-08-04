import { Plus, X } from "lucide-react";
import type {
  HttpCell as HttpCellModel,
  HttpMethod,
  HttpRequestSpec,
} from "../../types/notebook";
import { HTTP_METHODS } from "../../types/notebook";
import { HTTP_TIMEOUT_MAX_MS, HTTP_TIMEOUT_MIN_MS } from "../../lib/config";
import { CodeEditor } from "../common/CodeEditor";
import { Button } from "../common/Button";

interface HttpCellProps {
  cell: HttpCellModel;
  onChangeRequest: (request: HttpRequestSpec) => void;
}

const FIELD_CLASSES =
  "rounded-md border border-default bg-subtle px-2 py-1.5 text-[13px] text-primary outline-none focus:border-strong";

/** HTTP request authoring: method, URL, headers, body, timeout. */
export function HttpCell({ cell, onChangeRequest }: HttpCellProps) {
  const { request } = cell;
  const patch = (partial: Partial<HttpRequestSpec>) =>
    onChangeRequest({ ...request, ...partial });

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
        <input
          className={`${FIELD_CLASSES} min-w-40 flex-1 font-mono`}
          value={request.url}
          onChange={(e) => patch({ url: e.target.value })}
          placeholder="https://api.example.test/path or {{base_url}}/path"
          aria-label="Request URL"
          spellCheck={false}
        />
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
            <input
              className={`${FIELD_CLASSES} min-w-40 flex-1 font-mono`}
              value={header.value}
              onChange={(e) => updateHeader(index, "value", e.target.value)}
              placeholder="Value"
              aria-label={`Header ${index + 1} value`}
              spellCheck={false}
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
      </div>

      <div className="rounded-md border border-dashed border-subtle bg-subtle px-3 py-2 text-xs text-muted">
        Response appears here once HTTP execution lands.
      </div>
    </>
  );
}
