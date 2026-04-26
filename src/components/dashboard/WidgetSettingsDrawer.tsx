import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  ColorPicker,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Typography,
} from "antd";
import { useEffect } from "react";

import {
  createWidgetTemplate,
  listDatasources,
  updateWidget,
} from "@/api/dashboards";
import { useWorkspaceStore } from "@/store/workspace";
import type { DashboardWidgetRead, WidgetType } from "@/types";
import { notify } from "@/utils/notify";

/**
 * Settings drawer for a single widget. Lets the user change:
 *   - title
 *   - widget type (with a warning if the new type would need fewer
 *     data series than the current source returns)
 *   - data source
 *   - a few chart_options (colors, show legend, labels, smoothing)
 *
 * Kept deliberately non-exhaustive: Apex has ~40 config knobs per
 * chart type and a "full editor" is never what the end user wants.
 * Power users can edit chart_options JSON directly via the "Ещё"
 * section.
 */

interface Props {
  dashId: string;
  widget: DashboardWidgetRead | null;
  onClose: () => void;
}

// Widgets grouped by "how many dataseries do you need from the source".
// When switching between groups we warn about a data-shape mismatch
// (the backend source still returns the same shape, but the chart
// will represent it differently — sometimes meaningfully, sometimes
// nonsensically).
const SINGLE_SERIES: WidgetType[] = [
  "pie", "donut", "radialBar", "polarArea", "funnel", "treemap",
  "stat", "progress", "sparkline",
];
const TABULAR: WidgetType[] = ["table"];
// Custom packages handle their own shape — treat as "any", no warning
// on source switches.

const WIDGET_LABELS: Record<WidgetType, string> = {
  stat: "KPI / число",
  progress: "Прогресс",
  sparkline: "Спарклайн",
  custom: "Пользовательский (пакет)",
  line: "Линия",
  area: "Область",
  bar: "Столбцы вертикальные",
  barHorizontal: "Столбцы горизонтальные",
  mixed: "Смешанный",
  rangeArea: "Диапазонная область",
  rangeBar: "Range bar (timeline)",
  funnel: "Воронка",
  candlestick: "Свечи",
  boxplot: "Boxplot",
  bubble: "Пузырьки",
  scatter: "Точки",
  heatmap: "Теплокарта",
  treemap: "Treemap",
  pie: "Круговая",
  donut: "Кольцо",
  radar: "Радар",
  polarArea: "Полярная",
  radialBar: "Радиальные бары",
  table: "Таблица",
};

function seriesGroup(t: WidgetType): "single" | "multi" | "tabular" {
  if (SINGLE_SERIES.includes(t)) return "single";
  if (TABULAR.includes(t)) return "tabular";
  return "multi";
}

