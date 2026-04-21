import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Space,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { notify } from "@/utils/notify";

import { changeMyPassword } from "@/api/profile";
import { ProfileMyApps } from "@/pages/ProfileMyApps";
import { useAuthStore } from "@/store/auth";
import type { ChangePasswordRequest } from "@/types";

const ROLE_COLOR: Record<string, string> = {
  viewer: "default",
  tester: "blue",
  moderator: "purple",
  admin: "red",
};

export function Profile() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "general";

  if (!user) return null;

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {t("profile.title")}
      </Typography.Title>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setSearchParams({ tab: key })}
        items={[
          {
            key: "general",
            label: "Общая информация",
            children: <GeneralTab />,
          },
          {
            key: "password",
            label: "Сменить пароль",
            children: <PasswordTab />,
          },
          {
            key: "my-apps",
            label: "Мои приложения",
            children: <ProfileMyApps />,
          },
        ]}
      />
    </>
  );
}

function GeneralTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user)!;
  return (
    <Card>
      <Descriptions column={1} bordered>
        <Descriptions.Item label={t("profile.email")}>{user.email}</Descriptions.Item>
        <Descriptions.Item label={t("profile.role")}>
          <Tag color={ROLE_COLOR[user.role_code || user.role] ?? "default"}>
            {user.role_name || t(`roles.${user.role}`)}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Permissions">
          {user.permissions?.length ?? 0}
        </Descriptions.Item>
      </Descriptions>
      {user.must_change_password && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
          message="Требуется сменить пароль на вкладке «Сменить пароль»"
        />
      )}
    </Card>
  );
}

function PasswordTab() {
  const { t } = useTranslation();
  const [form] = Form.useForm<ChangePasswordRequest & { confirm_password: string }>();

  const mutation = useMutation({
    mutationFn: changeMyPassword,
    onSuccess: () => {
      notify.success(t("profile.passwordChanged"));
      form.resetFields();
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? t("profile.passwordChangeFailed");
      notify.error(detail);
    },
  });

  return (
    <Card style={{ maxWidth: 480 }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) =>
          mutation.mutate({
            current_password: values.current_password,
            new_password: values.new_password,
          })
        }
      >
        <Form.Item
          name="current_password"
          label={t("profile.currentPassword")}
          rules={[{ required: true, message: t("profile.currentPasswordRequired") }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="new_password"
          label={t("profile.newPassword")}
          rules={[{ required: true, message: t("profile.newPasswordRequired") }, { min: 8 }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm_password"
          label={t("profile.confirmPassword")}
          dependencies={["new_password"]}
          rules={[
            { required: true, message: t("profile.newPasswordRequired") },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("new_password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t("profile.passwordsDontMatch")));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>
            {t("profile.changePassword")}
          </Button>
        </Space>
      </Form>
    </Card>
  );
}
