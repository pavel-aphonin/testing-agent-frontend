import {
  DeleteOutlined,
  FolderAddOutlined,
  FolderOutlined,
  InboxOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  UndoOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import { buildTree, flattenTree } from "@/utils/tree";

import {
  adminListWorkspaces,
  archiveWorkspace,
  createWorkspace,
  deleteWorkspace,
  restoreWorkspace,
  updateWorkspace,
  uploadWorkspaceLogo,
  workspaceLogoUrl,
} from "@/api/workspaces";
import { useAuthStore } from "@/store/auth";
import type { WorkspaceRead } from "@/types";
import { notify } from "@/utils/notify";

interface WsRow extends WorkspaceRead {
  children?: WsRow[];
  key: string;
}

export function DictWorkspacesTab() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const myPerms = useMemo(() => new Set(me?.permissions ?? []), [me?.permissions]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceRead | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [parentForNew, setParentForNew] = useState<string | null>(null);
  const [form] = Form.useForm();

  const wsQ = useQuery({ queryKey: ["admin-workspaces"], queryFn: adminListWorkspaces });

  const treeData = useMemo<WsRow[]>(() => {
    if (!wsQ.data) return [];
    const tree = buildTree(wsQ.data);
    function toRow(node: { item: WorkspaceRead; children: any[] }): WsRow {
      return {
        ...node.item,
        key: node.item.id,
        children: node.children.length > 0 ? node.children.map(toRow) : undefined,
      };
    }
    return tree.map(toRow);
  }, [wsQ.data]);

  const parentOptions = useMemo(() => {
    if (!wsQ.data) return [];
    const flat = flattenTree(buildTree(wsQ.data));
    return flat
      .filter((n) => n.item.is_group)
      .map((n) => ({
        value: n.item.id,
        label: "—".repeat(n.depth) + " " + n.item.name,
      }));
  }, [wsQ.data]);

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

  const logoM = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadWorkspaceLogo(id, file),
    onSuccess: () => {
      notify.success("Логотип загружен");
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

  function openCreate(asGroup: boolean, parentId: string | null = null) {
    setEditing(null);
    setCreatingGroup(asGroup);
    setParentForNew(parentId);
    form.resetFields();
    form.setFieldsValue({ parent_id: parentId });
    setDrawerOpen(true);
  }

  function openEdit(ws: WorkspaceRead) {
    setEditing(ws);
    setCreatingGroup(ws.is_group);
    setParentForNew(null);
    form.setFieldsValue({
      name: ws.name,
      code: ws.code,
      description: ws.description ?? "",
      parent_id: ws.parent_id,
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditing(null);
    setCreatingGroup(false);
    setParentForNew(null);
    form.resetFields();
  }

  function handleSubmit(values: any) {
    if (editing) {
      updateM.mutate({
        id: editing.id,
        name: values.name,
        description: values.description || null,
        parent_id: values.parent_id ?? null,
      } as any);
    } else {
      createM.mutate({
        code: values.code,
        name: values.name,
        description: values.description || undefined,
        parent_id: values.parent_id ?? parentForNew ?? null,
        is_group: creatingGroup,
      } as any);
    }
  }

  const columns: ColumnsType<WsRow> = [
    {
      title: "Лого",
      key: "logo",
      width: 80,
      render: (_: unknown, rec: WsRow) => {
        if (rec.is_group) return <FolderOutlined style={{ fontSize: 20, color: "#EE3424" }} />;
        const url = workspaceLogoUrl(rec.id, rec.logo_path);
        return url ? (
          <Avatar shape="square" size={32} src={url} />
        ) : (
          <Avatar shape="square" size={32} icon={<PictureOutlined />} />
        );
      },
    },
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      render: (name: string, rec: WsRow) => (
        <Space>
          <strong>{name}</strong>
          {rec.is_group && <Tag color="purple">Группа</Tag>}
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
      width: 280,
      render: (_: unknown, rec: WsRow) => (
        <Space size="small">
          {myPerms.has("dictionaries.create") && rec.is_group && (
            <Tooltip title="Добавить в эту группу">
              <Button size="small" icon={<PlusOutlined />} onClick={() => openCreate(false, rec.id)} />
            </Tooltip>
          )}
          {myPerms.has("dictionaries.edit") && !rec.is_archived && !rec.is_group && (
            <Upload
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              showUploadList={false}
              beforeUpload={(file) => {
                logoM.mutate({ id: rec.id, file });
                return false;
              }}
            >
              <Tooltip title="Загрузить логотип">
                <Button size="small" icon={<UploadOutlined />} />
              </Tooltip>
            </Upload>
          )}
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
            <>
              <Button icon={<FolderAddOutlined />} onClick={() => openCreate(true)}>
                Создать группу
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate(false)}>
                Создать пространство
              </Button>
            </>
          )}
        </Space>
      </Space>

      <Table<WsRow>
        rowKey="key"
        columns={columns}
        dataSource={treeData}
        loading={wsQ.isLoading}
        pagination={false}
        scroll={{ x: "max-content" }}
        expandable={{ defaultExpandAllRows: true }}
      />

      <Drawer
        title={
          editing
            ? `Редактирование: ${editing.name}`
            : creatingGroup
            ? "Новая группа пространств"
            : "Новое рабочее пространство"
        }
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
              <Input placeholder={creatingGroup ? "qa-team" : "alfa-mobile"} />
            </Form.Item>
          )}

          <Form.Item
            name="name"
            label={creatingGroup || editing?.is_group ? "Название группы" : "Название"}
            rules={[{ required: true, message: "Обязательно" }]}
          >
            <Input placeholder={creatingGroup ? "QA команда" : "Альфа-Мобайл QA"} />
          </Form.Item>

          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} placeholder="Описание" />
          </Form.Item>

          <Form.Item name="parent_id" label="Родительская группа">
            <Select
              allowClear
              placeholder="Корневой уровень"
              options={parentOptions}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
