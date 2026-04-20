import * as Icons from "@ant-design/icons";
import {
  DeleteOutlined,
  EditOutlined,
  FolderAddOutlined,
  FolderOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  ColorPicker,
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
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import {
  createNotificationType,
  deleteNotificationType,
  listNotificationTypes,
  updateNotificationType,
} from "@/api/notificationTypes";
import { useAuthStore } from "@/store/auth";
import type { NotificationTypeRead } from "@/types";
import { buildTree, flattenTree } from "@/utils/tree";
import { notify } from "@/utils/notify";

interface TypeRow extends NotificationTypeRead {
  children?: TypeRow[];
  key: string;
}

// Common Ant Design icons that make sense for notifications
const ICON_OPTIONS = [
  "Bell", "Mail", "Bug", "CheckCircle", "WarningOutline", "InfoCircle",
  "Alert", "Notification", "Message", "ExclamationCircle", "Star", "Flag",
  "Tag", "ThunderBolt", "Fire", "Trophy", "Heart", "User", "Team",
];

function renderIcon(name: string, color?: string) {
  const IconComp = (Icons as any)[`${name}Outlined`] ?? Icons.BellOutlined;
  return <IconComp style={{ color, fontSize: 16 }} />;
}

export function DictNotificationTypesTab() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const myPerms = useMemo(() => new Set(me?.permissions ?? []), [me?.permissions]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationTypeRead | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [form] = Form.useForm();

  const typesQ = useQuery({ queryKey: ["notification-types"], queryFn: listNotificationTypes });

  const treeData = useMemo<TypeRow[]>(() => {
    if (!typesQ.data) return [];
    const tree = buildTree(typesQ.data);
    function toRow(node: any): TypeRow {
      return {
        ...node.item,
        key: node.item.id,
        children: node.children.length > 0 ? node.children.map(toRow) : undefined,
      };
    }
    return tree.map(toRow);
  }, [typesQ.data]);

  const parentOptions = useMemo(() => {
    if (!typesQ.data) return [];
    const flat = flattenTree(buildTree(typesQ.data));
    return flat
      .filter((n) => n.item.is_group)
      .map((n) => ({
        value: n.item.id,
        label: "—".repeat(n.depth) + " " + n.item.name,
      }));
  }, [typesQ.data]);

  const createM = useMutation({
    mutationFn: createNotificationType,
    onSuccess: () => {
      notify.success("Создано");
      qc.invalidateQueries({ queryKey: ["notification-types"] });
      closeDrawer();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const updateM = useMutation({
    mutationFn: ({ id, ...rest }: any) => updateNotificationType(id, rest),
    onSuccess: () => {
      notify.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["notification-types"] });
      closeDrawer();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const deleteM = useMutation({
    mutationFn: deleteNotificationType,
    onSuccess: () => {
      notify.success("Удалено");
      qc.invalidateQueries({ queryKey: ["notification-types"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  function openCreate(asGroup: boolean) {
    setEditing(null);
    setCreatingGroup(asGroup);
    form.resetFields();
    form.setFieldsValue({ color: "#888888", icon: "Bell" });
    setDrawerOpen(true);
  }

  function openEdit(t: NotificationTypeRead) {
    setEditing(t);
    setCreatingGroup(t.is_group);
    form.setFieldsValue({
      code: t.code,
      name: t.name,
      description: t.description ?? "",
      color: t.color,
      icon: t.icon,
      template: t.template ?? "",
      parent_id: t.parent_id,
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditing(null);
    setCreatingGroup(false);
    form.resetFields();
  }

  function handleSubmit(values: any) {
    const color = typeof values.color === "object" ? values.color.toHexString() : values.color;
    if (editing) {
      updateM.mutate({
        id: editing.id,
        name: values.name,
        description: values.description || null,
        color,
        icon: values.icon,
        template: values.template || null,
        parent_id: values.parent_id ?? null,
      });
    } else {
      createM.mutate({
        code: values.code,
        name: values.name,
        description: values.description || undefined,
        color,
        icon: values.icon,
        template: values.template || null,
        parent_id: values.parent_id ?? null,
        is_group: creatingGroup,
      });
    }
  }

  const columns: ColumnsType<TypeRow> = [
    {
      title: "",
      key: "icon",
      width: 50,
      render: (_, rec) => (rec.is_group ? <FolderOutlined /> : renderIcon(rec.icon, rec.color)),
    },
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      render: (name: string, rec: TypeRow) => (
        <Space>
          <strong>{name}</strong>
          {rec.is_system && <Tag color="orange">Системный</Tag>}
        </Space>
      ),
    },
    {
      title: "Код",
      dataIndex: "code",
      key: "code",
      width: 180,
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    {
      title: "Цвет",
      dataIndex: "color",
      key: "color",
      width: 100,
      render: (v: string, rec: TypeRow) =>
        rec.is_group ? "—" : (
          <Space>
            <span
              style={{
                display: "inline-block",
                width: 16,
                height: 16,
                borderRadius: 4,
                background: v,
                border: "1px solid #ddd",
              }}
            />
            <Typography.Text style={{ fontSize: 11 }} type="secondary">{v}</Typography.Text>
          </Space>
        ),
    },
    {
      title: "Шаблон",
      dataIndex: "template",
      key: "template",
      ellipsis: true,
      render: (v: string | null) =>
        v ? <Typography.Text code style={{ fontSize: 11 }}>{v}</Typography.Text> : <em>—</em>,
    },
    {
      title: "Действия",
      key: "actions",
      width: 140,
      render: (_: unknown, rec: TypeRow) => (
        <Space size="small">
          {myPerms.has("dictionaries.edit") && (
            <Tooltip title="Редактировать">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)} />
            </Tooltip>
          )}
          {myPerms.has("dictionaries.delete") && !rec.is_system && (
            <Popconfirm
              title="Удалить?"
              onConfirm={() => deleteM.mutate(rec.id)}
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
      <Space style={{ width: "100%", justifyContent: "flex-end", marginBottom: 16 }}>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => qc.invalidateQueries({ queryKey: ["notification-types"] })}
          >
            Обновить
          </Button>
          {myPerms.has("dictionaries.create") && (
            <>
              <Button icon={<FolderAddOutlined />} onClick={() => openCreate(true)}>
                Создать группу
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate(false)}>
                Создать тип
              </Button>
            </>
          )}
        </Space>
      </Space>

      <Table<TypeRow>
        rowKey="key"
        columns={columns}
        dataSource={treeData}
        loading={typesQ.isLoading}
        pagination={false}
        scroll={{ x: "max-content" }}
        expandable={{ defaultExpandAllRows: true }}
      />

      <Drawer
        title={
          editing
            ? `Редактирование: ${editing.name}`
            : creatingGroup
            ? "Новая группа типов"
            : "Новый тип уведомления"
        }
        open={drawerOpen}
        onClose={closeDrawer}
        width={520}
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
              label="Код"
              rules={[
                { required: true, message: "Обязательно" },
                { pattern: /^[a-z][a-z0-9_]*$/, message: "Только a-z, 0-9, _" },
              ]}
            >
              <Input placeholder="run_failed" />
            </Form.Item>
          )}

          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input placeholder="Запуск с ошибкой" />
          </Form.Item>

          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item name="parent_id" label="Родительская группа">
            <Select
              allowClear
              placeholder="Корневой уровень"
              options={parentOptions}
            />
          </Form.Item>

          {!(creatingGroup || editing?.is_group) && (
            <>
              <Form.Item name="color" label="Цвет">
                <ColorPicker showText format="hex" />
              </Form.Item>

              <Form.Item name="icon" label="Иконка">
                <Select
                  showSearch
                  options={ICON_OPTIONS.map((i) => ({
                    value: i,
                    label: (
                      <Space>
                        {renderIcon(i)}
                        <span>{i}</span>
                      </Space>
                    ),
                  }))}
                  filterOption={(input, option) =>
                    String(option?.value ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>

              <Form.Item
                name="template"
                label="Шаблон заголовка"
                extra="Можно использовать {placeholders} из payload, например: «{run_title} завершён»"
              >
                <Input placeholder="Запуск {run_title} завершён" />
              </Form.Item>
            </>
          )}
        </Form>
      </Drawer>
    </>
  );
}
