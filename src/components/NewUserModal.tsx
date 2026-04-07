import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, Input, Modal, Select, Switch, message } from "antd";
import { useEffect } from "react";

import { createAdminUser } from "@/api/users";
import type { AdminUserCreate, UserRole } from "@/types";

interface NewUserModalProps {
  open: boolean;
  onClose: () => void;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "viewer", label: "Viewer (read-only)" },
  { value: "tester", label: "Tester (can run explorations)" },
  { value: "admin", label: "Admin (full control)" },
];

export function NewUserModal({ open, onClose }: NewUserModalProps) {
  const [form] = Form.useForm<AdminUserCreate>();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      message.success("User created");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to create user";
      message.error(detail);
    },
  });

  return (
    <Modal
      title="New user"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Create"
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
          label="Email"
          rules={[
            { required: true, message: "Email is required" },
            { type: "email", message: "Must be a valid email" },
          ]}
        >
          <Input autoComplete="off" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Initial password"
          rules={[
            { required: true, message: "Password is required" },
            { min: 8, message: "At least 8 characters" },
          ]}
          extra="Share this with the user out-of-band. They will be asked to change it on first login if 'Force password change' is on."
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        <Form.Item name="role" label="Role">
          <Select options={ROLE_OPTIONS} />
        </Form.Item>

        <Form.Item
          name="must_change_password"
          label="Force password change on first login"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
