import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, Input, Modal, Select, Switch } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { createAdminUser } from "@/api/users";
import { notify } from "@/utils/notify";
import type { AdminUserCreate, UserRole } from "@/types";

interface NewUserModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewUserModal({ open, onClose }: NewUserModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<AdminUserCreate>();
  const queryClient = useQueryClient();

  const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
    { value: "viewer", label: t("newUserModal.roles.viewer") },
    { value: "tester", label: t("newUserModal.roles.tester") },
    { value: "admin", label: t("newUserModal.roles.admin") },
  ];

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      notify.success(t("newUserModal.created"));
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? t("newUserModal.createFailed");
      notify.error(detail);
    },
  });

  return (
    <Modal
      title={t("newUserModal.title")}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={t("newUserModal.create")}
      cancelText={t("common.cancel")}
      confirmLoading={mutation.isPending}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => mutation.mutate(values)}
        initialValues={{
          role: "tester",
          must_change_password: true,
        }}
      >
        <Form.Item
          name="email"
          label={t("newUserModal.email")}
          rules={[
            { required: true, message: t("newUserModal.emailRequired") },
            { type: "email", message: t("newUserModal.emailInvalid") },
          ]}
        >
          <Input autoComplete="off" />
        </Form.Item>

        <Form.Item
          name="password"
          label={t("newUserModal.password")}
          rules={[
            { required: true, message: t("newUserModal.passwordRequired") },
            { min: 8, message: t("newUserModal.passwordMin") },
          ]}
          extra={t("newUserModal.passwordHelp")}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        <Form.Item name="role" label={t("newUserModal.role")}>
          <Select options={ROLE_OPTIONS} />
        </Form.Item>

        <Form.Item
          name="must_change_password"
          label={t("newUserModal.mustChangePassword")}
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
