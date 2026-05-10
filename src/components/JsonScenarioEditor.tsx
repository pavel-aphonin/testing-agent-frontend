import Editor, { type OnMount } from "@monaco-editor/react";
import { theme } from "antd";
import type { editor as MonacoEditorNS, Position } from "monaco-editor";
import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Test data variables suggested after `{{`. Same shape as VarAutocompleteInput. */
  variables: { key: string; value?: string }[];
  height?: number | string;
}

/**
 * PER-74: JSON editor (Monaco) for the Scenarios page.
 *
 * Beyond a plain textarea this gives us:
 *   - syntax highlighting and brace matching for JSON
 *   - auto-format on paste/type and `Ctrl/Cmd+Alt+F` to format the document
 *   - autocomplete of `{{test_data.*}}` placeholders inside string literals
 *
 * Theme follows AntD: we sniff `colorBgBase` and pick `vs` / `vs-dark`.
 *
 * Constant tag-style highlighting (the `{{var}}` chip look) requires either
 * a Monaco semantic-tokens provider or replacing the JSON tokenizer wholesale —
 * intentionally cut for v1. Autocomplete + format covers the main pain point
 * (typo-prone, hand-formatted JSON) and is the value-prop of the issue.
 */
export function JsonScenarioEditor({
  value,
  onChange,
  variables,
  height = 600,
}: Props) {
  const { token } = theme.useToken();
  // Keep an up-to-date variables ref for the completion provider closure.
  const variablesRef = useRef(variables);
  useEffect(() => {
    variablesRef.current = variables;
  }, [variables]);

  // Heuristic: average the RGB of colorBgBase, dark if < 128.
  const isDark = isDarkColor(token.colorBgBase);

  const handleMount: OnMount = (editor, monaco) => {
    const provider = monaco.languages.registerCompletionItemProvider("json", {
      // `{` and `.` cover both the moment user finishes typing `{{` and the
      // dotted nested keys (test_data.email).
      triggerCharacters: ["{", "."],
      provideCompletionItems(model: MonacoEditorNS.ITextModel, position: Position) {
        const lineText = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        // Match a partial token of shape `{{<word>` at the cursor.
        const m = lineText.match(/\{\{([\w.]*)$/);
        if (!m) return { suggestions: [] };

        const queryStart = position.column - m[1].length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: queryStart,
          endColumn: position.column,
        };

        return {
          suggestions: variablesRef.current.map((v) => ({
            label: v.key,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: `${v.key}}}`,
            detail: v.value
              ? v.value.length > 60
                ? v.value.slice(0, 60) + "…"
                : v.value
              : undefined,
            range,
          })),
        };
      },
    });

    // Format on Ctrl/Cmd+Alt+F.
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      () => {
        editor.getAction("editor.action.formatDocument")?.run();
      },
    );

    // Cleanup when the editor unmounts (the React wrapper disposes the
    // editor; we need to dispose the provider so it doesn't leak across
    // remounts).
    editor.onDidDispose(() => provider.dispose());
  };

  return (
    <Editor
      height={height}
      language="json"
      theme={isDark ? "vs-dark" : "vs"}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        tabSize: 2,
        formatOnPaste: true,
        formatOnType: true,
        wordWrap: "on",
        automaticLayout: true,
      }}
    />
  );
}

function isDarkColor(hex: string): boolean {
  // Accepts #rgb, #rrggbb, or any CSS color we can't parse → treat as light.
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r + g + b) / 3 < 128;
}
