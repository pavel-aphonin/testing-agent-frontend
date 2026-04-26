import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createWidgetPackage,
  deleteWidgetPackage,
  getWidgetPackageSource,
  listWidgetPackages,
  publishWidgetPackage,
  reorderWidgetPackages,
  updateWidgetPackage,
} from "@/api/dashboards";
import { useAuthStore } from "@/store/auth";
import { useWorkspaceStore } from "@/store/workspace";
import type { WidgetPackageRead } from "@/types";
import { notify } from "@/utils/notify";

/**
 * Workspace-level catalog of custom widget packages.
 *
 * A package is an HTML+JS blob (full document) that renders inside a
 * sandboxed iframe on the dashboard. It receives ``{widget, data}``
 * via ``postMessage`` on every data refresh.
 *
 * The page is intentionally sparse: upload (paste HTML + manifest JSON),
 * list, toggle on/off, edit, delete, clone. Publishing elsewhere (as
 * a "marketplace") is out of scope for Phase 3b.
 */
export function WidgetPackagesPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<WidgetPackageRead | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["widget-packages", ws?.id ?? "none"],
    queryFn: () => (ws ? listWidgetPackages(ws.id, false) : Promise.resolve([])),
    enabled: Boolean(ws),
  });

  const toggleM = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateWidgetPackage(id, { is_active: active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["widget-packages"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const delM = useMutation({
    mutationFn: (id: string) => deleteWidgetPackage(id),
    onSuccess: () => {
      notify.success("Пакет удалён");
      qc.invalidateQueries({ queryKey: ["widget-packages"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  // Reorder via ↑/↓ — see WidgetTemplatesPage for the same pattern.
  const reorderM = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      reorderWidgetPackages(ws!.id, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["widget-packages"] }),
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const movePackage = (idx: number, dir: -1 | 1) => {
    const list = q.data ?? [];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= list.length) return;
    const reordered = [...list];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    reorderM.mutate(
      reordered.map((p, i) => ({ id: p.id, sort_order: i * 10 })),
    );
  };

  if (!ws) return <Alert type="info" message="Выберите рабочее пространство" />;

  const rows = q.data ?? [];

  return (
    <>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Пакеты виджетов
        </Typography.Title>
        <Button type="primary" onClick={() => setCreating(true)}>
          Новый пакет
        </Button>
      </Space>
      <Typography.Paragraph type="secondary">
        Пользовательские виджеты, которые можно добавлять на любой дашборд.
        Пакет — это HTML с inline-скриптом; он загружается в sandbox-iframe
        и получает данные через <Typography.Text code>postMessage</Typography.Text>.
        Чтобы начать быстро, скопируйте <Typography.Text code>Пример пакета</Typography.Text>{" "}
        ниже, измените и сохраните как свой.
      </Typography.Paragraph>

      <Card>
        {rows.length === 0 ? (
          <Empty description="Ещё нет пакетов — нажмите «Новый пакет» или «Использовать пример»" />
        ) : (
          <Table
            size="small"
            rowKey="id"
            dataSource={rows}
            pagination={false}
            columns={[
              {
                title: "Название",
                dataIndex: "name",
                render: (v, r: WidgetPackageRead) => (
                  <Space>
                    <span>{r.icon ?? "🧩"}</span>
                    <span>{v}</span>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      v{r.version}
                    </Typography.Text>
                  </Space>
                ),
              },
              {
                title: "Код",
                dataIndex: "code",
                width: 220,
                render: (v) => <Typography.Text code>{v}</Typography.Text>,
              },
              {
                title: "ID (для chart_options.package_id)",
                dataIndex: "id",
                width: 360,
                render: (v: string) => (
                  <Space>
                    <Typography.Text code copyable style={{ fontSize: 11 }}>
                      {v}
                    </Typography.Text>
                  </Space>
                ),
              },
              {
                title: "Активен",
                dataIndex: "is_active",
                width: 100,
                render: (v: boolean, r: WidgetPackageRead) => (
                  <Switch
                    size="small"
                    checked={v}
                    onChange={(checked) => toggleM.mutate({ id: r.id, active: checked })}
                  />
                ),
              },
              {
                title: "Статус",
                dataIndex: "is_active",
                width: 90,
                render: (v) => (v ? <Tag color="green">ON</Tag> : <Tag>OFF</Tag>),
              },
              {
                title: "",
                width: 170,
                render: (_, r: WidgetPackageRead, idx) => (
                  <Space size={0}>
                    <Button
                      size="small"
                      type="text"
                      icon={<ArrowUpOutlined />}
                      disabled={idx === 0 || reorderM.isPending}
                      onClick={() => movePackage(idx, -1)}
                      title="Поднять выше"
                    />
                    <Button
                      size="small"
                      type="text"
                      icon={<ArrowDownOutlined />}
                      disabled={idx === rows.length - 1 || reorderM.isPending}
                      onClick={() => movePackage(idx, 1)}
                      title="Опустить ниже"
                    />
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => setEditing(r)}
                    />
                    {(r.author_user_id === me?.id ||
                      (me?.permissions ?? []).includes("users.view")) && (
                      <Popconfirm
                        title="Удалить пакет?"
                        description="Виджеты, ссылающиеся на этот пакет, перестанут работать."
                        onConfirm={() => delM.mutate(r.id)}
                        okText="Удалить"
                        cancelText="Отмена"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                        />
                      </Popconfirm>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Card>

      <EditPackageDrawer
        workspaceId={ws.id}
        pkg={editing}
        onClose={() => setEditing(null)}
      />
      <EditPackageDrawer
        workspaceId={ws.id}
        pkg={null}
        forceOpen={creating}
        onClose={() => setCreating(false)}
      />
    </>
  );
}

/**
 * Single editor used for both "new" (pkg=null, forceOpen=true) and
 * "edit existing" (pkg=..., forceOpen undefined). We deliberately
 * don't split it — the form layout is identical and having one code
 * path means bug fixes apply to both flows.
 */
function EditPackageDrawer({
  workspaceId,
  pkg,
  onClose,
  forceOpen,
}: {
  workspaceId: string;
  pkg: WidgetPackageRead | null;
  onClose: () => void;
  forceOpen?: boolean;
}) {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const isEdit = Boolean(pkg);
  const open = forceOpen ?? Boolean(pkg);

  // When editing, load the full source (list API strips it to keep
  // the page fast). For "new", fall back to a template so the user has
  // something to copy-paste-modify.
  const sourceQ = useQuery({
    queryKey: ["widget-package-source", pkg?.id],
    queryFn: () => getWidgetPackageSource(pkg!.id),
    enabled: Boolean(pkg?.id),
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && pkg) {
      // Prefer the draft when present — that's what the author was
      // editing last. Fall back to published HTML for fresh edits or
      // packages without a draft buffer (PER-14).
      const html = sourceQ.data?.draft_html_source
        ?? sourceQ.data?.html_source
        ?? "";
      form.setFieldsValue({
        code: pkg.code,
        name: pkg.name,
        description: pkg.description ?? "",
        icon: pkg.icon ?? "",
        version: pkg.version,
        manifest: JSON.stringify(pkg.manifest ?? {}, null, 2),
        html_source: html,
        is_active: pkg.is_active,
      });
    } else {
      form.setFieldsValue({
        code: "",
        name: "",
        description: "",
        icon: "🧩",
        version: "0.1.0",
        manifest: JSON.stringify(
          {
            allowed_sources: ["*"],
            config_fields: [],
          },
          null,
          2,
        ),
        html_source: EXAMPLE_PACKAGE_HTML,
        is_active: true,
      });
    }
  }, [open, pkg, sourceQ.data, form, isEdit]);

  const createM = useMutation({
    mutationFn: (v: any) =>
      createWidgetPackage(workspaceId, {
        code: v.code,
        name: v.name,
        description: v.description,
        icon: v.icon,
        version: v.version,
        manifest: JSON.parse(v.manifest || "{}"),
        html_source: v.html_source,
        is_active: v.is_active,
      }),
    onSuccess: () => {
      notify.success("Пакет создан");
      qc.invalidateQueries({ queryKey: ["widget-packages"] });
      onClose();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const updateM = useMutation({
    mutationFn: (v: any) =>
      updateWidgetPackage(pkg!.id, {
        name: v.name,
        description: v.description,
        icon: v.icon,
        version: v.version,
        manifest: JSON.parse(v.manifest || "{}"),
        html_source: v.html_source,
        is_active: v.is_active,
      }),
    onSuccess: () => {
      notify.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["widget-packages"] });
      qc.invalidateQueries({ queryKey: ["widget-package-source"] });
      onClose();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const m = isEdit ? updateM : createM;

  const publishM = useMutation({
    mutationFn: () => publishWidgetPackage(pkg!.id),
    onSuccess: () => {
      notify.success("Пакет опубликован — версия увеличена");
      qc.invalidateQueries({ queryKey: ["widget-packages"] });
      qc.invalidateQueries({ queryKey: ["widget-package-source"] });
      onClose();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const copyExample = () => {
    form.setFieldsValue({ html_source: EXAMPLE_PACKAGE_HTML });
    notify.success("Пример вставлен — редактируйте");
  };

  // True when there's a saved draft different from the published copy.
  // Drives the "Готов к публикации" badge and enables the Publish
  // button. Computed from the source query, not the local form state —
  // the form state can be ahead of saved data.
  const hasDraft = Boolean(isEdit && sourceQ.data?.has_draft);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? `Пакет: ${pkg?.name}` : "Новый пакет"}
      width={720}
      destroyOnHidden
      extra={
        <Space>
          {isEdit && hasDraft && (
            <Tag color="orange" style={{ margin: 0 }}>
              есть черновик
            </Tag>
          )}
          {isEdit && (
            <Popconfirm
              title="Опубликовать черновик?"
              description={
                <span>
                  Виджеты, использующие этот пакет, начнут рендерить новую версию
                  при следующем обновлении данных. Версия увеличится на patch.
                </span>
              }
              okText="Опубликовать"
              cancelText="Отмена"
              disabled={!hasDraft || publishM.isPending}
              onConfirm={() => publishM.mutate()}
            >
              <Button
                type="default"
                disabled={!hasDraft}
                loading={publishM.isPending}
              >
                Опубликовать
              </Button>
            </Popconfirm>
          )}
          <Button onClick={onClose}>Отмена</Button>
          <Button
            type="primary"
            loading={m.isPending}
            onClick={() => form.validateFields().then((v) => m.mutate(v))}
          >
            Сохранить
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Space style={{ width: "100%" }} size={8}>
          <Form.Item name="code" label="Код (slug)" rules={[{ required: true }]} style={{ width: 220 }}>
            <Input disabled={isEdit} placeholder="my-widget-v1" />
          </Form.Item>
          <Form.Item name="version" label="Версия" style={{ width: 120 }}>
            <Input placeholder="0.1.0" />
          </Form.Item>
          <Form.Item name="icon" label="Иконка" style={{ width: 80 }}>
            <Input maxLength={4} />
          </Form.Item>
        </Space>
        <Form.Item name="name" label="Название" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="Описание">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>
        <Form.Item name="is_active" label="Активен" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item
          name="manifest"
          label="Манифест (JSON)"
          extra={
            <span>
              <strong>allowed_sources</strong> — массив кодов источников, которые
              пакет умеет рендерить. Пусто или <Typography.Text code>["*"]</Typography.Text> = любой источник.
              Например: <Typography.Text code>{`["runs.by_day", "defects.by_day"]`}</Typography.Text>.
              Виджет с другим источником покажет предупреждение и не получит данные.
              <br />
              <strong>config_fields</strong> — пока декоративно (UI-форма для опций пакета — в планах).
            </span>
          }
        >
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
        </Form.Item>
        <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}>
          <Typography.Text>HTML-источник</Typography.Text>
          <Button size="small" icon={<CopyOutlined />} onClick={copyExample}>
            Вставить пример
          </Button>
        </Space>
        <Form.Item
          name="html_source"
          rules={[{ required: true, min: 10, max: 256 * 1024 }]}
          extra="Iframe получает window.__widget = {widget, data}. Определите window.render(payload) — вызовется при каждом обновлении данных."
        >
          <Input.TextArea
            autoSize={{ minRows: 10, maxRows: 24 }}
            style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 12 }}
          />
        </Form.Item>
        <Form.Item name="_unused" label="&nbsp;" style={{ display: "none" }}>
          <InputNumber />
        </Form.Item>

        {/* Live preview (PER-12). Reads the html_source field via
            Form.useWatch + 500ms debounce so each keystroke doesn't
            remount the iframe. The bootstrap injection mirrors what
            CustomWidget does at runtime, so authors see exactly the
            wrapper their package will run inside. */}
        <PackagePreview form={form} />
      </Form>
      <Alert
        type="info"
        showIcon={false}
        style={{ fontSize: 12 }}
        message={
          <div>
            Как связать пакет с виджетом: на дашборде добавьте виджет типа{" "}
            <Typography.Text code>custom</Typography.Text>, откройте его
            настройки и пропишите в <Typography.Text code>chart_options</Typography.Text>{" "}
            поле <Typography.Text code>{`{"package_id": "ID_пакета"}`}</Typography.Text>.
            ID можно скопировать из таблицы пакетов.
          </div>
        }
      />
    </Drawer>
  );
}

/**
 * A minimal "hello, widget" that renders the first KPI value big and
 * centered + the widget title. Meant to be the starting point new users
 * copy-and-paste. Keeps everything inline — no external dependencies.
 */
const EXAMPLE_PACKAGE_HTML = `<!doctype html>
<html>
<head>
<style>
  html, body { margin: 0; padding: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
  body { display: flex; flex-direction: column; align-items: center;
         justify-content: center; height: 100vh; color: #222; }
  .value { font-size: 48px; font-weight: 700; letter-spacing: -1px; }
  .label { opacity: 0.7; font-size: 13px; margin-top: 4px; }
  @media (prefers-color-scheme: dark) {
    body { color: #eaeaea; background: transparent; }
  }
</style>
</head>
<body>
  <div class="value" id="v">—</div>
  <div class="label" id="l">загрузка…</div>
<script>
  window.render = function (payload) {
    var widget = payload.widget;
    var data = payload.data;
    var vals = (data.series && data.series[0] && data.series[0].data) || [];
    var last = vals.length ? vals[vals.length - 1] : null;
    document.getElementById("v").textContent = last == null ? "—" : last.toLocaleString("ru-RU");
    document.getElementById("l").textContent = widget.title;
  };
</script>
</body>
</html>`;


/* ── Preview component (PER-12) ────────────────────────────────────
 * Live preview of the package HTML in a sandboxed iframe with the
 * same bootstrap that CustomWidget uses at runtime. Authors edit the
 * HTML and see the result inside the drawer instead of bouncing to
 * a dashboard, adding a custom widget, picking the package, and
 * waiting for the data fetch.
 *
 * Updates are debounced (500 ms) so heavy keystroking doesn't trash
 * the iframe instance every frame. The "Снова отправить данные"
 * button re-posts the current test payload — useful when the package
 * is rebuilding state and the author wants to manually re-trigger
 * a render call.
 * ────────────────────────────────────────────────────────────────── */

const TEST_PAYLOAD = {
  widget: {
    id: "preview-widget",
    title: "Тестовый виджет",
    widget_type: "custom" as const,
  },
  data: {
    categories: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"],
    series: [{ name: "Тестовая серия", data: [3, 7, 5, 9, 4] }],
  },
};

function PackagePreview({ form }: { form: any }) {
  const html: string = Form.useWatch("html_source", form) ?? "";
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Debounce text edits so we don't tear down the iframe on every key.
  // 500 ms feels right — short enough to look "live", long enough that
  // even a fast typist gets at most a couple of remounts per word.
  const [debouncedHtml, setDebouncedHtml] = useState(html);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedHtml(html), 500);
    return () => clearTimeout(t);
  }, [html]);

  // Same bootstrap CustomWidget injects at runtime — keeps the preview
  // honest about the actual contract (window.render, postMessage,
  // widget-ready ack).
  const srcDoc = useMemo(() => {
    if (!debouncedHtml) return undefined;
    const bootstrap = `
<script>
  window.__widget = null;
  window.addEventListener("message", (ev) => {
    if (ev.data && ev.data.type === "widget-data") {
      window.__widget = ev.data.payload;
      if (typeof window.render === "function") {
        try { window.render(ev.data.payload); } catch (e) { console.error(e); }
      }
    }
  });
  window.addEventListener("load", () => {
    window.parent.postMessage({ type: "widget-ready" }, "*");
  });
</script>`;
    if (/<\/body>/i.test(debouncedHtml)) {
      return debouncedHtml.replace(/<\/body>/i, `${bootstrap}</body>`);
    }
    return bootstrap + debouncedHtml;
  }, [debouncedHtml]);

  const post = () => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "widget-data", payload: TEST_PAYLOAD },
      "*",
    );
  };

  // Auto-post on widget-ready and after every srcDoc rebuild. The ready
  // listener handles the iframe's own load timing; the direct post is
  // a best-effort for cases where load already fired before the
  // listener attached.
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.data && ev.data.type === "widget-ready") post();
    };
    window.addEventListener("message", onMessage);
    post();
    return () => window.removeEventListener("message", onMessage);
  }, [srcDoc]);

  return (
    <div style={{ marginTop: 12 }}>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}>
        <Typography.Text strong>Предпросмотр</Typography.Text>
        <Button size="small" onClick={post}>
          Снова отправить данные
        </Button>
      </Space>
      {srcDoc ? (
        <iframe
          ref={iframeRef}
          title="Preview"
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          style={{
            width: "100%",
            height: 320,
            border: "1px solid #d9d9d9",
            borderRadius: 6,
            background: "transparent",
          }}
        />
      ) : (
        <div
          style={{
            height: 320,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px dashed #d9d9d9",
            borderRadius: 6,
            color: "#8c8c8c",
            fontSize: 13,
          }}
        >
          Заполните HTML-источник, чтобы увидеть превью
        </div>
      )}
      <Typography.Paragraph type="secondary" style={{ fontSize: 11, marginTop: 6, marginBottom: 0 }}>
        Тестовая нагрузка: 5 категорий, 1 серия из 5 чисел. Обновляется через
        полсекунды после правки HTML.
      </Typography.Paragraph>
    </div>
  );
}
