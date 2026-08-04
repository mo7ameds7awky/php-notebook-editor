import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, bracketMatching, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { php } from "@codemirror/lang-php";
import { markdown } from "@codemirror/lang-markdown";
import { json } from "@codemirror/lang-json";
import { cellAccents, colors, typography } from "../../theme/tokens";

export type EditorLanguage = "php" | "markdown" | "json" | "text";

function languageExtension(language: EditorLanguage) {
  switch (language) {
    case "php":
      return [php()];
    case "markdown":
      return [markdown()];
    case "json":
      return [json()];
    case "text":
      return [];
  }
}

const editorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: colors.codeBg,
      color: colors.textPrimary,
      fontSize: "13px",
    },
    ".cm-scroller": {
      fontFamily: typography.fontMono,
      lineHeight: "1.6",
      maxHeight: "480px",
      overflow: "auto",
    },
    ".cm-content": { caretColor: colors.primary, padding: "8px 0" },
    ".cm-gutters": {
      backgroundColor: colors.codeSurface,
      color: colors.textMuted,
      border: "none",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor": { borderLeftColor: colors.primary },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: `${colors.primaryActive}59`,
    },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: cellAccents.php },
  { tag: [tags.string, tags.special(tags.string)], color: cellAccents.http },
  { tag: tags.comment, color: colors.textMuted, fontStyle: "italic" },
  { tag: [tags.number, tags.bool, tags.null], color: colors.warning },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: colors.info },
  { tag: tags.propertyName, color: colors.info },
  { tag: [tags.typeName, tags.className, tags.tagName], color: colors.primaryHover },
  { tag: [tags.operator, tags.punctuation], color: colors.textSecondary },
  { tag: tags.heading, color: colors.textPrimary, fontWeight: "600" },
  { tag: [tags.link, tags.url], color: colors.info },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.monospace, color: cellAccents.http },
]);

interface CodeEditorProps {
  value: string;
  language: EditorLanguage;
  onChange: (value: string) => void;
  ariaLabel: string;
}

/** Controlled CodeMirror 6 editor; grows with content and scrolls internally past ~480px. */
export function CodeEditor({ value, language, onChange, ariaLabel }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const latestValueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!containerRef.current) return;
    const state = EditorState.create({
      doc: latestValueRef.current,
      extensions: [
        history(),
        lineNumbers(),
        bracketMatching(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        ...languageExtension(language),
        syntaxHighlighting(highlight, { fallback: true }),
        editorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="w-full min-w-0 overflow-hidden rounded-md border border-subtle"
      role="textbox"
      aria-label={ariaLabel}
    />
  );
}
