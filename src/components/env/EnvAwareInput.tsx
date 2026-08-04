import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import type { EnvVar } from "../../types/notebook";
import {
  applyEnvSuggestion,
  findActivePlaceholder,
  getEnvSuggestions,
  type ActivePlaceholder,
} from "../../lib/envAutocomplete";
import { useNotebookStore } from "../../state/notebookStore";
import { InterpolatedTextPreview } from "./InterpolatedTextPreview";

const NO_VARS: EnvVar[] = [];

interface EnvAwareInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className"> {
  value: string;
  onChange: (value: string) => void;
  /** Layout classes for the outer wrapper (flex sizing lives here). */
  className?: string;
  /** Visual classes for the input element itself. */
  inputClassName?: string;
  /** Renders an InterpolatedTextPreview under the field when tokens exist. */
  showPreview?: boolean;
}

/** Text input with {{name}} env var autocomplete: suggestions open while the
 *  cursor sits in an unclosed {{fragment; native behavior is untouched
 *  otherwise. Secret variable values are never displayed. */
export function EnvAwareInput({
  value,
  onChange,
  className = "",
  inputClassName = "",
  showPreview = false,
  ...rest
}: EnvAwareInputProps) {
  const envVars = useNotebookStore((s) => s.notebook?.envVars ?? NO_VARS);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCursor = useRef<number | null>(null);
  const listId = useId();

  const [active, setActive] = useState<ActivePlaceholder | null>(null);
  const [selected, setSelected] = useState(0);

  const suggestions = active ? getEnvSuggestions(active.query, envVars) : [];
  const open = active !== null;

  useEffect(() => {
    setSelected(0);
  }, [active?.start, active?.query]);

  // Restores the caret after a suggestion rewrites the controlled value.
  useEffect(() => {
    if (pendingCursor.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  }, [value]);

  function syncActive(element: HTMLInputElement) {
    const { selectionStart, selectionEnd } = element;
    if (selectionStart === null || selectionStart !== selectionEnd) {
      setActive(null);
      return;
    }
    setActive(findActivePlaceholder(element.value, selectionStart));
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
    syncActive(event.target);
  }

  function handleSelect(event: SyntheticEvent<HTMLInputElement>) {
    syncActive(event.currentTarget);
  }

  function insert(name: string) {
    const element = inputRef.current;
    const cursor = element?.selectionStart ?? null;
    if (cursor === null) return;
    const applied = applyEnvSuggestion(value, cursor, name);
    pendingCursor.current = applied.cursor;
    setActive(null);
    onChange(applied.text);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setActive(null);
      return;
    }
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((s) => (s + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((s) => (s - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      insert(suggestions[selected].name);
    }
  }

  return (
    <div className={`relative min-w-0 ${className}`}>
      <input
        {...rest}
        ref={inputRef}
        className={`w-full ${inputClassName}`}
        value={value}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && suggestions[selected] ? `${listId}-option-${selected}` : undefined
        }
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        onBlur={() => setActive(null)}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Environment variable suggestions"
          className="absolute left-0 top-full z-10 mt-1 max-h-56 w-full min-w-48 overflow-y-auto rounded-md border border-default bg-elevated py-1 shadow-lg"
        >
          {suggestions.length === 0 && (
            <li role="option" aria-disabled aria-selected={false} className="px-2 py-1 text-xs text-muted">
              No matching variables
            </li>
          )}
          {suggestions.map((variable, index) => (
            <li
              key={variable.name}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={index === selected}
              className={`flex cursor-pointer items-baseline gap-2 px-2 py-1 font-mono text-xs ${
                index === selected ? "bg-brand/20 text-primary" : "text-secondary"
              }`}
              onMouseDown={(event) => {
                event.preventDefault();
                insert(variable.name);
              }}
              onMouseEnter={() => setSelected(index)}
            >
              <span className="truncate">{variable.name}</span>
              {variable.secret ? (
                <span className="ml-auto shrink-0 text-muted">Secret</span>
              ) : (
                variable.value && (
                  <span className="ml-auto max-w-40 truncate text-muted">{variable.value}</span>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {showPreview && <InterpolatedTextPreview text={value} className="mt-1" />}
    </div>
  );
}
