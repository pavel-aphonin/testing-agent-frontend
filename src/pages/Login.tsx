import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { fetchMe, login } from "@/api/auth";
import { MarkovLogo } from "@/components/MarkovLogo";
import { useBranding } from "@/hooks/useBranding";
import { useAuthStore } from "@/store/auth";

interface LoginForm {
  email: string;
  password: string;
}

interface LocationState {
  from?: { pathname: string };
}

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const branding = useBranding();

  const onFinish = async (values: LoginForm) => {
    setError(null);
    setSubmitting(true);
    try {
      const tokenResp = await login(values.email, values.password);
      // Stash the token first so the next request picks it up via the interceptor.
      useAuthStore.setState({ token: tokenResp.access_token });
      const me = await fetchMe();
      setSession(tokenResp.access_token, me);
      const from = (location.state as LocationState | null)?.from?.pathname;
      // Default landing after login — system dashboard of the active
      // workspace. DashboardPage redirects to the specific dashboard.
      navigate(from ?? "/dashboard", { replace: true });
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? t("auth.loginError");
      setError(typeof detail === "string" ? detail : t("auth.loginError"));
      useAuthStore.getState().logout();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Transparent — App.tsx paints document.body to match the theme,
        // so we don't need to second-guess the color here.
        background: "transparent",
      }}
    >
      <Card style={{ width: 400, borderTop: "3px solid #EE3424" }}>
        {/* Animated logo — same flip as the sidebar, bigger since there's
            room. Swaps to the admin-uploaded mark when system branding
            is customized. */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <MarkovLogo
            size={64}
            durationSec={6}
            logoUrl={branding.logoUrl}
            logoBackUrl={branding.logoBackUrl}
          />
        </div>
        <Typography.Title level={3} style={{ textAlign: "center", marginBottom: 4 }}>
          Вход в «{branding.productName}»
        </Typography.Title>
        <Typography.Paragraph
          type="secondary"
          style={{ textAlign: "center", marginBottom: 24 }}
        >
          {t("auth.loginSubtitle")}
        </Typography.Paragraph>

        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form<LoginForm>
          name="login"
          layout="vertical"
          onFinish={onFinish}
          autoComplete="on"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: t("auth.emailRequired") },
              { type: "email", message: t("auth.emailRequired") },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder={t("auth.emailPlaceholder")}
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: t("auth.passwordRequired") }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t("auth.passwordPlaceholder")}
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
            >
              {t("auth.loginButton")}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
