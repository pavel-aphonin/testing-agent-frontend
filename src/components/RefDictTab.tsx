import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
} from "antd";
import { useMemo, useState } from "react";

import { createRef, deleteRef, listRef, updateRef, type RefRow } from "@/api/reference";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { useAuthStore } from "@/store/auth";
import { notify } from "@/utils/notify";

interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "select" | "switch" | "number";
  options?: { value: string; label: string }[];
  required?: boolean;
  width?: number;
  defaultValue?: unknown;
}

interface Props {
  /** Backend resource name, e.g. "platforms", "action-types". */
  kind: string;
  /** Per-table preferences storage key, e.g. "ref.platforms". */
  tableKey: string;
  /** Extra fields to render in the form (code/name/is_active are always there). */
  fields: FieldDef[];
  /** Extra columns shown in the table (code/name/is_active always shown). */
  extraColumns?: DataTableColumn<RefRow>[];
  /** Title for the create button. */
  createLabel?: string;
}

/**
 * Generic CRUD table for system reference dictionaries (platforms,
 * OS versions, device types, action types, test data types). Each
 * uses the same /api/reference/{kind} contract.
 */
export function RefDictTab({ kind, tableKey, fields, extraColumns = [], createLabel = "Создать" }: Props) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const myPerms = useMemo(() => new Set(me?.permissions ?? []), [me?.permissions]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<RefRow | null>(null);
  const [form] = Form.useForm();

  const dataQ = useQuery({ queryKey: ["ref", kind], queryFn: () => listRef(kind) });

  const createM = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createRef(kind, payload),
    onSuccess: () => {
      notify.success("Создано");
      qc.invalidateQueries({ queryKey: ["ref", kind] });
      close();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updateRef(kind, id, payload),
    onSuccess: () => {
      notify.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["ref", kind] });
      close();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteRef(kind, id),
    onSuccess: () => {
      notify.success("Удалено");
      qc.invalidateQueries({ queryKey: ["ref", kind] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  function openCreate() {
    setEditing(null);
    form.resetFields();
    const defaults: Record<string, unknown> = { is_active: true };
    for (const f of fields) {
      if (f.defaultValue !== undefined) defaults[f.name] = f.defaultValue;
    }
    form.setFieldsValue(defaults);
    setDrawerOpen(true);
  }
  function openEdit(row: RefRow) {
    setEditing(row);
    form.setFieldsValue(row as any);
    setDrawerOpen(true);
  }
  function close() {
    setDrawerOpen(false);
    setEditing(null);
    form.resetFields();
  }

  function submit(values: Record<string, unknown>) {
    if (editing) {
      updateM.mutate({ id: editing.id, payload: values });
    } else {
      createM.mutate(values);
    }
  }

  const columns: DataTableColumn<RefRow>[] = [
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v: unknown, rec: RefRow) => (
        <Space>
          <strong>{v as string}</strong>
          {rec.is_system && <Tag color="orange">Системный</Tag>}
        </Space>
      ),
    },
    {
      title: "Код",
      dataIndex: "code",
      key: "code",
      width: 200,
      sorter: (a, b) => a.code.localeCompare(b.code),
      render: (v: unknown) => <code>{v as string}</code>,
    },
    ...extraColumns,
    {
      title: "Активен",
      dataIndex: "is_active",
      key: "is_active",
      width: 100,
      filters: [
        { text: "Да", value: true as any },
        { text: "Нет", value: false as any },
      ],
      onFilter: (v, r) => r.is_active === v,
      render: (v: unknown) => (v ? "Да" : "Нет"),
    },
    {
      title: "Действия",
      key: "actions",
      width: 120,
      toggleable: false,
      render: (_: unknown, rec: RefRow) => (
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
    <DataTable<RefRow>
      tableKey={tableKey}
      rowKey="id"
      columns={columns}
      dataSource={dataQ.data}
      loading={dataQ.isLoading}
      pagination={{ pageSize: 50 }}
      toolbar={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ["ref", kind] })}>
            Обновить
          </Button>
          {myPerms.has("dictionaries.create") && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {createLabel}
            </Button>
          )}
          <Drawer
            title={editing ? `Редактирование: ${editing.name}` : createLabel}
            open={drawerOpen}
            onClose={close}
            width={480}
            extra={
              <Button
                type="primary"
                onClick={() => form.submit()}
                loading={createM.isPending || updateM.isPending}
              >
                {editing ? "Сохранить" : "Создать"}
              </Button>
            }
          >
            <Form form={form} layout="vertical" onFinish={submit}>
              {!editing && (
                <Form.Item
                  name="code"
                  label="Код"
                  rules={[
                    { required: true, message: "Обязательно" },
                    { pattern: /^[a-z0-9._-]+$/, message: "Только a-z, 0-9, _, -, ." },
                  ]}
                >
                  <Input />
                </Form.Item>
              )}
              <Form.Item name="name" label="Название" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              {fields.map((f) => (
                <Form.Item
                  key={f.name}
                  name={f.name}
                  label={f.label}
                  rules={f.required ? [{ required: true, message: "Обязательно" }] : []}
                  valuePropName={f.type === "switch" ? "checked" : "value"}
                >
                  {f.type === "select" ? (
                    <Select options={f.options ?? []} />
                  ) : f.type === "switch" ? (
                    <Switch />
                  ) : f.type === "number" ? (
                    <Input type="number" />
                  ) : (
                    <Input />
                  )}
                </Form.Item>
              ))}
              <Form.Item name="is_active" label="Активен" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Form>
          </Drawer>
        </Space>
      }
    />
  );
}
