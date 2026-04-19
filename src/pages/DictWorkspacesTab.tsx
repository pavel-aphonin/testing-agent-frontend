import {
  DeleteOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import {
  adminListWorkspaces,
  archiveWorkspace,
  createWorkspace,
  deleteWorkspace,
  restoreWorkspace,
  updateWorkspace,
} from "@/api/workspaces";
import { useAuthStore } from "@/store/auth";
import type { WorkspaceRead } from "@/types";
import { notify } from "@/utils/notify";

export function DictWorkspacesTab() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const myPerms = useMemo(() => new Set(me?.permissions ?? []), [me?.permissions]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceRead | null>(null);
  const [form] = Form.useForm();

  const wsQ = useQuery({ queryKey: ["admin-workspaces"], queryFn: adminListWorkspaces });

  const createM = useMutation({
    mutationFn: createWorkspace,
    onSuccess: () => {
      notify.success("Пространство создано");
      qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
      qc.invalidateQueries({ queryKey: ["my-workspaces"] });
      closeDrawer();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const updateM = useMutation({
    mutationFn: ({ id, ...rest }: { id: string; name?: string; description?: string }) =>
      updateWorkspace(id, rest),
    onSuccess: () => {
      notify.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
      qc.invalidateQueries({ queryKey: ["my-workspaces"] });
      closeDrawer();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const archiveM = useMutation({
    mutationFn: archiveWorkspace,
    onSuccess: () => {
      notify.success("Пространство архивировано");
      qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
      qc.invalidateQueries({ queryKey: ["my-workspaces"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const restoreM = useMutation({
    mutationFn: restoreWorkspace,
    onSuccess: () => {
      notify.success("Пространство восстановлено");
      qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
      qc.invalidateQueries({ queryKey: ["my-workspaces"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const deleteM = useMutation({
    mutationFn: deleteWorkspace,
    onSuccess: () => {
      notify.success("Пространство удалено");
      qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
      qc.invalidateQueries({ queryKey: ["my-workspaces"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setDrawerOpen(true);
  }

  function openEdit(ws: WorkspaceRead) {
    setEditing(ws);
    form.setFieldsValue({
      name: ws.name,
      code: ws.code,
      description: ws.description ?? "",
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditing(null);
    form.resetFields();
  }

  function handleSubmit(values: any) {
    if (editing) {
      updateM.mutate({ id: editing.id, name: values.name, description: values.description || null });
    } else {
      createM.mutate({
        code: values.code,
        name: values.name,
        description: values.description || undefined,
      });
    }
  }

  const columns: ColumnsType<WorkspaceRead> = [
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      render: (name: string, rec: WorkspaceRead) => (
        <Space>
          <strong>{name}</strong>
          {rec.is_archived && <Tag color="orange">Архив</Tag>}
        </Space>
      ),
    },
    {
      title: "Код",
      dataIndex: "code",
      key: "code",
      width: 160,
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    {
      title: "Описание",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "Действия",
      key: "actions",
      width: 180,
      render: (_: unknown, rec: WorkspaceRead) => (
        <Space size="small">
          {myPerms.has("dictionaries.edit") && !rec.is_archived && (
            <Tooltip title="Редактировать">
              <Button size="small" onClick={() => openEdit(rec)}>
                Изм.
              </Button>
            </Tooltip>
          )}
          {myPerms.has("dictionaries.edit") && !rec.is_archived && (
            <Popconfirm
              title="Архивировать пространство?"
              onConfirm={() => archiveM.mutate(rec.id)}
              okText="Да"
              cancelText="Нет"
            >
              <Tooltip title="Архивировать">
                <Button size="small" icon={<InboxOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          {myPerms.has("dictionaries.edit") && rec.is_archived && (
            <Tooltip title="Восстановить">
              <Button size="small" icon={<UndoOutlined />} onClick={() => restoreM.mutate(rec.id)} />
            </Tooltip>
          )}
          {myPerms.has("dictionaries.delete") && rec.is_archived && (
            <Popconfirm
              title="Удалить безвозвратно?"
              onConfirm={() => deleteM.mutate(rec.id)}
              okText="Удалить"
              cancelText="Нет"
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
      <Space style={{ width: "100%", justifyContent: "flex-end", marginBottom: 16 }}>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => qc.invalidateQueries({ queryKey: ["admin-workspaces"] })}
          >
            Обновить
          </Button>
          {myPerms.has("dictionaries.create") && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Создать пространство
            </Button>
          )}
        </Space>
      </Space>

      <Table<WorkspaceRead>
        rowKey="id"
        columns={columns}
        dataSource={wsQ.data}
        loading={wsQ.isLoading}
        pagination={false}
        scroll={{ x: "max-content" }}
      />

      <Drawer
        title={editing ? `Редактирование: ${editing.name}` : "Новое рабочее пространство"}
        placement="right"
        width={480}
        open={drawerOpen}
        onClose={closeDrawer}
        extra={
          <Button
            type="primary"
            loading={createM.isPending || updateM.isPending}
            onClick={() => form.submit()}
          >
            {editing ? "Сохранить" : "Создать"}
          </Button>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {!editing && (
            <Form.Item
              name="code"
              label="Код (латиница, дефисы)"
              rules={[
                { required: true, message: "Обязательно" },
                { pattern: /^[a-z][a-z0-9_-]*$/, message: "Только a-z, 0-9, -, _" },
              ]}
            >
              <Input placeholder="alfa-mobile" />
            </Form.Item>
          )}

          <Form.Item
            name="name"
            label="Название"
            rules={[{ required: true, message: "Обязательно" }]}
          >
            <Input placeholder="Альфа-Мобайл QA" />
          </Form.Item>

          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} placeholder="Описание рабочего пространства" />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
