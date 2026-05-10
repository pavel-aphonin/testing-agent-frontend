import { ExclamationCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Result, Typography } from "antd";
import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary.
 *
 * Catches any uncaught render error in the wrapped subtree and shows a
 * friendly "Что-то пошло не так" page instead of the white screen of
 * death. The reload button hard-refreshes; the back link uses
 * window.history (we deliberately avoid useNavigate here because that
 * hook isn't safe to use in error boundary fallback).
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console for debugging; in production we'd ship this to a
    // tracker like Sentry.
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const detail = this.state.error?.message ?? "Неизвестная ошибка";
    return (
      <div style={{ padding: 32 }}>
        <Result
          status="500"
          icon={<ExclamationCircleOutlined style={{ color: "#EE3424" }} />}
          title="Что-то пошло не так..."
          subTitle="Произошла непредвиденная ошибка. Попробуйте обновить страницу."
          extra={[
            <Button
              key="reload"
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => window.location.reload()}
            >
              Обновить страницу
            </Button>,
            <Button
              key="back"
              onClick={() => window.history.back()}
            >
              Назад
            </Button>,
          ]}
        >
          <details style={{ marginTop: 16, opacity: 0.65 }}>
            <summary style={{ cursor: "pointer" }}>Подробности ошибки</summary>
            <Typography.Paragraph
              code
              copyable
              style={{ marginTop: 8, fontSize: 12 }}
            >
              {detail}
            </Typography.Paragraph>
          </details>
        </Result>
      </div>
    );
  }
}
