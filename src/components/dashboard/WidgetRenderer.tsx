import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  MinusOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Empty, Progress, Spin, Table, theme as antdTheme, Typography } from "antd";
import { useEffect, useMemo, useRef } from "react";
import ReactApexChart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";

import { getWidgetPackageSource } from "@/api/dashboards";
import { useThemeStore } from "@/store/theme";
import type { DashboardWidgetRead, WidgetDataResponse, WidgetType } from "@/types";

/**
 * Turns a widget config + resolved data into either an ApexCharts
 * rendering or a Table. Per-type defaults are applied; ``chart_options``
 * from the widget merge on top (shallow per top-level section).
 *
 * The data source tells us whether it's categorical, timeseries or
 * tabular; the widget_type tells us how to draw it. Mismatches
 * (e.g. pie with a timeseries source) are still rendered — pie will
 * collapse the series into slice labels — and will look weird. That's
 * the user's call.
 */
interface Props {
  widget: DashboardWidgetRead;
  data: WidgetDataResponse | undefined;
  loading: boolean;
}

export function WidgetRenderer({ widget, data, loading }: Props) {
  const { token } = antdTheme.useToken();

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <Spin />
      </div>
    );
  }

  if (data?.error) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<Typography.Text type="secondary">Ошибка данных: {data.error}</Typography.Text>}
        style={{ margin: "auto" }}
      />
    );
  }

  if (!data || (!data.is_tabular && (!data.series || data.series.every((s) => s.data.length === 0)))) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Typography.Text type="secondary">
            {widget.datasource_code ? "Нет данных" : "Источник данных не выбран"}
          </Typography.Text>
        }
        style={{ margin: "auto" }}
      />
    );
  }

  if (widget.widget_type === "table" || data.is_tabular) {
    return <TableWidget widget={widget} data={data} />;
  }

  if (widget.widget_type === "stat") {
    return <StatWidget widget={widget} data={data} token={token} />;
  }

  if (widget.widget_type === "progress") {
    return <ProgressWidget widget={widget} data={data} token={token} />;
  }

  if (widget.widget_type === "custom") {
    return <CustomWidget widget={widget} data={data} />;
  }

  return <ApexWidget widget={widget} data={data} token={token} />;
}

/* ═══ Custom (Phase 3b — user-authored iframe widgets) ═════════════
 * Loads a ``WidgetPackage`` by id from ``chart_options.package_id`` and
 * renders its HTML inside a sandboxed iframe. Data flows parent →
 * iframe via ``postMessage`` every time it changes.
 *
 * Sandbox flags: ``allow-scripts`` only. No ``allow-same-origin``, so
 * the iframe gets a null origin — no access to our cookies, no fetch
 * to our API, no localStorage reads. Packages that want data get it
 * from the messages we send.
 * ──────────────────────────────────────────────────────────────── */
function CustomWidget({
  widget,
  data,
}: {
  widget: DashboardWidgetRead;
  data: WidgetDataResponse;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const packageId = (widget.chart_options as any)?.package_id as string | undefined;

  const pkgQ = useQuery({
    queryKey: ["widget-package-source", packageId],
    queryFn: () => getWidgetPackageSource(packageId!),
    enabled: !!packageId,
    staleTime: 10 * 60_000,
  });

  // Build the srcdoc once per package (not per data update). Injects a
  // small bootstrap that listens for ``widget-data`` postMessages and
  // calls ``window.render(payload)`` — packages define that function.
  const srcDoc = useMemo(() => {
    if (!pkgQ.data) return undefined;
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
    // Inject bootstrap just before </body>; if the package's HTML is
    // minimal (no body), prepend at start so it always runs.
    const html = pkgQ.data.html_source;
    if (/<\/body>/i.test(html)) {
      return html.replace(/<\/body>/i, `${bootstrap}</body>`);
    }
    return bootstrap + html;
  }, [pkgQ.data]);

  // Re-post data every time it changes (and once on load via "widget-ready").
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !data) return;

    const post = () => {
      iframe.contentWindow?.postMessage(
        { type: "widget-data", payload: { widget, data } },
        "*",
      );
    };

    // Listen for the iframe telling us it's loaded; reply with data.
    const onMessage = (ev: MessageEvent) => {
      if (ev.data && ev.data.type === "widget-ready") post();
    };
    window.addEventListener("message", onMessage);
    // Also try a best-effort direct post in case load already fired
    post();
    return () => window.removeEventListener("message", onMessage);
  }, [widget, data]);

  if (!packageId) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Пакет не выбран — укажите package_id в chart_options"
        style={{ margin: "auto" }}
      />
    );
  }
  if (pkgQ.isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <Spin />
      </div>
    );
  }
  if (pkgQ.isError || !pkgQ.data) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Пакет не найден или удалён"
        style={{ margin: "auto" }}
      />
    );
  }
  return (
    <iframe
      ref={iframeRef}
      title={widget.title}
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      style={{ width: "100%", height: "100%", border: "none", background: "transparent" }}
    />
  );
}

