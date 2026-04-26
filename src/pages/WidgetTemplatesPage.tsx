import {
  ArrowDownOutlined,
  ArrowUpOutlined,
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
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";

import {
  deleteWidgetTemplate,
  listWidgetTemplates,
  reorderWidgetTemplates,
  updateWidgetTemplate,
} from "@/api/dashboards";
import { useAuthStore } from "@/store/auth";
import { useWorkspaceStore } from "@/store/workspace";
import type { WidgetTemplateRead, WidgetType } from "@/types";
import { notify } from "@/utils/notify";

const WIDGET_LABELS: Record<WidgetType, string> = {
  stat: "KPI", progress: "Прогресс", sparkline: "Спарклайн",
  custom: "Пакет",
  line: "Линия", area: "Область",
  bar: "Столбцы (верт.)", barHorizontal: "Столбцы (гориз.)",
  mixed: "Смешанный", rangeArea: "Range area",
  rangeBar: "Range bar", funnel: "Воронка",
  candlestick: "Свечи", boxplot: "Boxplot",
  bubble: "Пузырьки", scatter: "Точки",
  heatmap: "Теплокарта", treemap: "Treemap",
  pie: "Круговая", donut: "Кольцо",
  radar: "Радар", polarArea: "Полярная",
  radialBar: "Радиал.",
  table: "Таблица",
};

/**
 * Workspace-level widget template catalogue. Any member sees it;
 * owner edits meta; author deletes. Creating new templates happens
 * from a dashboard's widget settings drawer via "Сохранить как шаблон".
 */
export function WidgetTemplatesPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<WidgetTemplateRead | null>(null);

  const q = useQuery({
    queryKey: ["widget-templates", ws?.id ?? "none"],
    queryFn: () => (ws ? listWidgetTemplates(ws.id) : Promise.resolve([])),
    enabled: Boolean(ws),
  });

  const delM = useMutation({
    mutationFn: (id: string) => deleteWidgetTemplate(id),
    onSuccess: () => {
      notify.success("Шаблон удалён");
      qc.invalidateQueries({ queryKey: ["widget-templates"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  // Manual reorder via ↑/↓ buttons. We compute fresh sort_order values
  // from the current row order with step=10, then PUT a batch update.
  // Cheaper than DnD and works without extra deps; can swap to dnd-kit
  // later if the list grows past ~20 items.
  const reorderM = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      reorderWidgetTemplates(ws!.id, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["widget-templates"] }),
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const moveTemplate = (idx: number, dir: -1 | 1) => {
    const list = q.data ?? [];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= list.length) return;
    const reordered = [...list];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    reorderM.mutate(
      reordered.map((t, i) => ({ id: t.id, sort_order: i * 10 })),
    );
  };

  if (!ws) return <Alert type="info" message="Выберите рабочее пространство" />;

  const rows = q.data ?? [];

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        Шаблоны виджетов
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        «Пользовательские виджеты» вашего пространства. Любой сохранённый шаблон
        появляется в меню «Добавить виджет → Из шаблонов команды» на каждом
        дашборде. Создать шаблон можно прямо из настроек виджета — кнопка
        «Сохранить как шаблон».
      </Typography.Paragraph>

      <Card>
        {rows.length === 0 ? (
          <Empty description="Пока ни одного шаблона — создайте первый через настройки виджета на дашборде" />
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
                render: (v, r: WidgetTemplateRead) => (
                  <Space>
                    <span>{r.icon ?? "📊"}</span>
                    <span>{v}</span>
                  </Space>
                ),
              },
              {
                title: "Тип",
                dataIndex: "widget_type",
                width: 140,
                render: (v) => <Tag>{WIDGET_LABELS[v as WidgetType] ?? v}</Tag>,
              },
              {
                title: "Источник",
                dataIndex: "datasource_code",
                render: (v) =>
                  v ? <Typography.Text code>{v}</Typography.Text> : "—",
              },
              {
                title: "Описание",
                dataIndex: "description",
                ellipsis: true,
              },
              {
                title: "",
                width: 150,
                render: (_, r: WidgetTemplateRead, idx) => (
                  <Space size={0}>
                    <Button
                      size="small"
                      type="text"
                      icon={<ArrowUpOutlined />}
                      disabled={idx === 0 || reorderM.isPending}
                      onClick={() => moveTemplate(idx, -1)}
                      title="Поднять выше"
                    />
                    <Button
                      size="small"
                      type="text"
                      icon={<ArrowDownOutlined />}
                      disabled={idx === rows.length - 1 || reorderM.isPending}
                      onClick={() => moveTemplate(idx, 1)}
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
                        title="Удалить шаблон?"
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

      <EditTemplateDrawer
        template={editing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function EditTemplateDrawer({
  template,
  onClose,
}: {
  template: WidgetTemplateRead | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  useEffect(() => {
    if (template) {
      form.setFieldsValue({
        name: template.name,
        icon: template.icon ?? "",
        description: template.description ?? "",
        widget_type: template.widget_type,
        default_w: template.default_w,
        default_h: template.default_h,
      });
    }
  }, [template, form]);

  const m = useMutation({
    mutationFn: (patch: Partial<WidgetTemplateRead>) =>
      updateWidgetTemplate(template!.id, patch),
    onSuccess: () => {
      notify.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["widget-templates"] });
      onClose();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  return (
    <Drawer
      open={!!template}
      onClose={onClose}
      title={template ? `Шаблон: ${template.name}` : ""}
      width={480}
      destroyOnHidden
      extra={
        <Space>
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
        <Form.Item name="name" label="Название" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="icon" label="Иконка">
          <Input maxLength={4} placeholder="📊" />
        </Form.Item>
        <Form.Item name="description" label="Описание">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
        </Form.Item>
        <Form.Item name="widget_type" label="Тип">
          <Select
            options={Object.entries(WIDGET_LABELS).map(([v, l]) => ({
              value: v, label: l,
            }))}
          />
        </Form.Item>
        <Space>
          <Form.Item name="default_w" label="Ширина по умолчанию" style={{ width: 160 }}>
            <Input type="number" min={2} max={12} />
          </Form.Item>
          <Form.Item name="default_h" label="Высота по умолчанию" style={{ width: 160 }}>
            <Input type="number" min={2} max={20} />
          </Form.Item>
        </Space>
        <Alert
          type="info"
          showIcon={false}
          style={{ marginTop: 12, fontSize: 12 }}
          message="Источник данных и опции графика берутся из виджета, из которого был сохранён шаблон. Изменить их можно уже на конкретном виджете после добавления."
        />
      </Form>
    </Drawer>
  );
}
