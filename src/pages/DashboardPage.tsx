import {
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  theme as antdTheme,
  Tooltip,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
// react-grid-layout 2.x drops the old ``WidthProvider`` HOC in favor
// of a ``useContainerWidth`` hook. ``@types/react-grid-layout@1.x``
// predates that change, so we cast the imports to loose types and
// read the hook's real return shape below.
import { Responsive as ResponsiveRaw, useContainerWidth as useContainerWidthRaw } from "react-grid-layout";
const Responsive = ResponsiveRaw as unknown as React.ComponentType<any>;
// The hook actually returns an *object*
// ``{ width, mounted, containerRef, measureWidth }`` — not a tuple.
// Earlier I destructured it as ``[ref, width]`` which gave
// ``undefined`` for both in production and crashed the render.
const useContainerWidth = useContainerWidthRaw as unknown as (opts?: {
  measureBeforeMount?: boolean;
  initialWidth?: number;
}) => {
  width: number;
  mounted: boolean;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  measureWidth: () => void;
};

type RGLLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
};

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import {
  addWidget,
  addWidgetFromTemplate,
  createDashboard,
  deleteDashboard,
  deleteWidget,
  getDashboard,
  listDashboards,
  listWidgetTemplates,
  saveLayout,
} from "@/api/dashboards";
import { DashboardSettingsDrawer } from "@/components/dashboard/DashboardSettingsDrawer";
import { WidgetSettingsDrawer } from "@/components/dashboard/WidgetSettingsDrawer";
import { WidgetShell } from "@/components/dashboard/WidgetShell";
import { useAuthStore } from "@/store/auth";
import { useWorkspaceStore } from "@/store/workspace";
import type { DashboardWidgetRead, WidgetType } from "@/types";
import { notify } from "@/utils/notify";


/**
 * Dashboard page — router-style:
 *   /dashboard           → redirect to the current workspace's system dashboard
 *   /dashboard/:id       → specific dashboard
 *
 * Inside one page we show:
 *   - top row with workspace's dashboards as tabs + "+" to create
 *   - react-grid-layout holding WidgetShell instances
 *   - "Добавить виджет" and "Настройки дашборда" buttons for editors
 */
