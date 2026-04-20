import { AutoComplete, Input } from "antd";
import { useMemo, useState } from "react";

interface Props {
  value?: string;
  onChange?: (v: string) => void;
  /** Test data variables available for substitution. */
  variables: { key: string; value?: string }[];
  placeholder?: string;
  size?: "small" | "middle" | "large";
}

/**
 * Text input that suggests test_data keys after typing `{` or `${`.
 *
 * Patterns supported (insertion):
 *   - `{name}`        → bare brace style (matches what scenarios used so far)
 *   - `${name}`       → dollar-brace style (alternative)
 *
 * Detection: the cursor must be on a token starting with `{` or `${`
 * with no closing `}` yet. We re-scan the substring up to the cursor
 * on every keystroke.
 */
export function VarAutocompleteInput({
  value = "",
  onChange,
  variables,
  placeholder,
  size,
}: Props) {
  const [innerValue, setInnerValue] = useState(value);
  const text = onChange ? value : innerValue;
  const setText = onChange ?? setInnerValue;

  // Detect partial token under cursor (we use the END of the string as
  // approximation since AutoComplete doesn't give us the cursor position).
  const partial = useMemo(() => {
    const m = text.match(/(\$?\{)([a-zA-Z0-9_.\-]*)$/);
    return m ? { prefix: m[1], query: m[2], start: text.length - m[0].length } : null;
  }, [text]);

  const options = useMemo(() => {
    if (!partial) return [];
    const q = partial.query.toLowerCase();
    return variables
      .filter((v) => v.key.toLowerCase().includes(q))
      .slice(0, 10)
      .map((v) => ({
        value: text.slice(0, partial.start) + partial.prefix + v.key + "}",
        label: (
          <span>
            <code>{partial.prefix}{v.key}{"}"}</code>
            {v.value && (
              <span style={{ color: "#999", marginLeft: 8, fontSize: 11 }}>
                = {v.value.length > 24 ? v.value.slice(0, 24) + "…" : v.value}
              </span>
            )}
          </span>
        ),
      }));
  }, [partial, variables, text]);

  return (
    <AutoComplete
      value={text}
      onChange={(v) => setText(v ?? "")}
      onSelect={(v) => setText(v)}
      options={options}
      style={{ width: "100%" }}
      // Keep dropdown open only when there's a partial token AND matches
      open={Boolean(partial) && options.length > 0}
    >
      <Input placeholder={placeholder} size={size} />
    </AutoComplete>
  );
}