/* ═══ Stat / KPI ═══════════════════════════════════════════════════
 * Shows a single big number. If the source returns a multi-point
 * series, we take the last point as the "current" value and the
 * second-to-last (or first) as the "previous" for a trend indicator.
 * Options in ``chart_options`` (all optional):
 *   - label:   string override (defaults to series[0].name)
 *   - unit:    string suffix ("шт", "%", "ms", …)
 *   - precision: number of decimals
 *   - compareBaseline: "first" | "previous" (default "previous")
 *   - goodDirection: "up" | "down" (default "up"; used for trend color)
 * ──────────────────────────────────────────────────────────────── */
function StatWidget({
  widget,
  data,
  token,
}: {
  widget: DashboardWidgetRead;
  data: WidgetDataResponse;
  token: ReturnType<typeof antdTheme.useToken>["token"];
}) {
  const s = data.series?.[0];
  const vals = s?.data ?? [];
  const opts = (widget.chart_options ?? {}) as {
    label?: string;
    unit?: string;
    precision?: number;
    compareBaseline?: "first" | "previous";
    goodDirection?: "up" | "down";
  };
  if (vals.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Нет значения"
        style={{ margin: "auto" }}
      />
    );
  }
  const current = vals[vals.length - 1];
  const baseline =
    opts.compareBaseline === "first"
      ? vals[0]
      : vals.length > 1
      ? vals[vals.length - 2]
      : undefined;
  const delta = baseline !== undefined ? current - baseline : undefined;
  const pct =
    delta !== undefined && baseline !== undefined && baseline !== 0
      ? (delta / Math.abs(baseline)) * 100
      : undefined;

  const precision = opts.precision ?? 0;
  const formatted = current.toLocaleString("ru-RU", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });

  const goodDir = opts.goodDirection ?? "up";
  let trendColor: string = token.colorTextSecondary as string;
  if (delta !== undefined && delta !== 0) {
    const positiveGood = (delta > 0) === (goodDir === "up");
    trendColor = positiveGood ? token.colorSuccess : token.colorError;
  }
  const TrendIcon =
    delta === undefined || delta === 0
      ? MinusOutlined
      : delta > 0
      ? ArrowUpOutlined
      : ArrowDownOutlined;

  return (
    <div
      style={{
        width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 12, gap: 6, textAlign: "center",
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {opts.label ?? s?.name ?? widget.title}
      </Typography.Text>
      <div
        style={{
          fontSize: "clamp(28px, 5vw, 48px)",
          fontWeight: 600, letterSpacing: "-0.5px",
          color: token.colorText, lineHeight: 1.1,
        }}
      >
        {formatted}
        {opts.unit && (
          <span style={{ fontSize: "0.5em", color: token.colorTextSecondary, marginLeft: 6 }}>
            {opts.unit}
          </span>
        )}
      </div>
      {delta !== undefined && (
        <div
          style={{
            fontSize: 13, color: trendColor,
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          <TrendIcon />
          <span>
            {delta > 0 ? "+" : ""}
            {delta.toLocaleString("ru-RU", {
              minimumFractionDigits: precision, maximumFractionDigits: precision,
            })}
            {pct !== undefined && (
              <span style={{ opacity: 0.8, marginLeft: 4 }}>
                ({pct > 0 ? "+" : ""}
                {pct.toFixed(1)}%)
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

/* ═══ Progress ═════════════════════════════════════════════════════
 * Shows progress toward a target as an antd Progress ring/bar.
 * Takes the last value of series[0] as current. Target and style via
 * chart_options:
 *   - target:   number (default 100)
 *   - style:    "line" | "circle" | "dashboard" (default "circle")
 *   - label:    string override
 *   - unit:     string suffix
 *   - precision: number of decimals
 *   - strokeColor: string override
 * ──────────────────────────────────────────────────────────────── */
function ProgressWidget({
  widget,
  data,
  token,
}: {
  widget: DashboardWidgetRead;
  data: WidgetDataResponse;
  token: ReturnType<typeof antdTheme.useToken>["token"];
}) {
  const s = data.series?.[0];
  const vals = s?.data ?? [];
  const opts = (widget.chart_options ?? {}) as {
    target?: number;
    style?: "line" | "circle" | "dashboard";
    label?: string;
    unit?: string;
    precision?: number;
    strokeColor?: string;
  };
  const current = vals[vals.length - 1] ?? 0;
  const target = opts.target ?? 100;
  const pct = target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : 0;
  const precision = opts.precision ?? 0;

  const stroke = opts.strokeColor ?? token.colorPrimary;
  const style = opts.style ?? "circle";

  return (
    <div
      style={{
        width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 12, gap: 8,
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {opts.label ?? s?.name ?? widget.title}
      </Typography.Text>
      {style === "line" ? (
        <div style={{ width: "90%", maxWidth: 360 }}>
          <Progress
            percent={pct}
            strokeColor={stroke}
            format={() =>
              `${current.toLocaleString("ru-RU", { minimumFractionDigits: precision, maximumFractionDigits: precision })}${
                opts.unit ? ` ${opts.unit}` : ""
              } / ${target.toLocaleString("ru-RU")}`
            }
          />
        </div>
      ) : (
        <Progress
          type={style}
          percent={Math.round(pct * 10) / 10}
          strokeColor={stroke}
          format={() =>
            <span style={{ fontSize: 18, color: token.colorText }}>
              {current.toLocaleString("ru-RU", { minimumFractionDigits: precision, maximumFractionDigits: precision })}
              {opts.unit && (
                <span style={{ fontSize: 12, color: token.colorTextSecondary, marginLeft: 2 }}>
                  {opts.unit}
                </span>
              )}
            </span>
          }
          size={140}
        />
      )}
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        {pct.toFixed(1)}% от цели{" "}
        <span style={{ opacity: 0.6 }}>
          ({target.toLocaleString("ru-RU")}
          {opts.unit ? ` ${opts.unit}` : ""})
        </span>
      </Typography.Text>
    </div>
  );
}

/* ═══ Table ════════════════════════════════════════════════════════ */

function TableWidget({ data }: { widget: DashboardWidgetRead; data: WidgetDataResponse }) {
  const cols = data.columns ?? [];
  const rows = data.rows ?? [];
  // Convert columns[] + rows[][] to antd Table columns + records
  const columns = cols.map((c) => ({
    title: c.name,
    dataIndex: c.code,
    key: c.code,
    render: (v: unknown) => {
      if (v == null) return <Typography.Text type="secondary">—</Typography.Text>;
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
        return new Date(v).toLocaleString("ru-RU");
      }
      if (typeof v === "number") return v.toLocaleString("ru-RU");
      return String(v);
    },
  }));
  const dataSource = rows.map((row, idx) => {
    const obj: Record<string, unknown> = { key: idx };
    cols.forEach((c, i) => {
      obj[c.code] = row[i];
    });
    return obj;
  });
  return (
    <Table
      size="small"
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      scroll={{ y: "100%" }}
      // Squeeze into widget height — the grid item's padding already
      // accounts for the title bar.
      style={{ height: "100%" }}
    />
  );
}

/* ═══ ApexCharts ═══════════════════════════════════════════════════ */

function ApexWidget({
  widget,
  data,
  token,
}: {
  widget: DashboardWidgetRead;
  data: WidgetDataResponse;
  token: ReturnType<typeof antdTheme.useToken>["token"];
}) {
  const mode = useThemeStore((s) => s.resolved);

  const { options, series, chartType } = buildApex(widget, data, token, mode);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactApexChart
        key={`${widget.id}-${widget.widget_type}`}
        options={options}
        series={series as any}
        type={chartType}
        height="100%"
        width="100%"
      />
    </div>
  );
}

// Chart types that react-apexcharts's ``type`` prop accepts. We drop
// types that the lib doesn't recognize (e.g. funnel — which Apex core
// renders only via custom plotOptions on a bar chart).
type ApexChartType =
  | "line"
  | "bar"
  | "area"
  | "pie"
  | "donut"
  | "radialBar"
  | "scatter"
  | "bubble"
  | "heatmap"
  | "treemap"
  | "radar"
  | "polarArea"
  | "boxPlot"
  | "candlestick"
  | "rangeBar"
  | "rangeArea";

function buildApex(
  widget: DashboardWidgetRead,
  data: WidgetDataResponse,
  token: ReturnType<typeof antdTheme.useToken>["token"],
  mode: "light" | "dark",
): { options: ApexOptions; series: ApexOptions["series"]; chartType: ApexChartType } {
  const categories = data.categories ?? [];
  const series = data.series ?? [];

  const primary = token.colorPrimary;
  // Derive a small palette from the primary (plus a few classic Apex
  // accents) so multi-series charts get distinguishable colors.
  const palette = [primary, "#1677ff", "#52c41a", "#faad14", "#722ed1", "#13c2c2", "#eb2f96", "#8c8c8c"];

  const common: ApexOptions = {
    chart: {
      // Stable per-widget id so external code (e.g. WidgetShell's
      // PNG/SVG export menu) can target this chart via
      // ``ApexCharts.exec(widget.id, "dataURI" | "exportToSVG")``.
      // Apex requires the id to be a string.
      id: widget.id,
      background: "transparent",
      toolbar: { show: false },
      animations: { enabled: true, speed: 280 },
      fontFamily: "inherit",
    },
    theme: { mode, palette: "palette1" },
    colors: palette,
    grid: { borderColor: token.colorBorderSecondary as string },
    tooltip: { theme: mode },
    legend: {
      labels: { colors: token.colorTextSecondary as string },
    },
    dataLabels: { enabled: false },
  };

  const wt = widget.widget_type as WidgetType;

  // Pie-family shows a single "ring" from series[0].data mapped onto
  // categories — Apex expects ``series`` to be a number[] in that case.
  if (wt === "pie" || wt === "donut" || wt === "polarArea") {
    const flat = series[0]?.data ?? [];
    const options: ApexOptions = {
      ...common,
      labels: categories,
      legend: { position: "bottom", labels: { colors: token.colorTextSecondary as string } },
    };
    const overlay = (widget.chart_options ?? {}) as ApexOptions;
    return {
      options: mergeOptions(options, overlay),
      series: flat as any,
      chartType: wt === "polarArea" ? "polarArea" : (wt as "pie" | "donut"),
    };
  }

  if (wt === "radialBar") {
    const flat = series[0]?.data ?? [];
    // radialBar wants 0-100 values; if data is outside, normalize.
    const max = Math.max(100, ...flat);
    const normalized = flat.map((v) => Math.round((v / max) * 100));
    const options: ApexOptions = {
      ...common,
      labels: categories,
      legend: { show: true, position: "bottom", labels: { colors: token.colorTextSecondary as string } },
      plotOptions: {
        radialBar: {
          dataLabels: {
            name: { show: true, color: token.colorText as string },
            value: { show: true, color: token.colorText as string,
              formatter: (val) => `${val}%` },
          },
        },
      },
    };
    return {
      options: mergeOptions(options, (widget.chart_options ?? {}) as ApexOptions),
      series: normalized as any,
      chartType: "radialBar",
    };
  }

  if (wt === "bar" || wt === "barHorizontal") {
    const horizontal = wt === "barHorizontal";
    // ``stacked: true`` via chart_options.chart.stacked gives stacked bars;
    // ``stackType: "100%"`` gives 100% stacked. Users enable it from the
    // settings drawer (Stacked checkbox).
    const overlayOpts = (widget.chart_options ?? {}) as ApexOptions;
    const stacked = (overlayOpts.chart as any)?.stacked === true;
    const options: ApexOptions = {
      ...common,
      chart: { ...common.chart, stacked },
      xaxis: {
        categories,
        labels: { style: { colors: token.colorTextSecondary as string } },
      },
      yaxis: {
        labels: { style: { colors: token.colorTextSecondary as string } },
      },
      plotOptions: { bar: { borderRadius: stacked ? 0 : 4, horizontal } },
    };
    return {
      options: mergeOptions(options, overlayOpts),
      series: series as any,
      chartType: "bar",
    };
  }

  if (wt === "rangeArea") {
    // Two-line band. Users must feed the source a series with ``y:[min,max]``
    // pairs via chart_options override — the built-in sources don't yet
    // do this; it's mainly for advanced users.
    const options: ApexOptions = {
      ...common,
      xaxis: { categories, labels: { style: { colors: token.colorTextSecondary as string } } },
      stroke: { curve: "straight", width: [0, 2] },
      fill: { opacity: [0.3, 1] },
    };
    return {
      options: mergeOptions(options, (widget.chart_options ?? {}) as ApexOptions),
      series: series as any,
      chartType: "rangeArea",
    };
  }

  if (wt === "mixed") {
    // Combo chart: we render it as ``line`` with per-series type
    // overrides (``type: "column"`` on some, ``type: "line"`` on others).
    // Default behaviour when the source returns 2 series: first as
    // column, rest as line. User can override via chart_options.
    const merged = series.map((s, i) => ({
      name: s.name,
      type: i === 0 ? "column" : "line",
      data: s.data,
    }));
    const options: ApexOptions = {
      ...common,
      xaxis: { categories, labels: { style: { colors: token.colorTextSecondary as string } } },
      yaxis: { labels: { style: { colors: token.colorTextSecondary as string } } },
      stroke: { width: [0, 3] },
    };
    return {
      options: mergeOptions(options, (widget.chart_options ?? {}) as ApexOptions),
      series: merged as any,
      chartType: "line",
    };
  }

  if (wt === "funnel") {
    // Funnel = bar with plotOptions.bar.isFunnel = true. Single-series,
    // values should already be sorted by the source (top→bottom).
    const options: ApexOptions = {
      ...common,
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: "80%",
          isFunnel: true,
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (val, opt: any) =>
          `${categories[opt.dataPointIndex] ?? ""}: ${val}`,
        style: { colors: ["#fff"], fontWeight: 500 },
      },
      xaxis: { categories },
      legend: { show: false },
    };
    return {
      options: mergeOptions(options, (widget.chart_options ?? {}) as ApexOptions),
      series: series as any,
      chartType: "bar",
    };
  }

  if (wt === "bubble") {
    // Bubble: [{x, y, z}]. We project category index → x, values → y,
    // value/max*50 → z so sizes stay in a sensible range.
    const flat = series[0]?.data ?? [];
    const max = Math.max(1, ...flat);
    const projected = flat.map((y, i) => ({
      x: categories[i] ?? i,
      y,
      z: Math.max(6, Math.round((y / max) * 40)),
    }));
    const options: ApexOptions = {
      ...common,
      xaxis: { categories, labels: { style: { colors: token.colorTextSecondary as string } } },
      yaxis: { labels: { style: { colors: token.colorTextSecondary as string } } },
      fill: { opacity: 0.7 },
    };
    return {
      options: mergeOptions(options, (widget.chart_options ?? {}) as ApexOptions),
      series: [{ name: series[0]?.name ?? "—", data: projected }] as any,
      chartType: "bubble",
    };
  }

  if (wt === "line" || wt === "area") {
    const options: ApexOptions = {
      ...common,
      stroke: { curve: "smooth", width: wt === "line" ? 3 : 2 },
      xaxis: {
        categories,
        labels: { style: { colors: token.colorTextSecondary as string } },
      },
      yaxis: {
        labels: { style: { colors: token.colorTextSecondary as string } },
      },
      fill: wt === "area"
        ? { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.1 } }
        : { type: "solid" },
    };
    return {
      options: mergeOptions(options, (widget.chart_options ?? {}) as ApexOptions),
      series: series as any,
      chartType: wt as "line" | "area",
    };
  }

  if (wt === "sparkline") {
    // Compact trendline — no axes, no grid, no legend. Packs well next
    // to a Stat widget (user puts two side-by-side). We also strip the
    // margins so it fills the card.
    const options: ApexOptions = {
      ...common,
      chart: {
        ...common.chart,
        sparkline: { enabled: true },
      },
      stroke: { curve: "smooth", width: 2 },
      tooltip: { theme: mode, fixed: { enabled: false } },
      fill: {
        type: "gradient",
        gradient: { shadeIntensity: 0.6, opacityFrom: 0.4, opacityTo: 0.05 },
      },
      legend: { show: false },
    };
    return {
      options: mergeOptions(options, (widget.chart_options ?? {}) as ApexOptions),
      series: series as any,
      chartType: "area",
    };
  }

  if (wt === "scatter") {
    // Scatter expects [{x, y}, …] per series. Our categorical sources
    // give ``categories + data[]`` — project categories to numeric x
    // (index) and use data values for y.
    const projected = series.map((s) => ({
      name: s.name,
      data: (s.data ?? []).map((y, i) => ({ x: categories[i] ?? i, y })),
    }));
    const options: ApexOptions = {
      ...common,
      xaxis: { categories, labels: { style: { colors: token.colorTextSecondary as string } } },
      yaxis: { labels: { style: { colors: token.colorTextSecondary as string } } },
    };
    return {
      options: mergeOptions(options, (widget.chart_options ?? {}) as ApexOptions),
      series: projected as any,
      chartType: "scatter",
    };
  }

  if (wt === "heatmap") {
    // Heatmap: one row per series, data[] is per-category cell values.
    const options: ApexOptions = {
      ...common,
      xaxis: { categories, labels: { style: { colors: token.colorTextSecondary as string } } },
      dataLabels: { enabled: false },
      plotOptions: {
        heatmap: {
          shadeIntensity: 0.5,
          colorScale: {
            ranges: [
              { from: 0, to: 0, name: "0", color: token.colorFillSecondary as string },
            ],
          },
        },
      },
    };
    return {
      options: mergeOptions(options, (widget.chart_options ?? {}) as ApexOptions),
      series: series as any,
      chartType: "heatmap",
    };
  }

  if (wt === "treemap") {
    // Treemap: single series with {x: label, y: value} pairs. We
    // fold categories + first series into that shape.
    const flat = (series[0]?.data ?? []).map((y, i) => ({
      x: categories[i] ?? String(i),
      y,
    }));
    const options: ApexOptions = {
      ...common,
      legend: { show: false },
      dataLabels: { enabled: true, style: { colors: ["#fff"] } },
    };
    return {
      options: mergeOptions(options, (widget.chart_options ?? {}) as ApexOptions),
      series: [{ data: flat }] as any,
      chartType: "treemap",
    };
  }

  if (wt === "radar") {
    const options: ApexOptions = {
      ...common,
      xaxis: {
        categories,
        labels: { style: { colors: Array(categories.length).fill(token.colorTextSecondary) } },
      },
      stroke: { width: 2 },
      fill: { opacity: 0.3 },
      markers: { size: 3 },
    };
    return {
      options: mergeOptions(options, (widget.chart_options ?? {}) as ApexOptions),
      series: series as any,
      chartType: "radar",
    };
  }

  if (wt === "boxplot") {
    // Boxplot needs [{x, y: [min, q1, median, q3, max]}] per item.
    // Our ``runs.duration_distribution`` source already produces this.
    const options: ApexOptions = {
      ...common,
      xaxis: { categories, labels: { style: { colors: token.colorTextSecondary as string } } },
      yaxis: { labels: { style: { colors: token.colorTextSecondary as string } } },
    };
    return {
      options: mergeOptions(options, (widget.chart_options ?? {}) as ApexOptions),
      series: series as any,
      chartType: "boxPlot",
    };
  }

  if (wt === "candlestick") {
    const options: ApexOptions = {
      ...common,
      xaxis: { categories, labels: { style: { colors: token.colorTextSecondary as string } } },
      yaxis: { labels: { style: { colors: token.colorTextSecondary as string } } },
    };
    return {
      options: mergeOptions(options, (widget.chart_options ?? {}) as ApexOptions),
      series: series as any,
      chartType: "candlestick",
    };
  }

  if (wt === "rangeBar") {
    const options: ApexOptions = {
      ...common,
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "70%" } },
      xaxis: { categories, labels: { style: { colors: token.colorTextSecondary as string } } },
      yaxis: { labels: { style: { colors: token.colorTextSecondary as string } } },
    };
    return {
      options: mergeOptions(options, (widget.chart_options ?? {}) as ApexOptions),
      series: series as any,
      chartType: "rangeBar",
    };
  }

  // Fallback — unknown type, treat as line.
  return {
    options: {
      ...common,
      xaxis: { categories },
    },
    series: series as any,
    chartType: "line",
  };
}

function mergeOptions(base: ApexOptions, overlay: ApexOptions): ApexOptions {
  // Shallow merge per top-level Apex section. Deep merge would be nice
  // but Apex has quirky nested objects; stick with shallow for now.
  const merged: ApexOptions = { ...base };
  for (const k of Object.keys(overlay) as (keyof ApexOptions)[]) {
    const baseV = (base as any)[k];
    const overlayV = (overlay as any)[k];
    if (
      baseV && overlayV &&
      typeof baseV === "object" && !Array.isArray(baseV) &&
      typeof overlayV === "object" && !Array.isArray(overlayV)
    ) {
      (merged as any)[k] = { ...baseV, ...overlayV };
    } else {
      (merged as any)[k] = overlayV;
    }
  }
  return merged;
}
