import {
  AppstoreOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  LinkOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  listInstallations,
  uninstallApp,
  updateInstallation,
} from "@/api/apps";
import { useWorkspaceStore } from "@/store/workspace";
import type { AppInstallationRead, AppManifestSetting } from "@/types";
import { notify } from "@/utils/notify";

export function WorkspaceApps() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  const [settingsFor, setSettingsFor] = useState<AppInstallationRead | null>(null);
  const [form] = Form.useForm();

  const installedQ = useQuery({
    queryKey: ["ws-apps", ws?.id ?? "none"],
    queryFn: () => (ws ? listInstallations(ws.id) : Promise.resolve([])),
    enabled: Boolean(ws),
  });

  const uninstallM = useMutation({
    mutationFn: (instId: string) => (ws ? uninstallApp(ws.id, instId) : Promise.reject()),
    onSuccess: () => {
      notify.success("Приложение удалено");
      qc.invalidateQueries({ queryKey: ["ws-apps"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const updateM = useMutation({
    mutationFn: ({ instId, payload }: { instId: string; payload: any }) =>
      ws ? updateInstallation(ws.id, instId, payload) : Promise.reject(),
    onSuccess: () => {
      notify.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["ws-apps"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  useEffect(() => {
    if (settingsFor) {
      form.setFieldsValue(settingsFor.settings ?? {});
    }
  }, [settingsFor, form]);

  if (!ws) {
    return (
      <Alert
        type="info"
        message="Выберите рабочее пространство"
        description="Приложения устанавливаются отдельно в каждое пространство."
        showIcon
      />
    );
  }

  return (
    <>
      <Space
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          <AppstoreOutlined /> Приложения в «{ws.name}»
        </Typography.Title>
        <Link to="/apps/store">
          <Button type="primary" icon={<AppstoreOutlined />}>
            Открыть магазин
          </Button>
        </Link>
      </Space>

      {(installedQ.data?.length ?? 0) === 0 ? (
        <Empty
          description={
            <>
              В этом пространстве нет установленных приложений.{" "}
              <Link to="/apps/store">Открыть магазин</Link>
            </>
          }
        />
      ) : (
        <Row gutter={[16, 16]}>
          {installedQ.data!.map((inst) => (
            <Col key={inst.id} xs={24} md={12} lg={8}>
              <Card
                size="small"
                title={
                  <Space>
                    <Avatar
                      shape="square"
                      size={28}
                      src={
                        inst.package?.logo_path
                          ? `${import.meta.env.VITE_API_BASE_URL ?? ""}/${inst.package.logo_path.startsWith("/") ? inst.package.logo_path.slice(1) : inst.package.logo_path}`
                          : undefined
                      }
                      icon={<AppstoreOutlined />}
                      style={{ background: "#fafafa" }}
                    />
                    <span>{inst.package?.name ?? "?"}</span>
                    {!inst.is_enabled && <Tag color="default">Выключено</Tag>}
                  </Space>
                }
                extra={
                  <Space size={4}>
                    <Tooltip title="Настройки">
                      <Button
                        size="small"
                        type="text"
                        icon={<SettingOutlined />}
                        onClick={() => setSettingsFor(inst)}
                      />
                    </Tooltip>
                    <Tooltip title="Детали в магазине">
                      <Link to={`/apps/${inst.app_package_id}`}>
                        <Button size="small" type="text" icon={<LinkOutlined />} />
                      </Link>
                    </Tooltip>
                    <Tooltip title={inst.is_enabled ? "Выключить" : "Включить"}>
                      <Button
                        size="small"
                        type="text"
                        icon={<DisconnectOutlined />}
                        onClick={() =>
                          updateM.mutate({
                            instId: inst.id,
                            payload: { is_enabled: !inst.is_enabled },
                          })
                        }
                      />
                    </Tooltip>
                    <Popconfirm
                      title="Удалить приложение?"
                      onConfirm={() => uninstallM.mutate(inst.id)}
                      okText="Удалить"
                      cancelText="Отмена"
                      okButtonProps={{ danger: true }}
                    >
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                }
              >
                <Typography.Paragraph
                  style={{ fontSize: 12, color: "#666", marginBottom: 4 }}
                  ellipsis={{ rows: 2 }}
                >
                  {inst.package?.description || "Описание отсутствует"}
                </Typography.Paragraph>
                <div style={{ fontSize: 11, color: "#999" }}>
                  v{inst.version?.version ?? "?"} · установлено{" "}
                  {new Date(inst.installed_at).toLocaleDateString()}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Drawer
        title={settingsFor ? `Настройки: ${settingsFor.package?.name}` : ""}
        open={Boolean(settingsFor)}
        onClose={() => setSettingsFor(null)}
        width={480}
        extra={
          <Button
            type="primary"
            onClick={() =>
              form.validateFields().then((values) => {
                if (settingsFor) {
                  updateM.mutate({
                    instId: settingsFor.id,
                    payload: { settings: values },
                  });
                  setSettingsFor(null);
                }
              })
            }
          >
            Сохранить
          </Button>
        }
      >
        {settingsFor && (
          <Form form={form} layout="vertical">
            {(settingsFor.version?.manifest?.settings_schema ?? []).map((f) => (
              <SettingField key={f.code} field={f} />
            ))}
            {(settingsFor.version?.manifest?.settings_schema ?? []).length === 0 && (
              <Empty description="У приложения нет настроек" />
            )}
          </Form>
        )}
      </Drawer>
    </>
  );
}

function SettingField({ field }: { field: AppManifestSetting }) {
  const rules = field.required ? [{ required: true, message: "Обязательно" }] : [];
  const label = (
    <span>
      {field.name}
      {field.required && <span style={{ color: "#cf1322" }}> *</span>}
    </span>
  );
  const extra = field.description;

  if (field.type === "boolean") {
    return (
      <Form.Item
        name={field.code}
        label={label}
        extra={extra}
        valuePropName="checked"
        initialValue={field.default ?? false}
      >
        <Switch />
      </Form.Item>
    );
  }
  if (field.type === "number") {
    return (
      <Form.Item
        name={field.code}
        label={label}
        extra={extra}
        rules={rules}
        initialValue={field.default}
      >
        <InputNumber style={{ width: "100%" }} />
      </Form.Item>
    );
  }
  if (field.type === "enum") {
    return (
      <Form.Item
        name={field.code}
        label={label}
        extra={extra}
        rules={rules}
        initialValue={field.default}
      >
        <Select
          options={(field.enum_values ?? []).map((v) => ({ value: v, label: v }))}
        />
      </Form.Item>
    );
  }
  if (field.type === "secret") {
    return (
      <Form.Item
        name={field.code}
        label={label}
        extra={extra}
        rules={rules}
      >
        <Input.Password autoComplete="off" />
      </Form.Item>
    );
  }
  return (
    <Form.Item
      name={field.code}
      label={label}
      extra={extra}
      rules={rules}
      initialValue={field.default}
    >
      <Input />
    </Form.Item>
  );
}
