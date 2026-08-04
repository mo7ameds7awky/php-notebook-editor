import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import type { EnvVar } from "../../types/notebook";
import type { EnvVarNameError } from "../../lib/notebook";
import { useNotebookStore } from "../../state/notebookStore";
import { Panel } from "../common/Panel";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";

const NO_VARS: EnvVar[] = [];

const FIELD_CLASSES =
  "rounded-md border border-default bg-subtle px-2 py-1.5 text-[13px] text-primary outline-none focus:border-strong";

const NAME_ERROR_TEXT: Record<EnvVarNameError, string> = {
  invalidName:
    "Names must start with a letter or underscore and use only letters, digits, and underscores.",
  duplicateName: "A variable with this name already exists.",
};

interface EnvVarRowProps {
  envVar: EnvVar;
  onPatch: (patch: Partial<EnvVar>) => EnvVarNameError | null;
  onDelete: () => void;
}

/** One variable row: rename commits on blur/Enter, value and secret apply live. */
function EnvVarRow({ envVar, onPatch, onDelete }: EnvVarRowProps) {
  const [draftName, setDraftName] = useState(envVar.name);
  const [nameError, setNameError] = useState<EnvVarNameError | null>(null);
  const [revealed, setRevealed] = useState(false);

  const masked = envVar.secret && !revealed;

  function commitName() {
    if (draftName === envVar.name) {
      setNameError(null);
      return;
    }
    const error = onPatch({ name: draftName });
    if (error) setNameError(error);
  }

  function onNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      setDraftName(envVar.name);
      setNameError(null);
    }
  }

  const nameErrorId = `env-name-error-${envVar.name}`;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <input
          className={`${FIELD_CLASSES} w-40 min-w-0 font-mono`}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={onNameKeyDown}
          aria-label={`Variable ${envVar.name} name`}
          aria-invalid={nameError !== null}
          aria-describedby={nameError ? nameErrorId : undefined}
          spellCheck={false}
        />
        <input
          className={`${FIELD_CLASSES} min-w-40 flex-1 font-mono`}
          type={masked ? "password" : "text"}
          value={envVar.value}
          onChange={(e) => onPatch({ value: e.target.value })}
          aria-label={`Variable ${envVar.name} value`}
          spellCheck={false}
          autoComplete="off"
        />
        {envVar.secret && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRevealed((r) => !r)}
            aria-label={
              revealed ? `Conceal value of ${envVar.name}` : `Reveal value of ${envVar.name}`
            }
            aria-pressed={revealed}
          >
            {revealed ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
          </Button>
        )}
        <label className="flex items-center gap-1.5 text-xs text-secondary">
          <input
            type="checkbox"
            className="accent-brand"
            checked={envVar.secret}
            onChange={(e) => {
              if (e.target.checked) setRevealed(false);
              onPatch({ secret: e.target.checked });
            }}
            aria-label={`Mark ${envVar.name} as secret`}
          />
          Secret
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label={`Delete variable ${envVar.name}`}
        >
          <Trash2 size={14} aria-hidden />
        </Button>
      </div>
      {nameError && (
        <p id={nameErrorId} className="text-xs text-danger" role="alert">
          {NAME_ERROR_TEXT[nameError]}
        </p>
      )}
    </div>
  );
}

/** Collapsible per-notebook environment variable editor with secret masking. */
export function EnvPanel() {
  const envVars = useNotebookStore((s) => s.notebook?.envVars ?? NO_VARS);
  const addEnvVar = useNotebookStore((s) => s.addEnvVar);
  const updateEnvVar = useNotebookStore((s) => s.updateEnvVar);
  const deleteEnvVar = useNotebookStore((s) => s.deleteEnvVar);

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newSecret, setNewSecret] = useState(false);
  const [addError, setAddError] = useState<EnvVarNameError | null>(null);

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    const error = addEnvVar({ name: newName, value: newValue, secret: newSecret });
    if (error) {
      setAddError(error);
      return;
    }
    setNewName("");
    setNewValue("");
    setNewSecret(false);
    setAddError(null);
  }

  return (
    <Panel className="mx-auto mb-6 w-full max-w-3xl min-w-0">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 text-left text-sm font-medium text-primary"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown size={14} aria-hidden />
        ) : (
          <ChevronRight size={14} aria-hidden />
        )}
        Environment variables
        <Badge>{envVars.length}</Badge>
      </button>

      {open && (
        <div className="mt-4 flex min-w-0 flex-col gap-2">
          <p className="text-xs text-muted">
            Reference variables in HTTP cells as {"{{name}}"} — in the URL, headers, or body.
          </p>
          {envVars.length === 0 && <p className="text-xs text-muted">No variables yet.</p>}
          {envVars.map((envVar) => (
            <EnvVarRow
              key={envVar.name}
              envVar={envVar}
              onPatch={(patch) => updateEnvVar(envVar.name, patch)}
              onDelete={() => deleteEnvVar(envVar.name)}
            />
          ))}

          <form className="flex min-w-0 flex-col gap-1" onSubmit={handleAdd}>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <input
                className={`${FIELD_CLASSES} w-40 min-w-0 font-mono`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="name"
                aria-label="New variable name"
                aria-invalid={addError !== null}
                aria-describedby={addError ? "env-add-error" : undefined}
                spellCheck={false}
              />
              <input
                className={`${FIELD_CLASSES} min-w-40 flex-1 font-mono`}
                type={newSecret ? "password" : "text"}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="value"
                aria-label="New variable value"
                spellCheck={false}
                autoComplete="off"
              />
              <label className="flex items-center gap-1.5 text-xs text-secondary">
                <input
                  type="checkbox"
                  className="accent-brand"
                  checked={newSecret}
                  onChange={(e) => setNewSecret(e.target.checked)}
                  aria-label="Mark new variable as secret"
                />
                Secret
              </label>
              <Button type="submit" size="sm">
                <Plus size={12} aria-hidden />
                Add
              </Button>
            </div>
            {addError && (
              <p id="env-add-error" className="text-xs text-danger" role="alert">
                {NAME_ERROR_TEXT[addError]}
              </p>
            )}
          </form>
        </div>
      )}
    </Panel>
  );
}