export function DashboardPage() {
  const { id } = useParams<{ id?: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const ws = useWorkspaceStore((s) => s.current);
  const { token } = antdTheme.useToken();

  // Workspace-level list for the tab switcher.
  const listQ = useQuery({
    queryKey: ["dashboards", ws?.id ?? "none"],
    queryFn: () => (ws ? listDashboards(ws.id) : Promise.resolve([])),
    enabled: Boolean(ws),
  });

  // When arriving at /dashboard without an id, pick the workspace's
  // system dashboard (``is_system=true``). If there's none yet (new
  // workspace, race), fall back to the first entry in the list.
  const list = listQ.data ?? [];
  const systemDash = list.find((d) => d.is_system);
  useEffect(() => {
    if (!id && systemDash) {
      nav(`/dashboard/${systemDash.id}`, { replace: true });
    }
  }, [id, systemDash?.id, nav]);

  const dashQ = useQuery({
    queryKey: ["dashboard", id],
    queryFn: () => getDashboard(id!),
    enabled: Boolean(id),
  });
  const dash = dashQ.data;

  // Local draft of widgets so drag/resize doesn't have to round-trip
  // the backend for every mouse move. Reset when the upstream changes.
  const [widgets, setWidgets] = useState<DashboardWidgetRead[]>([]);
  useEffect(() => {
    if (dash?.widgets) setWidgets(dash.widgets);
  }, [dash?.widgets]);

  const [editing, setEditing] = useState<DashboardWidgetRead | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [dashSettingsOpen, setDashSettingsOpen] = useState(false);

  const saveLayoutM = useMutation({
    mutationFn: (items: { id: string; grid_x: number; grid_y: number; grid_w: number; grid_h: number }[]) =>
      saveLayout(id!, items),
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Не удалось сохранить раскладку"),
  });

  const addWidgetM = useMutation({
    mutationFn: (wt: WidgetType) => {
      // Per-type default grid footprint.
      //   table  → full row, tall (plenty of rows usually)
      //   stat / progress / sparkline → compact tiles (3x2)
      //   everything else → half row (6x4)
      let grid_w = 6;
      let grid_h = 4;
      if (wt === "table") { grid_w = 12; grid_h = 5; }
      else if (wt === "stat" || wt === "progress" || wt === "sparkline") { grid_w = 3; grid_h = 2; }
      return addWidget(id!, {
        widget_type: wt,
        title: "Новый виджет",
        grid_x: 0,
        grid_y: 1000, // put at the bottom; RGL will compact
        grid_w,
        grid_h,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", id] });
    },
  });

  const addFromTemplateM = useMutation({
    mutationFn: (tid: string) => addWidgetFromTemplate(id!, tid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", id] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const delWidgetM = useMutation({
    mutationFn: (wid: string) => deleteWidget(wid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard", id] }),
  });

  const delDashM = useMutation({
    mutationFn: () => deleteDashboard(id!),
    onSuccess: () => {
      notify.success("Дашборд удалён");
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      if (systemDash) nav(`/dashboard/${systemDash.id}`, { replace: true });
      else nav("/dashboard", { replace: true });
    },
  });

  // Map widgets → RGL layout items (12-col grid).
  const layout: RGLLayoutItem[] = useMemo(
    () =>
      widgets.map((w) => ({
        i: w.id,
        x: w.grid_x,
        y: w.grid_y,
        w: w.grid_w,
        h: w.grid_h,
        minW: 3,
        minH: 3,
      })),
    [widgets],
  );

  const onLayoutChange = (next: readonly any[]) => {
    if (!dash?.can_edit || !id) return;
    // Apply locally first for responsiveness, then debounce-push to server.
    setWidgets((prev) =>
      prev.map((w) => {
        const l = next.find((n) => n.i === w.id);
        return l ? { ...w, grid_x: l.x, grid_y: l.y, grid_w: l.w, grid_h: l.h } : w;
      }),
    );
    saveLayoutM.mutate(
      next.map((l) => ({
        id: l.i,
        grid_x: l.x,
        grid_y: l.y,
        grid_w: l.w,
        grid_h: l.h,
      })),
    );
  };

  if (!ws) {
    return <Empty description="Выберите рабочее пространство" />;
  }
  if (listQ.isLoading || dashQ.isLoading) {
    return <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>;
  }

  return (
    <>
      {/* Tab-like switcher with system first + "+" to create */}
      <Space
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}
        wrap
      >
        <Space wrap size={6}>
          {list.map((d) => {
            const active = d.id === id;
            return (
              <Button
                key={d.id}
                type={active ? "primary" : "text"}
                onClick={() => nav(`/dashboard/${d.id}`)}
                size="middle"
                style={{ borderRadius: 999, paddingInline: 14 }}
              >
                <span style={{ marginRight: 6 }}>{d.icon ?? (d.is_system ? "📊" : "📈")}</span>
                {d.name}
                {d.is_system && (
                  <Tag color="default" style={{ marginLeft: 8 }}>
                    системный
                  </Tag>
                )}
              </Button>
            );
          })}
          <Tooltip title="Создать пользовательский дашборд">
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
            />
          </Tooltip>
        </Space>

        {dash && (
          <Space>
            {dash.can_edit && (
              <AddWidgetButton
                onAdd={(wt) => addWidgetM.mutate(wt)}
                onAddFromTemplate={(tid) => addFromTemplateM.mutate(tid)}
              />
            )}
            {dash.can_edit && (
              <Tooltip title="Настройки дашборда">
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => setDashSettingsOpen(true)}
                />
              </Tooltip>
            )}
            {dash && !dash.is_system && dash.owner_user_id === me?.id && (
              <Popconfirm
                title="Удалить дашборд?"
                onConfirm={() => delDashM.mutate()}
                okButtonProps={{ danger: true }}
                okText="Удалить"
                cancelText="Отмена"
              >
                <Button danger icon={<DeleteOutlined />}>
                  Удалить
                </Button>
              </Popconfirm>
            )}
          </Space>
        )}
      </Space>

      {dash && dash.description && (
        <Typography.Paragraph type="secondary" style={{ marginTop: -4, marginBottom: 12 }}>
          {dash.description}
        </Typography.Paragraph>
      )}

      {widgets.length === 0 ? (
        <Empty
          description={
            dash?.can_edit
              ? "Пока нет виджетов — добавьте первый сверху справа"
              : "Пока нет виджетов"
          }
          style={{ padding: 60 }}
        />
      ) : (
        <GridHost
          layout={layout}
          widgets={widgets}
          canEdit={dash?.can_edit ?? false}
          token={token}
          onLayoutChange={onLayoutChange}
          onEdit={(w) => setEditing(w)}
          onDelete={(id) => delWidgetM.mutateAsync(id)}
        />
      )}

      {id && (
        <WidgetSettingsDrawer
          dashId={id}
          widget={editing}
          onClose={() => setEditing(null)}
        />
      )}

      <DashboardSettingsDrawer
        dashboard={dashSettingsOpen ? dash ?? null : null}
        onClose={() => setDashSettingsOpen(false)}
      />

      <CreateDashboardModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(newId) => {
          setCreateOpen(false);
          qc.invalidateQueries({ queryKey: ["dashboards"] });
          nav(`/dashboard/${newId}`);
        }}
      />
    </>
  );
}

/**
 * Host for ``<Responsive>`` that measures its own container via the
 * ``useContainerWidth`` hook (react-grid-layout v2 replaced the old
 * ``WidthProvider`` HOC with this pattern). Lives in its own
 * component so the hook is called at a predictable spot in the tree.
 */
function GridHost({
  layout,
  widgets,
  canEdit,
  token,
  onLayoutChange,
  onEdit,
  onDelete,
}: {
  layout: RGLLayoutItem[];
  widgets: DashboardWidgetRead[];
  canEdit: boolean;
  token: ReturnType<typeof antdTheme.useToken>["token"];
  onLayoutChange: (next: readonly any[]) => void;
  onEdit: (w: DashboardWidgetRead) => void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const { width, containerRef } = useContainerWidth();
  return (
    <div ref={containerRef} style={{ background: "transparent" }}>
      <style>{`
        .react-grid-item > .react-resizable-handle::after {
          border-color: ${token.colorBorder};
        }
        .react-grid-placeholder {
          background: ${token.colorPrimary} !important;
          opacity: 0.18 !important;
          border-radius: 10px !important;
        }
      `}</style>
      {width > 0 && (
        <Responsive
          className="layout"
          width={width}
          layouts={{ lg: layout, md: layout, sm: layout, xs: layout, xxs: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          isDraggable={canEdit}
          isResizable={canEdit}
          draggableCancel="[data-no-drag]"
          onLayoutChange={onLayoutChange}
          margin={[12, 12]}
        >
          {widgets.map((w) => (
            <div key={w.id}>
              <WidgetShell
                widget={w}
                canEdit={canEdit}
                onEdit={() => onEdit(w)}
                onDelete={() => onDelete(w.id)}
              />
            </div>
          ))}
        </Responsive>
      )}
    </div>
  );
}


/* ═══ Add widget dropdown ═══ */

// Full ApexCharts catalog + our own Table. Order mirrors the chart-types
// navigation on apexcharts.com/docs so it's trivial to compare against
// the library's list.
const ADD_ITEMS: { key: WidgetType; label: string; icon: string }[] = [
  // Our own compact primitives first — they're what most dashboards need
  { key: "stat",          label: "KPI / одно число",        icon: "#️⃣" },
  { key: "progress",      label: "Прогресс (кольцо/бар)",   icon: "◯" },
  { key: "sparkline",     label: "Спарклайн",               icon: "〰" },
  { key: "custom",        label: "Пользовательский (пакет)", icon: "🧩" },
  // ApexCharts catalogue in the order it appears on apexcharts.com/docs
  { key: "line",          label: "Линейный график",         icon: "📈" },
  { key: "area",          label: "Область",                 icon: "🌊" },
  { key: "bar",           label: "Столбцы (вертикальные)",  icon: "📊" },
  { key: "barHorizontal", label: "Столбцы (горизонтальные)", icon: "📏" },
  { key: "mixed",         label: "Смешанный (линия+столбцы)", icon: "🎚" },
  { key: "rangeArea",     label: "Диапазонная область",     icon: "🎭" },
  { key: "rangeBar",      label: "Timeline (range bar)",    icon: "🗓" },
  { key: "funnel",        label: "Воронка",                 icon: "🧪" },
  { key: "candlestick",   label: "Свечи",                   icon: "🕯" },
  { key: "boxplot",       label: "Boxplot (ящик с усами)",  icon: "📦" },
  { key: "bubble",        label: "Пузырьки",                icon: "🫧" },
  { key: "scatter",       label: "Точки",                   icon: "•" },
  { key: "heatmap",       label: "Тепловая карта",          icon: "🔥" },
  { key: "treemap",       label: "Treemap",                 icon: "◼" },
  { key: "pie",           label: "Круговая",                icon: "🥧" },
  { key: "donut",         label: "Кольцо",                  icon: "🍩" },
  { key: "radar",         label: "Радар",                   icon: "🕸" },
  { key: "polarArea",     label: "Полярная",                icon: "🌐" },
  { key: "radialBar",     label: "Радиальные бары",         icon: "⚪" },
  { key: "table",         label: "Таблица",                 icon: "🗂" },
];

function AddWidgetButton({
  onAdd,
  onAddFromTemplate,
}: {
  onAdd: (wt: WidgetType) => void;
  onAddFromTemplate: (templateId: string) => void;
}) {
  const ws = useWorkspaceStore((s) => s.current);
  const templatesQ = useQuery({
    queryKey: ["widget-templates", ws?.id ?? "none"],
    queryFn: () => (ws ? listWidgetTemplates(ws.id) : Promise.resolve([])),
    enabled: Boolean(ws),
    staleTime: 60_000,
  });

  const templates = templatesQ.data ?? [];
  const items: NonNullable<React.ComponentProps<typeof Dropdown>["menu"]>["items"] = [];

  if (templates.length > 0) {
    items.push({
      key: "group-templates",
      type: "group",
      label: "Из шаблонов команды",
      children: templates.map((t) => ({
        key: `t:${t.id}`,
        label: (
          <span>
            {t.icon ?? "⭐"} {t.name}
            <Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
              {t.widget_type}
            </Typography.Text>
          </span>
        ),
        onClick: () => onAddFromTemplate(t.id),
      })),
    });
    items.push({ type: "divider" as const });
  }

  items.push({
    key: "group-standard",
    type: "group",
    label: "Стандартные типы",
    children: ADD_ITEMS.map((it) => ({
      key: it.key,
      label: <span>{it.icon} {it.label}</span>,
      onClick: () => onAdd(it.key),
    })),
  });

  return (
    <Dropdown menu={{ items }} trigger={["click"]}>
      <Button type="primary" icon={<PlusOutlined />}>
        Добавить виджет
      </Button>
    </Dropdown>
  );
}

/* ═══ Create dashboard modal ═══ */

function CreateDashboardModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const ws = useWorkspaceStore((s) => s.current);
  const [form] = Form.useForm<{ name: string; description?: string; icon?: string }>();
  const m = useMutation({
    mutationFn: (v: { name: string; description?: string; icon?: string }) =>
      createDashboard(ws!.id, v),
    onSuccess: (d) => {
      notify.success("Дашборд создан");
      form.resetFields();
      onCreated(d.id);
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      title="Новый дашборд"
      okText="Создать"
      cancelText="Отмена"
      confirmLoading={m.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={(v) => m.mutate(v)}>
        <Form.Item
          name="name"
          label="Название"
          rules={[{ required: true, min: 1, max: 200 }]}
        >
          <Input placeholder="Например: Релизная аналитика" />
        </Form.Item>
        <Form.Item name="icon" label="Иконка">
          <Input placeholder="📊" maxLength={4} />
        </Form.Item>
        <Form.Item name="description" label="Описание">
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 5 }}
            placeholder="Для чего этот дашборд и кого интересует"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
