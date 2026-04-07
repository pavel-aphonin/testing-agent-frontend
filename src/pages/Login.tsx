import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useState } from "react";
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
          ?.detail ?? "Login failed";
      setError(typeof detail === "string" ? detail : "Login failed");
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
        background: "#f0f2f5",
      }}
    >
      <Card style={{ width: 400 }}>
        <Typography.Title level={3} style={{ textAlign: "center", marginBottom: 4 }}>
          Testing Agent
        </Typography.Title>
        <Typography.Paragraph
          type="secondary"
          style={{ textAlign: "center", marginBottom: 24 }}
        >
          Sign in to manage exploration runs
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
              { required: true, message: "Email is required" },
              { type: "email", message: "Must be a valid email" },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="admin@example.com"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "Password is required" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
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
              Sign in
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
