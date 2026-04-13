import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { fetchMe, login } from "@/api/auth";
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
      navigate(from ?? "/runs", { replace: true });
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
        background: "#F5F5F5",
      }}
    >
      <Card style={{ width: 400, borderTop: "3px solid #EE3424" }}>
        <Typography.Title level={3} style={{ textAlign: "center", marginBottom: 4 }}>
          {t("auth.loginTitle")}
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
