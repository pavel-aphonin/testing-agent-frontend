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
  Card,
  Checkbox,
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
  theme,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  createRole,
  deleteRole,
  getPermissionsRegistry,
  listRoles,
  updateRole,
} from "@/api/roles";
import { useAuthStore } from "@/store/auth";
import type { PermissionsRegistry, RoleRead, SectionMeta } from "@/types";
import { buildTree, flattenTree } from "@/utils/tree";
import { notify } from "@/utils/notify";

interface RoleRow extends RoleRead {
  children?: RoleRow[];
  key: string;
}

export function DictRolesTab() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const myPerms = useMemo(() => new Set(me?.permissions ?? []), [me?.permissions]);
  const { token } = theme.useToken();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRead | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [parentForNew, setParentForNew] = useState<string | null>(null);
  const [form] = Form.useForm();

  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: listRoles });
  const registryQ = useQuery({ queryKey: ["perm-registry"], queryFn: getPermissionsRegistry });

  const treeData = useMemo<RoleRow[]>(() => {
    if (!rolesQ.data) return [];
    const tree = buildTree(rolesQ.data);
    function toRow(node: { item: RoleRead; children: any[] }): RoleRow {
      return {
        ...node.item,
        key: node.item.id,
        children: node.children.length > 0 ? node.children.map(toRow) : undefined,
      };
    }
    return tree.map(toRow);
  }, [rolesQ.data]);

  const parentOptions = useMemo(() => {
    if (!rolesQ.data) return [];
    const flat = flattenTree(buildTree(rolesQ.data));
    return flat
      .filter((n) => n.item.is_group)
      .map((n) => ({
        value: n.item.id,
        label: "—".repeat(n.depth) + " " + n.item.name,
      }));
  }, [rolesQ.data]);

  const createM = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      notify.success("Создано");
      qc.invalidateQueries({ queryKey: ["roles"] });
      closeDrawer();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const updateM = useMutation({
    mutationFn: ({ id, ...rest }: { id: string } & Record<string, unknown>) =>
      updateRole(id, rest),
    onSuccess: () => {
      notify.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["roles"] });
      closeDrawer();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const deleteM = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      notify.success("Удалено");
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  function openCreate(asGroup: boolean, parentId: string | null = null) {
    setEditingRole(null);
    setCreatingGroup(asGroup);
    setParentForNew(parentId);
    form.resetFields();
    form.setFieldsValue({ permissions: [], parent_id: parentId });
    setDrawerOpen(true);
  }

  function openEdit(role: RoleRead) {
    setEditingRole(role);
    setCreatingGroup(role.is_group);
    setParentForNew(null);
    form.setFieldsValue({
      name: role.name,
      code: role.code,
      description: role.description ?? "",
      permissions: role.permissions,
      parent_id: role.parent_id,
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingRole(null);
    setCreatingGroup(false);
    setParentForNew(null);
    form.resetFields();
  }

  function handleSubmit(values: any) {
    if (editingRole) {
      updateM.mutate({
        id: editingRole.id,
        name: values.name,
        description: values.description || null,
        permissions: editingRole.is_group ? [] : (values.permissions ?? []),
        parent_id: values.parent_id ?? null,
      });
    } else {
      createM.mutate({
        name: values.name,
        code: values.code,
        description: values.description || undefined,
        permissions: creatingGroup ? [] : (values.permissions ?? []),
        parent_id: values.parent_id ?? parentForNew ?? null,
        is_group: creatingGroup,
      });
    }
  }

  const columns: ColumnsType<RoleRow> = [
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      render: (name: string, rec: RoleRow) => (
        <Space>
          {rec.is_group ? (
            <FolderOutlined style={{ color: "#EE3424" }} />
          ) : (
            <TagOutlined style={{ color: token.colorTextSecondary }} />
          )}
          <strong>{name}</strong>
          {rec.is_system && <Tag color="orange">Системная</Tag>}
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
      title: "Разрешений",
      dataIndex: "permissions",
      key: "perm_count",
      width: 120,
      render: (perms: string[], rec: RoleRow) => (rec.is_group ? "—" : perms.length),
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
      width: 200,
      render: (_: unknown, rec: RoleRow) => (
        <Space size="small">
          {myPerms.has("dictionaries.create") && rec.is_group && (
            <Tooltip title="Добавить в эту группу">
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => openCreate(false, rec.id)}
              />
            </Tooltip>
          )}
          {myPerms.has("dictionaries.edit") && (
            <Tooltip title="Редактировать">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(rec)}
              />
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
            onClick={() => qc.invalidateQueries({ queryKey: ["roles"] })}
          >
            {t("common.refresh")}
          </Button>
          {myPerms.has("dictionaries.create") && (
            <>
              <Button icon={<FolderAddOutlined />} onClick={() => openCreate(true)}>
                Создать группу
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate(false)}>
                Создать роль
              </Button>
            </>
          )}
        </Space>
      </Space>

      <Table<RoleRow>
        rowKey="key"
        columns={columns}
        dataSource={treeData}
        loading={rolesQ.isLoading}
        pagination={false}
        scroll={{ x: "max-content" }}
        expandable={{ defaultExpandAllRows: true }}
      />

      <Drawer
        title={
          editingRole
            ? `Редактирование: ${editingRole.name}`
            : creatingGroup
            ? "Новая группа ролей"
            : "Новая роль"
        }
        placement="right"
        width={640}
        open={drawerOpen}
        onClose={closeDrawer}
        extra={
          <Button
            type="primary"
            loading={createM.isPending || updateM.isPending}
            onClick={() => form.submit()}
          >
            {editingRole ? "Сохранить" : "Создать"}
          </Button>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label={creatingGroup || editingRole?.is_group ? "Название группы" : "Название роли"}
            rules={[{ required: true, message: "Обязательно" }]}
          >
            <Input placeholder={creatingGroup ? "Системные роли" : "QA Lead"} />
          </Form.Item>

          {!editingRole && (
            <Form.Item
              name="code"
              label="Код (латиница, snake_case)"
              rules={[
                { required: true, message: "Обязательно" },
                { pattern: /^[a-z][a-z0-9_]*$/, message: "Только a-z, 0-9, _" },
              ]}
            >
              <Input placeholder={creatingGroup ? "system_roles" : "qa_lead"} />
            </Form.Item>
          )}

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

          {!(creatingGroup || editingRole?.is_group) && (
            <>
              <Typography.Title level={5} style={{ marginTop: 16 }}>
                Разрешения
              </Typography.Title>
              {registryQ.data && (
                <PermissionMatrixConnected
                  form={form}
                  registry={registryQ.data}
                  lang={lang}
                />
              )}
              <Form.Item name="permissions" hidden>
                <Input />
              </Form.Item>
            </>
          )}
        </Form>
      </Drawer>
    </>
  );
}

function PermissionMatrixConnected({
  form,
  registry,
  lang,
}: {
  form: ReturnType<typeof Form.useForm>[0];
  registry: PermissionsRegistry;
  lang: string;
}) {
  const watched = Form.useWatch("permissions", form);
  const value: string[] = Array.isArray(watched) ? watched : [];
  return (
    <PermissionMatrix
      registry={registry}
      lang={lang}
      value={value}
      onChange={(perms) => form.setFieldsValue({ permissions: perms })}
    />
  );
}

interface PermissionMatrixProps {
  registry: PermissionsRegistry;
  lang: string;
  value: string[];
  onChange: (perms: string[]) => void;
}

function PermissionMatrix({ registry, lang, value, onChange }: PermissionMatrixProps) {
  const permsSet = useMemo(() => new Set(value), [value]);

  function toggle(perm: string, checked: boolean) {
    const next = new Set(permsSet);
    if (checked) next.add(perm);
    else next.delete(perm);
    onChange(Array.from(next).sort());
  }

  function toggleSection(section: SectionMeta, checked: boolean) {
    const next = new Set(permsSet);
    for (const perm of Object.keys(section.permissions)) {
      if (checked) next.add(perm);
      else next.delete(perm);
    }
    onChange(Array.from(next).sort());
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      const all: string[] = [];
      for (const sec of Object.values(registry.sections)) {
        all.push(...Object.keys(sec.permissions));
      }
      onChange(all.sort());
    } else {
      onChange([]);
    }
  }

  const allPerms: string[] = [];
  for (const sec of Object.values(registry.sections)) {
    allPerms.push(...Object.keys(sec.permissions));
  }
  const allSelected = allPerms.every((p) => permsSet.has(p));

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Checkbox checked={allSelected} onChange={(e) => toggleAll(e.target.checked)}>
          <strong>Выбрать все</strong>
        </Checkbox>
      </div>

      {Object.entries(registry.sections).map(([key, section]) => {
        const sectionPerms = Object.keys(section.permissions);
        const sectionAllChecked = sectionPerms.every((p) => permsSet.has(p));
        const sectionSomeChecked = sectionPerms.some((p) => permsSet.has(p));
        const sectionLabel = lang.startsWith("ru") ? section.label_ru : section.label_en;

        return (
          <Card
            key={key}
            size="small"
            style={{ marginBottom: 8 }}
            styles={{ body: { padding: "8px 12px" } }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Checkbox
                checked={sectionAllChecked}
                indeterminate={sectionSomeChecked && !sectionAllChecked}
                onChange={(e) => toggleSection(section, e.target.checked)}
                style={{ minWidth: 160 }}
              >
                <strong>{sectionLabel}</strong>
              </Checkbox>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {Object.entries(section.permissions).map(([perm, meta]) => {
                  const label = lang.startsWith("ru") ? meta.ru : meta.en;
                  return (
                    <Checkbox
                      key={perm}
                      checked={permsSet.has(perm)}
                      onChange={(e) => toggle(perm, e.target.checked)}
                    >
                      {label}
                    </Checkbox>
                  );
                })}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
