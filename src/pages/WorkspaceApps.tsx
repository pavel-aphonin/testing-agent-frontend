import {
  AppstoreOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  EyeInvisibleOutlined,
  LinkOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Divider,
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
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  listAppsHistory,
  listInstallations,
  listVersions,
  uninstallApp,
  updateInstallation,
  updateMyInstallationPrefs,
} from "@/api/apps";
import { useWorkspaceStore } from "@/store/workspace";
import type {
  AppAuditAction,
  AppInstallationAuditRead,
  AppInstallationRead,
  AppManifestSetting,
} from "@/types";
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

  // Audit log powering the "История" tab. Cheap to always fetch — the
  // list is already capped server-side to 200 rows.
  const historyQ = useQuery({
    queryKey: ["ws-apps-history", ws?.id ?? "none"],
    queryFn: () => (ws ? listAppsHistory(ws.id) : Promise.resolve([])),
    enabled: Boolean(ws),
  });

  const uninstallM = useMutation({
    mutationFn: (instId: string) => (ws ? uninstallApp(ws.id, instId) : Promise.reject()),
    onSuccess: () => {
      notify.success("Приложение удалено");
      qc.invalidateQueries({ queryKey: ["ws-apps"] });
      qc.invalidateQueries({ queryKey: ["ws-apps-history"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const updateM = useMutation({
    mutationFn: ({ instId, payload }: { instId: string; payload: any }) =>
      ws ? updateInstallation(ws.id, instId, payload) : Promise.reject(),
    onSuccess: () => {
      notify.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["ws-apps"] });
      qc.invalidateQueries({ queryKey: ["ws-apps-history"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  // Per-user display prefs (hide from sidebar / top bar). Kept separate
  // from the manifest-driven settings so toggling visibility doesn't
  // wipe unsaved settings edits.
  const prefsM = useMutation({
    mutationFn: ({ instId, prefs }: { instId: string; prefs: Record<string, unknown> }) =>
      ws ? updateMyInstallationPrefs(ws.id, instId, prefs) : Promise.reject(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ws-apps"] });
      qc.invalidateQueries({ queryKey: ["ws-apps-history"] });
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

  // Fetch the full version list for each installed app so we can
  // compute "update available" (latest non-deprecated vs current).
  const versionQueries = useQueries({
    queries: (installedQ.data ?? []).map((inst) => ({
      queryKey: ["app-versions", inst.app_package_id],
      queryFn: () => listVersions(inst.app_package_id),
    })),
  });
  const updatesAvailable = useMemo(() => {
    const out: { inst: AppInstallationRead; latestId: string; latestVersion: string }[] = [];
    (installedQ.data ?? []).forEach((inst, idx) => {
      const versions = versionQueries[idx]?.data ?? [];
      const latest = versions
        .filter((v) => !v.is_deprecated)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      if (latest && latest.id !== inst.version_id) {
        out.push({ inst, latestId: latest.id, latestVersion: latest.version });
      }
    });
    return out;
  }, [installedQ.data, versionQueries]);

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

      <Tabs
        items={[
          {
            key: "installed",
            label: `Установленные (${installedQ.data?.length ?? 0})`,
            children: (installedQ.data?.length ?? 0) === 0 ? (
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
                  {new Date(inst.installed_at).toLocaleDateString("ru-RU")}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      ),
          },
          {
            key: "updates",
            label: (
              <Badge count={updatesAvailable.length} offset={[8, -4]}>
                <span>Обновления</span>
              </Badge>
            ),
            children: updatesAvailable.length === 0 ? (
              <Empty description="Все приложения последней версии" />
            ) : (
              <>
                {updatesAvailable.map(({ inst, latestId, latestVersion }) => (
                  <Card key={inst.id} size="small" style={{ marginBottom: 8 }}>
                    <Space style={{ width: "100%", justifyContent: "space-between" }}>
                      <Space>
                        <Avatar
                          shape="square"
                          size={32}
                          src={
                            inst.package?.logo_path
                              ? `${import.meta.env.VITE_API_BASE_URL ?? ""}/${inst.package.logo_path.startsWith("/") ? inst.package.logo_path.slice(1) : inst.package.logo_path}`
                              : undefined
                          }
                          icon={<AppstoreOutlined />}
                          style={{ background: "#fafafa" }}
                        />
                        <div>
                          <Typography.Text strong>{inst.package?.name}</Typography.Text>
                          <div style={{ fontSize: 12, color: "#999" }}>
                            v{inst.version?.version} →{" "}
                            <Tag color="green">v{latestVersion}</Tag>
                          </div>
                        </div>
                      </Space>
                      <Button
                        type="primary"
                        icon={<CloudDownloadOutlined />}
                        loading={updateM.isPending && updateM.variables?.instId === inst.id}
                        onClick={() =>
                          updateM.mutate({
                            instId: inst.id,
                            payload: { version_id: latestId },
                          })
                        }
                      >
                        Обновить
                      </Button>
                    </Space>
                  </Card>
                ))}
              </>
            ),
          },
          {
            key: "history",
            label: <span>История</span>,
            children: <HistoryTab rows={historyQ.data ?? []} loading={historyQ.isLoading} />,
          },
        ]}
      />

      <Drawer
        title={settingsFor ? `Настройки: ${settingsFor.package?.name}` : ""}
        open={Boolean(settingsFor)}
        onClose={() => setSettingsFor(null)}
        width={480}
        extra={
          <Button
            type="primary"
            onClick={() => {
              if (!settingsFor) return;
              // Save whatever the user has entered — we don't block on
              // required fields here because "required" is a hint from
              // the manifest author ("without this the app won't work"),
              // not a hard wall. Users often need to save partial
              // config (e.g. api_url, system_id) before the access
              // token arrives by email. The app itself will refuse to
              // make real calls without the missing fields.
              const values = form.getFieldsValue();
              updateM.mutate({
                instId: settingsFor.id,
                payload: { settings: values },
              });
              setSettingsFor(null);
            }}
          >
            Сохранить
          </Button>
        }
      >
        {settingsFor && (
          <>
            {/* Personal display prefs — stored per (user, installation).
                Only rendered for slot types the app actually uses, so
                you don't see a "hide from top bar" toggle on an app
                that never puts anything there.

                ``currentPrefs`` is read live from the installations
                query (not from the drawer's snapshot) so the checkbox
                reflects the DB after a save, not the state at the
                moment the drawer opened. */}
            <PersonalPrefsSection
              inst={settingsFor}
              currentPrefs={
                installedQ.data?.find((i) => i.id === settingsFor.id)?.user_prefs ?? {}
              }
              onToggle={(prefs) =>
                prefsM.mutate({ instId: settingsFor.id, prefs })
              }
            />
            <Divider>Настройки приложения</Divider>
            <Form form={form} layout="vertical">
              <GroupedSettings
                fields={settingsFor.version?.manifest?.settings_schema ?? []}
              />
            </Form>
          </>
        )}
      </Drawer>
    </>
  );
}

/**
 * Render manifest fields grouped by ``field.group``. Ungrouped fields
 * render at the top (always visible). Grouped fields render as a
 * uniform ``<Collapse>`` — first group expanded by default, the rest
 * collapsed. This is deliberately baked into the host so every
 * bundle behaves the same way and the user's UX muscle memory carries
 * across apps.
 */
function GroupedSettings({ fields }: { fields: AppManifestSetting[] }) {
  if (fields.length === 0) {
    return <Empty description="У приложения нет настроек" />;
  }

  // Ordered bucket map — preserves manifest ordering as the app
  // author laid it out.
  const buckets = new Map<string, AppManifestSetting[]>();
  const NO_GROUP = "__no_group__";
  for (const f of fields) {
    const key = f.group ?? NO_GROUP;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(f);
  }

  const ungrouped = buckets.get(NO_GROUP) ?? [];
  const groupEntries: [string, AppManifestSetting[]][] = [];
  for (const [k, v] of buckets) {
    if (k !== NO_GROUP) groupEntries.push([k, v]);
  }

  // Open the first named group by default — common case is "Connection"
  // or similar, which the user usually wants to see first. Other groups
  // stay collapsed so long settings lists stay scannable.
  const defaultActive = groupEntries.length ? [groupEntries[0]![0]] : [];

  return (
    <>
      {ungrouped.map((f) => <SettingField key={f.code} field={f} />)}
      {groupEntries.length > 0 && (
        <Collapse
          size="small"
          bordered={false}
          defaultActiveKey={defaultActive}
          style={{ background: "transparent", marginTop: ungrouped.length ? 4 : 0 }}
          items={groupEntries.map(([title, items]) => ({
            key: title,
            label: (
              <Typography.Text
                strong
                style={{ fontSize: 12, letterSpacing: 0.3, textTransform: "uppercase", color: "#555" }}
              >
                {title}
              </Typography.Text>
            ),
            children: (
              <div>
                {items.map((f) => <SettingField key={f.code} field={f} />)}
              </div>
            ),
          }))}
        />
      )}
    </>
  );
}

function SettingField({ field }: { field: AppManifestSetting }) {
  // We don't enforce required-at-save-time. See the drawer save
  // handler for the rationale. The red asterisk in ``label`` still
  // tells the user "you need this for the app to actually work".
  const rules: never[] = [];
  // Label with a "?" tooltip — matches the pattern used elsewhere in
  // the app (test data, scenarios, dictionaries). Beginner-friendly:
  // hover to get a plain-language hint.
  const label = (
    <Space size={4}>
      <span>{field.name}</span>
      {field.required && <span style={{ color: "#cf1322" }}>*</span>}
      {field.description && (
        <Tooltip title={field.description}>
          <QuestionCircleOutlined style={{ color: "#bfbfbf", cursor: "help" }} />
        </Tooltip>
      )}
    </Space>
  );

  if (field.type === "boolean") {
    return (
      <Form.Item
        name={field.code}
        label={label}
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
      <Form.Item name={field.code} label={label} rules={rules}>
        <Input.Password autoComplete="off" />
      </Form.Item>
    );
  }
  if (field.type === "text") {
    return (
      <Form.Item
        name={field.code}
        label={label}
        rules={rules}
        initialValue={field.default}
      >
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 10 }} />
      </Form.Item>
    );
  }
  return (
    <Form.Item
      name={field.code}
      label={label}
      rules={rules}
      initialValue={field.default}
    >
      <Input />
    </Form.Item>
  );
}

/**
 * "Мои настройки отображения" — lets this user decide which of the app's
 * UI slots show up in their chrome. Saved per-user and per-installation,
 * so the same app can be visible for me and hidden for a colleague in
 * the same workspace.
 *
 * We only render a toggle for slot types the app actually declares in
 * its manifest. If the app has no sidebar slot, there's no point
 * showing "hide from sidebar".
 */
function PersonalPrefsSection({
  inst,
  currentPrefs,
  onToggle,
}: {
  inst: AppInstallationRead;
  /** Live prefs from the query cache; updates after every PUT. */
  currentPrefs: Record<string, unknown>;
  onToggle: (prefs: Record<string, unknown>) => void;
}) {
  const slots = inst.version?.manifest?.ui_slots ?? [];
  const usedSlotTypes = new Set(slots.map((s) => s.slot));
  const prefs = currentPrefs ?? {};

  // Nothing to offer if the app has no chrome slots at all.
  const togglable: { key: string; slot: string; label: string }[] = [];
  if (usedSlotTypes.has("sidebar")) {
    togglable.push({
      key: "hidden_from_sidebar",
      slot: "sidebar",
      label: "Скрыть из бокового меню",
    });
  }
  if (usedSlotTypes.has("top_bar")) {
    togglable.push({
      key: "hidden_from_top_bar",
      slot: "top_bar",
      label: "Скрыть из верхней панели",
    });
  }
  if (usedSlotTypes.has("corner")) {
    togglable.push({
      key: "hidden_from_corner",
      slot: "corner",
      label: "Скрыть плавающую кнопку",
    });
  }
  if (togglable.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
        <EyeInvisibleOutlined /> Мои настройки отображения
      </Typography.Text>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        Изменения видны только вам. Коллеги в пространстве продолжат видеть приложение.
      </Typography.Paragraph>
      <Space direction="vertical">
        {togglable.map((t) => (
          <Checkbox
            key={t.key}
            checked={Boolean(prefs[t.key])}
            onChange={(e) => {
              const next = { ...prefs, [t.key]: e.target.checked };
              // Drop falsy keys so the pref blob stays compact over time.
              if (!e.target.checked) delete next[t.key];
              onToggle(next);
            }}
          >
            {t.label}
          </Checkbox>
        ))}
      </Space>
    </div>
  );
}

const AUDIT_ACTION_META: Record<AppAuditAction, { label: string; color: string }> = {
  installed:         { label: "Установлено",     color: "green" },
  version_changed:   { label: "Смена версии",    color: "blue" },
  settings_changed:  { label: "Настройки",       color: "purple" },
  enabled:           { label: "Включено",        color: "green" },
  disabled:          { label: "Выключено",       color: "default" },
  uninstalled:       { label: "Удалено",         color: "red" },
};

/**
 * "История" tab — audit log of install / version / enable / uninstall
 * events for this workspace. Shows who did what and when. Shows a
 * concise one-liner summary per row plus a small "подробнее" expander
 * for rows that carry details (e.g. which settings keys changed).
 */
function HistoryTab({
  rows,
  loading,
}: {
  rows: AppInstallationAuditRead[];
  loading: boolean;
}) {
  if (loading) return null;
  if (rows.length === 0) {
    return (
      <Empty
        description="Пока никаких событий — установите первое приложение"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }
  return (
    <div>
      {rows.map((row) => {
        const meta = AUDIT_ACTION_META[row.action] ?? {
          label: row.action,
          color: "default",
        };
        let summary: string;
        switch (row.action) {
          case "installed":
            summary = `Установлено «${row.package_name ?? "?"}» версии v${row.to_version ?? "?"}`;
            break;
          case "version_changed":
            summary = `«${row.package_name ?? "?"}»: v${row.from_version ?? "?"} → v${row.to_version ?? "?"}`;
            break;
          case "settings_changed": {
            const keys = (row.details?.changed_keys as string[] | undefined) ?? [];
            summary = keys.length
              ? `Изменены настройки «${row.package_name ?? "?"}»: ${keys.slice(0, 4).join(", ")}${keys.length > 4 ? "…" : ""}`
              : `Изменены настройки «${row.package_name ?? "?"}»`;
            break;
          }
          case "enabled":
            summary = `Включено «${row.package_name ?? "?"}»`;
            break;
          case "disabled":
            summary = `Выключено «${row.package_name ?? "?"}»`;
            break;
          case "uninstalled":
            summary = `Удалено «${row.package_name ?? "?"}»${row.from_version ? ` (v${row.from_version})` : ""}`;
            break;
          default:
            summary = row.action;
        }
        const date = new Date(row.created_at);
        return (
          <div
            key={row.id}
            style={{
              display: "grid",
              gridTemplateColumns: "130px 1fr auto",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <Tag color={meta.color} style={{ margin: 0 }}>
              {meta.label}
            </Tag>
            <div>
              <div style={{ fontSize: 13 }}>{summary}</div>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {row.user_email ?? "—"}
              </Typography.Text>
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
              {date.toLocaleDateString("ru-RU")} {date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
            </Typography.Text>
          </div>
        );
      })}
    </div>
  );
}
