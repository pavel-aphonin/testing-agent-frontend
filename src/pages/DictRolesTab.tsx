import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Checkbox,
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
import { notify } from "@/utils/notify";

/**
 * Справочники → Роли.
 *
 * Two-panel layout:
 *  - Left: table of existing roles with edit / delete
 *  - Right drawer: permission matrix (sections × CRUD checkboxes)
 */
export function DictRolesTab() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const myPerms = useMemo(() => new Set(me?.permissions ?? []), [me?.permissions]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRead | null>(null);
  const [form] = Form.useForm();

  // Data
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: listRoles });
  const registryQ = useQuery({ queryKey: ["perm-registry"], queryFn: getPermissionsRegistry });

  const createM = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      notify.success("Роль создана");
      qc.invalidateQueries({ queryKey: ["roles"] });
      closeDrawer();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const updateM = useMutation({
    mutationFn: ({ id, ...rest }: { id: string; name?: string; description?: string; permissions?: string[] }) =>
      updateRole(id, rest),
    onSuccess: () => {
      notify.success("Роль обновлена");
      qc.invalidateQueries({ queryKey: ["roles"] });
      closeDrawer();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const deleteM = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      notify.success("Роль удалена");
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  function openCreate() {
    setEditingRole(null);
    form.resetFields();
    form.setFieldsValue({ permissions: [] });
    setDrawerOpen(true);
  }

  function openEdit(role: RoleRead) {
    setEditingRole(role);
    form.setFieldsValue({
      name: role.name,
      code: role.code,
      description: role.description ?? "",
      permissions: role.permissions,
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingRole(null);
    form.resetFields();
  }

  function handleSubmit(values: any) {
    const perms: string[] = values.permissions ?? [];
    if (editingRole) {
      updateM.mutate({
        id: editingRole.id,
        name: values.name,
        description: values.description || null,
        permissions: perms,
      });
    } else {
      createM.mutate({
        name: values.name,
        code: values.code,
        description: values.description || undefined,
        permissions: perms,
      });
    }
  }

  // ── Table columns ───────────────────────────────────────────────────────

  const columns: ColumnsType<RoleRead> = [
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      render: (name: string, rec: RoleRead) => (
        <Space>
          <strong>{name}</strong>
          {rec.is_system && <Tag color="orange">Системная</Tag>}
        </Space>
      ),
    },
    {
      title: "Код",
      dataIndex: "code",
      key: "code",
      width: 140,
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    {
      title: "Разрешений",
      dataIndex: "permissions",
      key: "perm_count",
      width: 120,
      render: (perms: string[]) => perms.length,
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
      width: 120,
      render: (_: unknown, rec: RoleRead) => (
        <Space size="small">
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
              title="Удалить эту роль?"
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
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Создать роль
            </Button>
          )}
        </Space>
      </Space>

      <Table<RoleRead>
        rowKey="id"
        columns={columns}
        dataSource={rolesQ.data}
        loading={rolesQ.isLoading}
        pagination={false}
        scroll={{ x: "max-content" }}
      />

      <Drawer
        title={editingRole ? `Редактирование: ${editingRole.name}` : "Новая роль"}
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
            label="Название роли"
            rules={[{ required: true, message: "Обязательно" }]}
          >
            <Input placeholder="QA Lead" />
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
              <Input placeholder="qa_lead" />
            </Form.Item>
          )}

          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} placeholder="Описание роли" />
          </Form.Item>

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

          {/* Hidden form item so the value propagates on submit */}
          <Form.Item name="permissions" hidden>
            <Input />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}

// ── Form-connected wrapper (useWatch must be at top level of a component) ──

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

// ── Permission matrix ─────────────────────────────────────────────────────

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