export function WidgetSettingsDrawer({ dashId, widget, onClose }: Props) {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const ws = useWorkspaceStore((s) => s.current);

  const saveTemplateM = useMutation({
    mutationFn: (v: {
      name: string; description?: string; icon?: string;
    }) => {
      if (!widget || !ws) throw new Error("missing ctx");
      return createWidgetTemplate(ws.id, {
        name: v.name,
        description: v.description,
        icon: v.icon,
        widget_type: widget.widget_type,
        datasource_code: widget.datasource_code,
        datasource_params: widget.datasource_params,
        chart_options: widget.chart_options,
        default_w: widget.grid_w,
        default_h: widget.grid_h,
      });
    },
    onSuccess: () => {
      notify.success("Сохранено как шаблон");
      qc.invalidateQueries({ queryKey: ["widget-templates"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const askSaveTemplate = () => {
    let draft = { name: widget?.title ?? "", description: "", icon: "" };
    Modal.confirm({
      title: "Сохранить как шаблон",
      content: (
        <div style={{ marginTop: 8 }}>
          <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
            Шаблон увидят все участники вашего пространства — они смогут
            добавлять такой же виджет на свои дашборды одним кликом.
          </Typography.Paragraph>
          <Form
            layout="vertical"
            initialValues={draft}
            onValuesChange={(_, all) => { draft = all; }}
          >
            <Form.Item label="Название" name="name"
              rules={[{ required: true, min: 1, max: 200 }]}>
              <Input placeholder="Например: Запуски за 14 дней" />
            </Form.Item>
            <Form.Item label="Иконка" name="icon">
              <Input placeholder="📊" maxLength={4} />
            </Form.Item>
            <Form.Item label="Описание" name="description">
              <Input.TextArea
                autoSize={{ minRows: 2, maxRows: 4 }}
                placeholder="Когда и зачем использовать"
              />
            </Form.Item>
          </Form>
        </div>
      ),
      okText: "Сохранить",
      cancelText: "Отмена",
      onOk: () => {
        if (!draft.name?.trim()) {
          notify.error("Название обязательно");
          return Promise.reject();
        }
        return saveTemplateM.mutateAsync(draft);
      },
    });
  };

  const dsQ = useQuery({
    queryKey: ["datasources"],
    queryFn: listDatasources,
    staleTime: 10 * 60_000,
  });

  // Bucket datasources by group key so the Select can render them as
  // ``<optgroup>``s. Same order as the groups list from the backend.
  const grouped = (() => {
    const out: { label: string; options: { value: string; label: React.ReactNode }[] }[] = [];
    const groups = dsQ.data?.groups ?? [];
    const items = dsQ.data?.items ?? [];
    for (const g of groups) {
      const opts = items
        .filter((i) => (i.group ?? "") === g.code)
        .map((i) => ({
          value: i.code,
          label: (
            <div>
              <div>{i.name}</div>
              <div style={{ fontSize: 11, color: "#8c8c8c" }}>
                {i.kind} · {i.code}
              </div>
            </div>
          ),
        }));
      if (opts.length) out.push({ label: g.name, options: opts });
    }
    // Anything without a matching group — put at the end as «Прочее».
    const ungrouped = items
      .filter((i) => !groups.find((g) => g.code === i.group))
      .map((i) => ({
        value: i.code,
        label: (
          <div>
            <div>{i.name}</div>
            <div style={{ fontSize: 11, color: "#8c8c8c" }}>
              {i.kind} · {i.code}
            </div>
          </div>
        ),
      }));
    if (ungrouped.length) out.push({ label: "Прочее", options: ungrouped });
    return out;
  })();

  // Live-watch widget_type so the KPI/Progress block can show/hide based
  // on the current selection (not just the saved widget). Without watch,
  // toggling type → save was the only way to reveal those fields.
  const watchedType = Form.useWatch("widget_type", form);

  useEffect(() => {
    if (widget) {
      const opts = (widget.chart_options ?? {}) as any;
      form.setFieldsValue({
        title: widget.title,
        widget_type: widget.widget_type,
        datasource_code: widget.datasource_code,
        datasource_params: JSON.stringify(widget.datasource_params ?? {}, null, 2),
        chart_options: JSON.stringify(widget.chart_options ?? {}, null, 2),
        // Quick-options mirrored out of chart_options so the UI can
        // read them as form fields. Saved back on submit via mergeQuickOptions.
        quick_stacked: opts?.chart?.stacked === true,
        quick_smooth: opts?.stroke?.curve === "smooth",
        quick_no_legend: opts?.legend?.show === false,
        quick_refresh_seconds: opts?._refresh_seconds ?? 0,
        quick_drilldown_url: opts?._drilldown_url ?? "",
        // KPI/Progress options — top-level in chart_options (no underscore
        // prefix because the renderer reads them as native ``opts.X``).
        kpi_unit: opts?.unit ?? "",
        kpi_precision: opts?.precision ?? 0,
        kpi_good_direction: opts?.goodDirection ?? "up",
        kpi_compare_baseline: opts?.compareBaseline ?? "previous",
        progress_target: opts?.target ?? 100,
        progress_style: opts?.style ?? "circle",
        progress_stroke_color: opts?.strokeColor ?? "",
      });
    }
  }, [widget, form]);

  // Merge quick-option toggles into the raw chart_options blob.
  // Underscore-prefixed keys (``_refresh_seconds``, ``_drilldown_url``)
  // are NOT part of Apex's schema — they're our own extensions; Apex
  // ignores them, our renderer/refresh logic reads them. KPI/Progress
  // keys (unit, precision, target, style, ...) are read by Stat/Progress
  // renderers from top-level chart_options, so we set them without
  // an underscore prefix to keep WidgetRenderer code unchanged.
  const mergeQuickOptions = (
    rawOpts: Record<string, unknown>,
    quick: {
      stacked?: boolean;
      smooth?: boolean;
      no_legend?: boolean;
      refresh_seconds?: number;
      drilldown_url?: string;
      widget_type?: string;
      kpi_unit?: string;
      kpi_precision?: number;
      kpi_good_direction?: "up" | "down";
      kpi_compare_baseline?: "first" | "previous";
      progress_target?: number;
      progress_style?: "line" | "circle" | "dashboard";
      progress_stroke_color?: string;
    },
  ) => {
    const out: any = { ...rawOpts };
    if (quick.stacked !== undefined) {
      out.chart = { ...(out.chart ?? {}), stacked: quick.stacked };
    }
    if (quick.smooth !== undefined) {
      out.stroke = { ...(out.stroke ?? {}), curve: quick.smooth ? "smooth" : "straight" };
    }
    if (quick.no_legend !== undefined) {
      out.legend = { ...(out.legend ?? {}), show: !quick.no_legend };
    }
    if (quick.refresh_seconds && quick.refresh_seconds > 0) {
      out._refresh_seconds = quick.refresh_seconds;
    } else {
      delete out._refresh_seconds;
    }
    if (quick.drilldown_url && quick.drilldown_url.trim()) {
      out._drilldown_url = quick.drilldown_url.trim();
    } else {
      delete out._drilldown_url;
    }

    // KPI block — applies to ``stat`` and ``sparkline`` (label/unit are
    // also relevant for sparkline tooltip in the future).
    const isKpiType = quick.widget_type === "stat" || quick.widget_type === "sparkline";
    if (isKpiType) {
      if (quick.kpi_unit !== undefined) {
        if (quick.kpi_unit.trim()) out.unit = quick.kpi_unit.trim();
        else delete out.unit;
      }
      if (quick.kpi_precision !== undefined && quick.kpi_precision >= 0) {
        out.precision = quick.kpi_precision;
      }
      if (quick.widget_type === "stat") {
        if (quick.kpi_good_direction) out.goodDirection = quick.kpi_good_direction;
        if (quick.kpi_compare_baseline) out.compareBaseline = quick.kpi_compare_baseline;
      }
    }

    // Progress block.
    if (quick.widget_type === "progress") {
      if (quick.kpi_unit !== undefined) {
        if (quick.kpi_unit.trim()) out.unit = quick.kpi_unit.trim();
        else delete out.unit;
      }
      if (quick.kpi_precision !== undefined && quick.kpi_precision >= 0) {
        out.precision = quick.kpi_precision;
      }
      if (quick.progress_target !== undefined && quick.progress_target > 0) {
        out.target = quick.progress_target;
      }
      if (quick.progress_style) out.style = quick.progress_style;
      if (quick.progress_stroke_color && quick.progress_stroke_color.trim()) {
        out.strokeColor = quick.progress_stroke_color.trim();
      } else {
        delete out.strokeColor;
      }
    }

    return out;
  };

  const updateM = useMutation({
    mutationFn: (patch: Partial<DashboardWidgetRead>) =>
      updateWidget(widget!.id, patch),
    onSuccess: () => {
      notify.success("Виджет сохранён");
      qc.invalidateQueries({ queryKey: ["dashboard", dashId] });
      qc.invalidateQueries({ queryKey: ["widget-data", widget!.id] });
      onClose();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  if (!widget) return null;

  const commit = (patch: Partial<DashboardWidgetRead>) => {
    // Warn on cross-group switch (e.g. line → pie). Data won't break
    // the render (pie just shows the first series), but the user
    // should know.
    if (patch.widget_type && patch.widget_type !== widget.widget_type) {
      const fromG = seriesGroup(widget.widget_type);
      const toG = seriesGroup(patch.widget_type);
      if (fromG !== toG) {
        Modal.confirm({
          title: "Смена типа виджета",
          content: (
            <Space direction="vertical" size={8}>
              <Typography.Paragraph style={{ margin: 0 }}>
                Вы меняете тип c <Typography.Text code>{widget.widget_type}</Typography.Text>
                {" "}на <Typography.Text code>{patch.widget_type}</Typography.Text>.
              </Typography.Paragraph>
              <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                {fromG === "multi" && toG === "single" && (
                  "Новый тип принимает только один ряд данных. Первый ряд " +
                  "источника будет показан, остальные — проигнорированы."
                )}
                {fromG === "single" && toG === "multi" && (
                  "Новый тип может принимать несколько рядов. Источник может " +
                  "не давать их — виджет покажет один ряд."
                )}
                {(fromG === "tabular" || toG === "tabular") && (
                  "Для таблицы нужен табличный источник (runs.recent и " +
                  "подобные). Смена может дать «Нет данных», пока не " +
                  "выбран совместимый источник."
                )}
              </Typography.Paragraph>
              <Typography.Paragraph style={{ margin: 0 }}>
                Продолжить?
              </Typography.Paragraph>
            </Space>
          ),
          okText: "Да, поменять",
          cancelText: "Отмена",
          okButtonProps: { danger: false },
          onOk: () => updateM.mutate(patch),
        });
        return;
      }
    }
    updateM.mutate(patch);
  };

  return (
    <Drawer
      open={!!widget}
      onClose={onClose}
      title={`Настройки: ${widget.title}`}
      width={520}
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={askSaveTemplate}>Сохранить как шаблон</Button>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            type="primary"
            onClick={() =>
              form.validateFields().then((v) => {
                let params: Record<string, unknown> = {};
                let opts: Record<string, unknown> = {};
                try { params = JSON.parse(v.datasource_params || "{}"); } catch {}
                try { opts = JSON.parse(v.chart_options || "{}"); } catch {}
                // Mix in the quick-option toggles that the user may have
                // tweaked via dedicated controls. These win over what's
                // in the raw JSON (so the UI stays as the source of truth).
                opts = mergeQuickOptions(opts, {
                  stacked: v.quick_stacked,
                  smooth: v.quick_smooth,
                  no_legend: v.quick_no_legend,
                  refresh_seconds: v.quick_refresh_seconds,
                  drilldown_url: v.quick_drilldown_url,
                  widget_type: v.widget_type,
                  kpi_unit: v.kpi_unit,
                  kpi_precision: v.kpi_precision,
                  kpi_good_direction: v.kpi_good_direction,
                  kpi_compare_baseline: v.kpi_compare_baseline,
                  progress_target: v.progress_target,
                  progress_style: v.progress_style,
                  // ColorPicker returns either a string (hex) or a Color
                  // instance — normalize.
                  progress_stroke_color: typeof v.progress_stroke_color === "string"
                    ? v.progress_stroke_color
                    : v.progress_stroke_color?.toHexString?.() ?? "",
                });
                commit({
                  title: v.title,
                  widget_type: v.widget_type,
                  datasource_code: v.datasource_code,
                  datasource_params: params,
                  chart_options: opts,
                });
              })
            }
            loading={updateM.isPending}
          >
            Сохранить
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="Название"
          rules={[{ required: true, min: 1, max: 200 }]}
        >
          <Input placeholder="Например: Запуски за неделю" />
        </Form.Item>

        <Form.Item name="widget_type" label="Тип виджета">
          <Select
            showSearch
            options={Object.entries(WIDGET_LABELS).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="datasource_code"
          label="Источник данных"
          extra="Что именно подсчитывается на сервере и подаётся в виджет."
        >
          <Select
            allowClear
            showSearch
            loading={dsQ.isLoading}
            options={grouped}
            placeholder="Выберите источник"
            // Filter on substring of the code — the visible label is
            // a ReactNode and doesn't participate in Select's default
            // matcher. The raw code is always Latin so it matches fine
            // against Cyrillic typing once the user picks a prefix
            // ("runs", "defects", etc.).
            // Search across both the code and the human name. The
            // option label is a ReactNode and doesn't help us match,
            // so look up the meta by the option's value instead.
            filterOption={(input, option) => {
              const value = (option as { value?: string } | undefined)?.value;
              if (!value) return false;
              const q = input.toLowerCase();
              const code = String(value).toLowerCase();
              const meta = (dsQ.data?.items ?? []).find((i) => i.code === value);
              const name = (meta?.name ?? "").toLowerCase();
              return code.includes(q) || name.includes(q);
            }}
          />
        </Form.Item>

        <Form.Item
          name="datasource_params"
          label="Параметры источника (JSON)"
          extra='Например: {"days": 30} или {"limit": 20}.'
        >
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
        </Form.Item>

        <Divider orientation="left" style={{ marginTop: 8, fontSize: 13 }}>
          Экспресс-настройки
        </Divider>

        <Space direction="vertical" size={8} style={{ width: "100%", marginBottom: 12 }}>
          <Form.Item name="quick_stacked" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>
              Стек (для bar/barHorizontal — складывать серии друг на друга)
            </Checkbox>
          </Form.Item>
          <Form.Item name="quick_smooth" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>
              Сглаженная линия (curve: smooth vs straight)
            </Checkbox>
          </Form.Item>
          <Form.Item name="quick_no_legend" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>
              Скрыть легенду
            </Checkbox>
          </Form.Item>

          <Form.Item
            name="quick_refresh_seconds"
            label="Автообновление данных, сек"
            style={{ marginBottom: 0 }}
            extra="0 = выключено. Минимум 10 сек. Обновляется только этот виджет."
          >
            <InputNumber min={0} max={3600} step={30} style={{ width: 160 }} />
          </Form.Item>

          <Form.Item
            name="quick_drilldown_url"
            label="Ссылка-переход при клике на виджет"
            style={{ marginBottom: 0 }}
            extra={
              <span>
                Поддерживаются плейсхолдеры:{" "}
                <Typography.Text code>{"{category}"}</Typography.Text>,{" "}
                <Typography.Text code>{"{series}"}</Typography.Text>,{" "}
                <Typography.Text code>{"{value}"}</Typography.Text>.
                Например:{" "}
                <Typography.Text code>/runs?status={"{category}"}</Typography.Text>
              </span>
            }
          >
            <Input placeholder="/runs или https://…" allowClear />
          </Form.Item>
        </Space>

        {/* Conditional KPI / Progress block. Visible only when the
            currently-selected widget_type is one of these — keeps the
            drawer tidy for chart-style widgets. ``Form.useWatch`` keeps
            this in sync with the dropdown above without a re-save. */}
        {(watchedType === "stat" || watchedType === "progress" || watchedType === "sparkline") && (
          <>
            <Divider orientation="left" style={{ marginTop: 4, fontSize: 13 }}>
              {watchedType === "progress" ? "Настройки прогресса" : "Настройки KPI"}
            </Divider>
            <Space direction="vertical" size={8} style={{ width: "100%", marginBottom: 12 }}>
              <Space wrap>
                <Form.Item
                  name="kpi_unit"
                  label="Единица измерения"
                  style={{ marginBottom: 0, width: 180 }}
                  extra="Например: %, ms, шт"
                >
                  <Input maxLength={16} placeholder="—" />
                </Form.Item>
                <Form.Item
                  name="kpi_precision"
                  label="Знаков после запятой"
                  style={{ marginBottom: 0, width: 160 }}
                >
                  <InputNumber min={0} max={4} style={{ width: "100%" }} />
                </Form.Item>
              </Space>

              {watchedType === "stat" && (
                <Space wrap>
                  <Form.Item
                    name="kpi_good_direction"
                    label="«Хороший» тренд"
                    style={{ marginBottom: 0, width: 220 }}
                    extra="Какое направление считать улучшением — определяет цвет стрелки"
                  >
                    <Select
                      options={[
                        { value: "up", label: "Рост = хорошо (зелёный ↑)" },
                        { value: "down", label: "Падение = хорошо (зелёный ↓)" },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item
                    name="kpi_compare_baseline"
                    label="Сравнивать с"
                    style={{ marginBottom: 0, width: 220 }}
                  >
                    <Select
                      options={[
                        { value: "previous", label: "Предыдущим значением" },
                        { value: "first", label: "Первым значением в ряду" },
                      ]}
                    />
                  </Form.Item>
                </Space>
              )}

              {watchedType === "progress" && (
                <>
                  <Space wrap>
                    <Form.Item
                      name="progress_target"
                      label="Цель (target)"
                      style={{ marginBottom: 0, width: 160 }}
                      extra="Текущее / target × 100%"
                    >
                      <InputNumber min={1} step={1} style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item
                      name="progress_style"
                      label="Стиль"
                      style={{ marginBottom: 0, width: 180 }}
                    >
                      <Select
                        options={[
                          { value: "circle", label: "Кольцо" },
                          { value: "dashboard", label: "Дашборд (полукруг)" },
                          { value: "line", label: "Полоса" },
                        ]}
                      />
                    </Form.Item>
                  </Space>
                  <Form.Item
                    name="progress_stroke_color"
                    label="Цвет полосы"
                    style={{ marginBottom: 0 }}
                    extra="Пусто = акцентный цвет темы"
                  >
                    <ColorPicker showText format="hex" />
                  </Form.Item>
                </>
              )}
            </Space>
          </>
        )}

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Продвинутые настройки"
          description={
            <span>
              Любые параметры ApexCharts можно задать в JSON ниже — они накладываются
              поверх разумных значений по умолчанию.
              <br />
              Для аннотаций:{" "}
              <Typography.Text code>{"{\"annotations\":{\"yaxis\":[{\"y\":100,\"label\":{\"text\":\"SLA\"}}]}}"}</Typography.Text>.
            </span>
          }
        />

        <Form.Item
          name="chart_options"
          label="Опции графика (ApexCharts JSON)"
          extra="Пусто = дефолты. Переключатели выше имеют приоритет — они перетрут соответствующие поля при сохранении."
        >
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 10 }} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
