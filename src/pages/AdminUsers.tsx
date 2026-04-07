import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Button,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import { deleteAdminUser, listAdminUsers } from "@/api/users";
import { NewUserModal } from "@/components/NewUserModal";
import { useAuthStore } from "@/store/auth";
import type { AdminUser, UserRole } from "@/types";

const ROLE_COLOR: Record<UserRole, string> = {
  viewer: "default",
  tester: "blue",
  admin: "red",
};

export function AdminUsers() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-users"],
    queryFn: listAdminUsers,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: () => {
      message.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to delete user";
      message.error(detail);
    },
  });

  const columns: ColumnsType<AdminUser> = [
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      width: 120,
      render: (role: UserRole) => <Tag color={ROLE_COLOR[role]}>{role}</Tag>,
    },
    {
      title: "Active",
      dataIndex: "is_active",
      key: "is_active",
      width: 90,
      render: (v: boolean) => (v ? "Yes" : "No"),
    },
    {
      title: "Must change password",
      dataIndex: "must_change_password",
      key: "must_change_password",
      width: 200,
      render: (v: boolean) => (v ? "Yes" : "No"),
    },
    {
      title: "Actions",
      key: "actions",
      width: 110,
      render: (_: unknown, record: AdminUser) => (
        <Popconfirm
          title="Delete this user?"
          description="This is irreversible."
          onConfirm={() => deleteMutation.mutate(record.id)}
          okText="Delete"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
          disabled={record.id === me?.id}
        >
          <Button danger size="small" disabled={record.id === me?.id}>
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <Space
        style={{
          width: "100%",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          Users
        </Typography.Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["admin-users"] })
            }
            loading={isFetching && !isLoading}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            New user
          </Button>
        </Space>
      </Space>

      <Table<AdminUser>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={isLoading}
        pagination={{ pageSize: 20 }}
      />

      <NewUserModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
