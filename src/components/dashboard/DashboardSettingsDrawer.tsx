import { DeleteOutlined, EditOutlined, UserAddOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  List,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { useEffect } from "react";

import {
  grantDashboardPermission,
  listDashboardPermissions,
  revokeDashboardPermission,
  updateDashboard,
} from "@/api/dashboards";
import { listMembers } from "@/api/workspaces";
import { useAuthStore } from "@/store/auth";
import type { DashboardSummary } from "@/types";
import { notify } from "@/utils/notify";

/**
 * Dashboard-level settings drawer. Two tabs:
 *   - «Основное» — name / icon / description. System dashboards keep
 *     a read-only name (it mirrors the workspace's).
 *   - «Доступ» — grant view/edit to specific workspace members. Only
 *     exposed for user dashboards; the system one is governed by
 *     workspace roles and has no user-level ACL.
 */
interface Props {
  dashboard: DashboardSummary | null;
  onClose: () => void;
}

export function DashboardSettingsDrawer({ dashboard, onClose }: Props) {
  return (
    <Drawer
      open={!!dashboard}
      onClose={onClose}
      title={dashboard ? `Настройки: ${dashboard.name}` : ""}
      width={560}
      destroyOnHidden
    >
      {dashboard && <DashboardSettingsTabs dashboard={dashboard} onClose={onClose} />}
    </Drawer>
  );
}

function DashboardSettingsTabs({
  dashboard,
  onClose,
}: {
  dashboard: DashboardSummary;
  onClose: () => void;
}) {
  return (
    <Tabs
      defaultActiveKey="meta"
      items={[
        {
          key: "meta",
          label: (
            <span>
              <EditOutlined /> Основное
            </span>
          ),
          children: <MetaTab dashboard={dashboard} onClose={onClose} />,
        },
        ...(dashboard.is_system
          ? []
          : [
              {
                key: "access",
                label: (
                  <span>
                    <UserAddOutlined /> Доступ
                  </span>
                ),
                children: <AccessTab dashboard={dashboard} />,
              },
            ]),
      ]}
    />
  );
}

function MetaTab({
  dashboard,
  onClose,
}: {
  dashboard: DashboardSummary;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form] = Form.useForm<{ name: string; description?: string; icon?: string }>();
  useEffect(() => {
    form.setFieldsValue({
      name: dashboard.name,
      description: dashboard.description ?? "",
      icon: dashboard.icon ?? "",
    });
  }, [dashboard, form]);

  const m = useMutation({
    mutationFn: (patch: { name?: string; description?: string; icon?: string }) =>
      updateDashboard(dashboard.id, patch),
    onSuccess: () => {
      notify.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      qc.invalidateQueries({ queryKey: ["dashboard", dashboard.id] });
      onClose();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const isSystem = dashboard.is_system;

  return (
    <>
      {isSystem && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Системный дашборд"
          description={
            <>
              Название повторяет имя пространства и меняется вместе с ним. Здесь
              можно поправить иконку и описание. Удалить системный дашборд нельзя.
            </>
          }
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={(v) =>
          m.mutate({
            // isSystem → не отсылаем name (сервер всё равно откажет),
            // экономим запрос.
            ...(isSystem ? {} : { name: v.name }),
            description: v.description || undefined,
            icon: v.icon || undefined,
          })
        }
      >
        <Form.Item
          name="name"
          label="Название"
          rules={isSystem ? [] : [{ required: true, min: 1, max: 200 }]}
        >
          <Input disabled={isSystem} />
        </Form.Item>
        <Form.Item name="icon" label="Иконка">
          <Input placeholder="📊" maxLength={4} />
        </Form.Item>
        <Form.Item name="description" label="Описание">
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 6 }}
            placeholder="Для чего этот дашборд и кого интересует"
          />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={m.isPending}>
            Сохранить
          </Button>
          <Button onClick={onClose}>Отмена</Button>
        </Space>
      </Form>
    </>
  );
}

function AccessTab({ dashboard }: { dashboard: DashboardSummary }) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const isOwner = dashboard.owner_user_id === me?.id;

  const membersQ = useQuery({
    queryKey: ["ws-members", dashboard.workspace_id],
    queryFn: () => listMembers(dashboard.workspace_id),
  });

  const permsQ = useQuery({
    queryKey: ["dashboard-perms", dashboard.id],
    queryFn: () => listDashboardPermissions(dashboard.id),
  });

  const grantM = useMutation({
    mutationFn: (args: { userId: string; level: "view" | "edit" }) =>
      grantDashboardPermission(dashboard.id, args.userId, args.level),
    onSuccess: () => {
      notify.success("Доступ выдан");
      qc.invalidateQueries({ queryKey: ["dashboard-perms", dashboard.id] });
      qc.invalidateQueries({ queryKey: ["dashboards"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });
  const revokeM = useMutation({
    mutationFn: (userId: string) => revokeDashboardPermission(dashboard.id, userId),
    onSuccess: () => {
      notify.success("Доступ отозван");
      qc.invalidateQueries({ queryKey: ["dashboard-perms", dashboard.id] });
      qc.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });

  const [form] = Form.useForm<{ userId: string; level: "view" | "edit" }>();

  if (!isOwner) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Нет прав"
        description="Управлять доступом к дашборду может только его автор."
      />
    );
  }

  const members = membersQ.data ?? [];
  const candidates = members.filter((mem) => mem.user_id !== dashboard.owner_user_id);

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Кому доступен этот дашборд"
        description={
          <>
            Автор дашборда видит и редактирует его всегда. Остальным выдавайте доступ
            явно. «Просмотр» — только читать, «Редактирование» — добавлять и менять
            виджеты. Права действуют только внутри этого пространства.
          </>
        }
      />

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Автор
      </Typography.Title>
      <List
        size="small"
        dataSource={
          members.filter((mem) => mem.user_id === dashboard.owner_user_id)
        }
        locale={{ emptyText: "—" }}
        renderItem={(mem) => (
          <List.Item>
            <List.Item.Meta
              title={mem.user_email}
              description={<Tag color="red">автор</Tag>}
            />
          </List.Item>
        )}
        style={{ marginBottom: 20 }}
      />

      <Typography.Title level={5}>Выдать доступ</Typography.Title>
      <Form
        form={form}
        layout="inline"
        initialValues={{ level: "view" }}
        onFinish={(v) => {
          grantM.mutate(v);
          form.resetFields(["userId"]);
        }}
        style={{ marginBottom: 20 }}
      >
        <Form.Item name="userId" rules={[{ required: true, message: "Выберите" }]}>
          <Select
            showSearch
            style={{ width: 240 }}
            placeholder="Кому"
            loading={membersQ.isLoading}
            options={candidates.map((mem) => ({
              value: mem.user_id,
              label: mem.user_email,
            }))}
            filterOption={(input, option) =>
              String(option?.label ?? "")
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item name="level">
          <Segmented
            options={[
              { value: "view", label: "Просмотр" },
              { value: "edit", label: "Редактирование" },
            ]}
          />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={grantM.isPending}
            icon={<UserAddOutlined />}
          >
            Выдать
          </Button>
        </Form.Item>
      </Form>

      <Typography.Title level={5}>Выданные права</Typography.Title>
      <List
        size="small"
        loading={permsQ.isLoading}
        dataSource={permsQ.data ?? []}
        locale={{ emptyText: "Никому пока не выдано" }}
        renderItem={(perm) => (
          <List.Item
            actions={[
              <Segmented
                key="level"
                value={perm.level}
                size="small"
                options={[
                  { value: "view", label: "Просмотр" },
                  { value: "edit", label: "Редактирование" },
                ]}
                onChange={(v) =>
                  grantM.mutate({
                    userId: perm.user_id,
                    level: v as "view" | "edit",
                  })
                }
              />,
              <Popconfirm
                key="revoke"
                title="Отозвать доступ?"
                onConfirm={() => revokeM.mutate(perm.user_id)}
                okText="Отозвать"
                cancelText="Отмена"
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={perm.user_email ?? perm.user_id}
              description={
                <Tag color={perm.level === "edit" ? "blue" : "default"}>
                  {perm.level === "edit" ? "Редактирование" : "Просмотр"}
                </Tag>
              }
            />
          </List.Item>
        )}
      />
    </>
  );
}
