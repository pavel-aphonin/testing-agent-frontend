import { QuestionCircleOutlined } from "@ant-design/icons";
import { Tooltip, theme } from "antd";
import type { ReactNode } from "react";

/**
 * Form field label with a `?` tooltip hint. Used for every field in every form
 * so users always have one-click access to the "what does this mean?" explanation.
 *
 * Usage:
 *   <Form.Item
 *     name="email"
 *     label={<LabelWithHint label="Email" hint="Ваш рабочий email для входа" />}
 *   />
 *
 * If `hint` is falsy, renders as plain label — makes it safe to use everywhere
 * while hints are being written.
 */
interface Props {
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
}

export function LabelWithHint({ label, hint, required }: Props) {
  const { token } = theme.useToken();
  return (
    <span>
      {required && <span style={{ color: token.colorError, marginRight: 4 }}>*</span>}
      {label}
      {hint ? (
        <>
          {"\u00A0"}
          <Tooltip title={hint}>
            <QuestionCircleOutlined style={{ color: token.colorTextTertiary }} />
          </Tooltip>
        </>
      ) : null}
    </span>
  );
}
