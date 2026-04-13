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
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { notify } from "@/utils/notify";

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
  const { t } = useTranslation();
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
      notify.success(t("adminUsers.deleted"));
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? t("adminUsers.deleteFailed");
      notify.error(detail);
    },
  });

  const columns: ColumnsType<AdminUser> = [
    {
      title: t("adminUsers.columns.email"),
      dataIndex: "email",
      key: "email",
    },
    {
      title: t("adminUsers.columns.role"),
      dataIndex: "role",
      key: "role",
      width: 120,
      render: (role: UserRole) => <Tag color={ROLE_COLOR[role]}>{t(`roles.${role}`)}</Tag>,
    },
    {
      title: t("adminUsers.columns.active"),
      dataIndex: "is_active",
      key: "is_active",
      width: 90,
      render: (v: boolean) => (v ? t("common.yes") : t("common.no")),
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 110,
      render: (_: unknown, record: AdminUser) => (
        <Popconfirm
          title={t("adminUsers.deleteConfirm")}
          onConfirm={() => deleteMutation.mutate(record.id)}
          okText={t("common.delete")}
          cancelText={t("common.cancel")}
          okButtonProps={{ danger: true }}
          disabled={record.id === me?.id}
        >
          <Button danger size="small" disabled={record.id === me?.id}>
            {t("common.delete")}
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
          {t("adminUsers.title")}
        </Typography.Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["admin-users"] })
            }
            loading={isFetching && !isLoading}
          >
            {t("common.refresh")}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            {t("adminUsers.newUser")}
          </Button>
        </Space>
      </Space>

      <Table<AdminUser>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: "max-content" }}
      />

      <NewUserModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
