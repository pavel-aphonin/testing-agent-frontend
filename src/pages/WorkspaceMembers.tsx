import { DeleteOutlined, PlusOutlined, SettingOutlined, UserAddOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Drawer,
  Form,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import { AttributeValuesEditor } from "@/components/AttributeValuesEditor";
import { createInvitation } from "@/api/notifications";
import { listAdminUsers } from "@/api/users";
import { addMember, listMembers, removeMember } from "@/api/workspaces";
import { useAuthStore } from "@/store/auth";
import { useWorkspaceStore } from "@/store/workspace";
import type { WorkspaceMemberRead } from "@/types";
import { notify } from "@/utils/notify";

const ROLE_COLOR: Record<string, string> = {
  owner: "gold",
  moderator: "blue",
  member: "default",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Владелец",
  moderator: "Модератор",
  member: "Участник",
};

/**
 * Members of the currently selected workspace.
 *
 * Two ways to add a user: invite (sends notification) or add directly.
 * Only moderators/owners (or system admins) see the add button.
 */
export function WorkspaceMembers() {
  const ws = useWorkspaceStore((s) => s.current);
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [attrMember, setAttrMember] = useState<WorkspaceMemberRead | null>(null);

  const membersQ = useQuery({
    queryKey: ["ws-members", ws?.id ?? "none"],
    queryFn: () => (ws ? listMembers(ws.id) : Promise.resolve([])),
    enabled: Boolean(ws),
  });

  const removeM = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      ws ? removeMember(ws.id, userId) : Promise.reject(),
    onSuccess: () => {
      notify.success("Участник удалён");
      qc.invalidateQueries({ queryKey: ["ws-members"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  // Determine if current user is a moderator/owner of this workspace.
  const myMember = membersQ.data?.find((m) => m.user_id === me?.id);
  const canManage =
    myMember?.role === "owner" ||
    myMember?.role === "moderator" ||
    me?.permissions?.includes("users.view");

  if (!ws) {
    return (
      <Alert
        type="info"
        message="Выберите рабочее пространство в переключателе сверху"
        showIcon
      />
    );
  }

  const columns: ColumnsType<WorkspaceMemberRead> = [
    {
      title: "Email",
      dataIndex: "user_email",
      key: "user_email",
    },
    {
      title: "Роль",
      dataIndex: "role",
      key: "role",
      width: 140,
      render: (role: string) => (
        <Tag color={ROLE_COLOR[role] ?? "default"}>
          {ROLE_LABEL[role] ?? role}
        </Tag>
      ),
    },
    {
      title: "Дата вступления",
      dataIndex: "joined_at",
      key: "joined_at",
      width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "Действия",
      key: "actions",
      width: 160,
      render: (_: unknown, rec: WorkspaceMemberRead) => (
        <Space size="small">
          <Tooltip title="Атрибуты участника">
            <Button
              size="small"
              icon={<SettingOutlined />}
              onClick={() => setAttrMember(rec)}
            />
          </Tooltip>
          {canManage && rec.role !== "owner" && (
            <Popconfirm
              title="Удалить участника?"
              onConfirm={() => removeM.mutate({ userId: rec.user_id })}
              okText="Удалить"
              cancelText="Отмена"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Участники: {ws.name}
        </Typography.Title>
        {canManage && (
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => setModalOpen(true)}>
            Добавить участника
          </Button>
        )}
      </Space>

      <Table<WorkspaceMemberRead>
        rowKey="id"
        columns={columns}
        dataSource={membersQ.data}
        loading={membersQ.isLoading}
        pagination={false}
      />

      <AddMemberModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        workspaceId={ws.id}
        existingUserIds={new Set(membersQ.data?.map((m) => m.user_id) ?? [])}
      />

      <Drawer
        title={attrMember ? `Атрибуты: ${attrMember.user_email}` : ""}
        open={Boolean(attrMember)}
        onClose={() => setAttrMember(null)}
        width={560}
      >
        {attrMember && (
          <AttributeValuesEditor
            entityType="user_workspace"
            entityId={attrMember.id}
          />
        )}
      </Drawer>
    </>
  );
}

// ── Add member modal ──────────────────────────────────────────────────────

function AddMemberModal({
  open,
  onClose,
  workspaceId,
  existingUserIds,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  existingUserIds: Set<string>;
}) {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [mode, setMode] = useState<"invite" | "direct">("invite");

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: listAdminUsers,
    enabled: open,
  });

  const inviteM = useMutation({
    mutationFn: createInvitation,
    onSuccess: () => {
      notify.success("Приглашение отправлено");
      qc.invalidateQueries({ queryKey: ["ws-members"] });
      onClose();
      form.resetFields();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const addM = useMutation({
    mutationFn: (payload: { user_id: string; role: string }) =>
      addMember(workspaceId, payload),
    onSuccess: () => {
      notify.success("Участник добавлен");
      qc.invalidateQueries({ queryKey: ["ws-members"] });
      onClose();
      form.resetFields();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const userOptions = (usersQ.data ?? [])
    .filter((u) => !existingUserIds.has(u.id))
    .map((u) => ({ value: u.id, label: u.email }));

  function handleSubmit(values: any) {
    if (mode === "invite") {
      inviteM.mutate({
        workspace_id: workspaceId,
        invitee_user_id: values.user_id,
        role: values.role,
      });
    } else {
      addM.mutate({
        user_id: values.user_id,
        role: values.role,
      });
    }
  }

  return (
    <Modal
      title="Добавить участника"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={mode === "invite" ? "Пригласить" : "Добавить"}
      cancelText="Отмена"
      confirmLoading={inviteM.isPending || addM.isPending}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ role: "member" }}>
        <Form.Item label="Способ">
          <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
            <Radio value="invite">
              <UserAddOutlined /> Пригласить (отправить уведомление)
            </Radio>
            <Radio value="direct">
              <PlusOutlined /> Добавить сразу
            </Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="user_id"
          label="Пользователь"
          rules={[{ required: true, message: "Выберите пользователя" }]}
        >
          <Select
            showSearch
            placeholder="Введите email или выберите"
            options={userOptions}
            filterOption={(input, option) =>
              (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
            }
            loading={usersQ.isLoading}
          />
        </Form.Item>

        <Form.Item name="role" label="Роль в пространстве">
          <Select
            options={[
              { value: "member", label: "Участник" },
              { value: "moderator", label: "Модератор" },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
