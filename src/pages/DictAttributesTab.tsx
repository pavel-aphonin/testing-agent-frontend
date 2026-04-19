import {
  DeleteOutlined,
  EditOutlined,
  FolderAddOutlined,
  FolderOutlined,
  PlusOutlined,
  ReloadOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";

import { listAdminUsers } from "@/api/users";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import {
  createAttribute,
  deleteAttribute,
  listAttributes,
  updateAttribute,
} from "@/api/attributes";
import { useAuthStore } from "@/store/auth";
import type { AttributeCreate, AttributeDataType, AttributeRead } from "@/types";
import { buildTree, flattenTree } from "@/utils/tree";
import { notify } from "@/utils/notify";

interface AttrRow extends AttributeRead {
  children?: AttrRow[];
  key: string;
}

const TYPE_LABELS: Record<AttributeDataType, string> = {
  string: "Текст",
  number: "Число",
  boolean: "Да/Нет",
  enum: "Список",
  date: "Дата",
  link: "Ссылка",
  member: "Участник",
};

export function DictAttributesTab() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const myPerms = useMemo(() => new Set(me?.permissions ?? []), [me?.permissions]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AttributeRead | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [parentForNew, setParentForNew] = useState<string | null>(null);
  const [form] = Form.useForm();

  const attrsQ = useQuery({ queryKey: ["attributes"], queryFn: () => listAttributes() });

  const treeData = useMemo<AttrRow[]>(() => {
    if (!attrsQ.data) return [];
    const tree = buildTree(attrsQ.data);
    function toRow(node: { item: AttributeRead; children: any[] }): AttrRow {
      return {
        ...node.item,
        key: node.item.id,
        children: node.children.length > 0 ? node.children.map(toRow) : undefined,
      };
    }
    return tree.map(toRow);
  }, [attrsQ.data]);

  const parentOptions = useMemo(() => {
    if (!attrsQ.data) return [];
    const flat = flattenTree(buildTree(attrsQ.data));
    return flat
      .filter((n) => n.item.is_group)
      .map((n) => ({
        value: n.item.id,
        label: "—".repeat(n.depth) + " " + n.item.name,
      }));
  }, [attrsQ.data]);

  const createM = useMutation({
    mutationFn: createAttribute,
    onSuccess: () => {
      notify.success("Создано");
      qc.invalidateQueries({ queryKey: ["attributes"] });
      closeDrawer();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const updateM = useMutation({
    mutationFn: ({ id, ...rest }: { id: string } & Record<string, unknown>) =>
      updateAttribute(id, rest),
    onSuccess: () => {
      notify.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["attributes"] });
      closeDrawer();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const deleteM = useMutation({
    mutationFn: deleteAttribute,
    onSuccess: () => {
      notify.success("Удалено");
      qc.invalidateQueries({ queryKey: ["attributes"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  function openCreate(asGroup: boolean, parentId: string | null = null) {
    setEditing(null);
    setCreatingGroup(asGroup);
    setParentForNew(parentId);
    form.resetFields();
    form.setFieldsValue({
      data_type: "string",
      scope: "workspace",
      applies_to: "workspace",
      is_required: false,
      parent_id: parentId,
    });
    setDrawerOpen(true);
  }

  function openEdit(attr: AttributeRead) {
    setEditing(attr);
    setCreatingGroup(attr.is_group);
    setParentForNew(null);
    form.setFieldsValue({
      code: attr.code,
      name: attr.name,
      description: attr.description ?? "",
      data_type: attr.data_type,
      scope: attr.scope,
      applies_to: attr.applies_to,
      enum_values: Array.isArray(attr.enum_values)
        ? attr.enum_values.join(", ")
        : attr.enum_values,
      default_value:
        attr.data_type === "date" && typeof attr.default_value === "string"
          ? dayjs(attr.default_value)
          : attr.default_value,
      is_required: attr.is_required,
      parent_id: attr.parent_id,
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
    const dt: AttributeDataType = values.data_type;
    const enumValues = dt === "enum"
      ? (typeof values.enum_values === "string"
        ? values.enum_values.split(",").map((s: string) => s.trim()).filter(Boolean)
        : values.enum_values)
      : null;

    // Normalize default_value based on data_type. dayjs → ISO for date.
    let defaultVal: unknown = values.default_value ?? null;
    if (dt === "date" && defaultVal && typeof defaultVal === "object" && "toISOString" in defaultVal) {
      defaultVal = (defaultVal as dayjs.Dayjs).toISOString();
    }

    if (editing) {
      updateM.mutate({
        id: editing.id,
        name: values.name,
        description: values.description || null,
        enum_values: enumValues,
        default_value: defaultVal,
        is_required: !!values.is_required,
        parent_id: values.parent_id ?? null,
      });
    } else {
      const payload: AttributeCreate = {
        code: values.code,
        name: values.name,
        description: values.description || undefined,
        data_type: dt,
        enum_values: enumValues,
        default_value: defaultVal,
        scope: values.scope,
        applies_to: values.applies_to,
        is_required: !!values.is_required,
        parent_id: values.parent_id ?? parentForNew ?? null,
        is_group: creatingGroup,
      };
      createM.mutate(payload);
    }
  }

  const columns: ColumnsType<AttrRow> = [
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      render: (name: string, rec: AttrRow) => (
        <Space>
          {rec.is_group ? (
            <FolderOutlined style={{ color: "#EE3424" }} />
          ) : (
            <TagOutlined style={{ color: "#888" }} />
          )}
          <strong>{name}</strong>
          {rec.is_required && !rec.is_group && (
            <Tooltip title="Обязательный к заполнению">
              <Tag color="red">*</Tag>
            </Tooltip>
          )}
          {rec.is_system && <Tag color="orange">Системный</Tag>}
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
      title: "Тип",
      dataIndex: "data_type",
      key: "data_type",
      width: 100,
      render: (v: AttributeDataType, rec: AttrRow) =>
        rec.is_group ? "—" : <Tag>{TYPE_LABELS[v] ?? v}</Tag>,
    },
    {
      title: "Область",
      dataIndex: "scope",
      key: "scope",
      width: 120,
      render: (v: string, rec: AttrRow) =>
        rec.is_group ? "—" : <Tag color={v === "workspace" ? "blue" : "green"}>{v === "workspace" ? "Пространство" : "Пользователь"}</Tag>,
    },
    {
      title: "Действия",
      key: "actions",
      width: 200,
      render: (_: unknown, rec: AttrRow) => (
        <Space size="small">
          {myPerms.has("dictionaries.create") && rec.is_group && (
            <Tooltip title="Добавить в эту группу">
              <Button size="small" icon={<PlusOutlined />} onClick={() => openCreate(false, rec.id)} />
            </Tooltip>
          )}
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

  const dataTypeWatch = Form.useWatch("data_type", form);

  // Member-type attributes need a list of users to choose from.
  const usersQ = useQuery({
    queryKey: ["admin-users-for-member-attr"],
    queryFn: listAdminUsers,
    enabled: drawerOpen && dataTypeWatch === "member",
  });

  return (
    <>
      <Space style={{ width: "100%", justifyContent: "flex-end", marginBottom: 16 }}>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => qc.invalidateQueries({ queryKey: ["attributes"] })}
          >
            Обновить
          </Button>
          {myPerms.has("dictionaries.create") && (
            <>
              <Button icon={<FolderAddOutlined />} onClick={() => openCreate(true)}>
                Создать группу
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate(false)}>
                Создать атрибут
              </Button>
            </>
          )}
        </Space>
      </Space>

      <Table<AttrRow>
        rowKey="key"
        columns={columns}
        dataSource={treeData}
        loading={attrsQ.isLoading}
        pagination={false}
        scroll={{ x: "max-content" }}
        expandable={{ defaultExpandAllRows: true }}
      />

      <Drawer
        title={
          editing
            ? `Редактирование: ${editing.name}`
            : creatingGroup
            ? "Новая группа атрибутов"
            : "Новый атрибут"
        }
        placement="right"
        width={520}
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
              label="Код (латиница, snake_case)"
              rules={[
                { required: true, message: "Обязательно" },
                { pattern: /^[a-z][a-z0-9_]*$/, message: "Только a-z, 0-9, _" },
              ]}
            >
              <Input placeholder={creatingGroup ? "ui_settings" : "theme"} />
            </Form.Item>
          )}

          <Form.Item
            name="name"
            label="Название"
            rules={[{ required: true, message: "Обязательно" }]}
          >
            <Input placeholder={creatingGroup ? "Настройки UI" : "Тема"} />
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
              <Form.Item
                name="data_type"
                label="Тип данных"
                rules={[{ required: true }]}
              >
                <Select
                  disabled={Boolean(editing)}
                  options={[
                    { value: "string", label: "Текст" },
                    { value: "number", label: "Число" },
                    { value: "boolean", label: "Да/Нет" },
                    { value: "enum", label: "Список значений" },
                    { value: "date", label: "Дата" },
                    { value: "link", label: "Ссылка (URL)" },
                    { value: "member", label: "Участник (пользователь)" },
                  ]}
                />
              </Form.Item>

              {dataTypeWatch === "enum" && (
                <Form.Item
                  name="enum_values"
                  label="Допустимые значения"
                  extra="Через запятую: Светлая, Тёмная"
                  rules={[{ required: true, message: "Обязательно" }]}
                >
                  <Input placeholder="Светлая, Тёмная" />
                </Form.Item>
              )}

              <Form.Item
                name="default_value"
                label="Значение по умолчанию"
                valuePropName={dataTypeWatch === "boolean" ? "checked" : "value"}
              >
                {dataTypeWatch === "boolean" ? (
                  <Switch />
                ) : dataTypeWatch === "number" ? (
                  <InputNumber style={{ width: "100%" }} />
                ) : dataTypeWatch === "date" ? (
                  <DatePicker style={{ width: "100%" }} showTime />
                ) : dataTypeWatch === "link" ? (
                  <Input placeholder="https://example.com" />
                ) : dataTypeWatch === "member" ? (
                  <Select
                    showSearch
                    allowClear
                    placeholder="Выберите пользователя"
                    options={(usersQ.data ?? []).map((u) => ({
                      value: u.id,
                      label: u.email,
                    }))}
                    filterOption={(input, option) =>
                      (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                  />
                ) : (
                  <Input />
                )}
              </Form.Item>

              <Form.Item
                name="is_required"
                valuePropName="checked"
                style={{ marginBottom: 16 }}
              >
                <Checkbox>Обязательный к заполнению</Checkbox>
              </Form.Item>

              <Form.Item
                name="scope"
                label="Область видимости"
                rules={[{ required: true }]}
              >
                <Select
                  disabled={Boolean(editing)}
                  options={[
                    { value: "workspace", label: "Общая для пространства" },
                    { value: "user", label: "Индивидуальная для пользователя в пространстве" },
                  ]}
                />
              </Form.Item>

              <Form.Item
                name="applies_to"
                label="Привязывается к"
                rules={[{ required: true }]}
              >
                <Select
                  disabled={Boolean(editing)}
                  options={[
                    { value: "workspace", label: "Рабочее пространство" },
                    { value: "user_workspace", label: "Членство в пространстве" },
                  ]}
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Drawer>
    </>
  );
}
