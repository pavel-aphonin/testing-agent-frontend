import {
  DeleteOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Dropdown,
  Popconfirm,
  Space,
  Tag,
  theme as antdTheme,
  Tooltip,
  Typography,
} from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getWidgetData } from "@/api/dashboards";
import { WidgetHelp } from "@/components/dashboard/WidgetHelp";
import { WidgetRenderer } from "@/components/dashboard/WidgetRenderer";
import type { DashboardWidgetRead, WidgetDataResponse } from "@/types";
import { notify } from "@/utils/notify";

/**
 * Frame + chrome around a widget on the dashboard grid:
 *   - Title bar with settings / help / delete / refresh / export controls
 *   - Loads data via react-query keyed by widget id
 *   - Respects ``chart_options._refresh_seconds`` for per-widget auto-refresh
 *   - Respects ``chart_options._drilldown_url`` — clicking the body navigates
 *   - Delegates drawing to WidgetRenderer
 *
 * The grid (react-grid-layout) provides position/resize/drag. We add
 * ``cancel="[data-no-drag]"`` selectors to the grid so clicks on
 * controls don't start dragging the widget.
 */
interface Props {
  widget: DashboardWidgetRead;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => Promise<void> | void;
}

// Widget types that don't render an ApexCharts chart and therefore
// can't produce a PNG/SVG via ``ApexCharts.exec(id, "dataURI")``.
// Keep in sync with the renderer dispatch in WidgetRenderer.tsx.
const APEX_EXPORT_BLACKLIST = new Set<string>([
  "stat", "progress", "table", "custom",
]);

export function WidgetShell({ widget, canEdit, onEdit, onDelete }: Props) {
  const { token } = antdTheme.useToken();
  const [helpOpen, setHelpOpen] = useState(false);
  const nav = useNavigate();

  // Extract our own underscore-prefixed extensions from chart_options.
  const opts = (widget.chart_options ?? {}) as {
    _refresh_seconds?: number;
    _drilldown_url?: string;
  };
  const refreshInterval = opts._refresh_seconds && opts._refresh_seconds >= 10
    ? opts._refresh_seconds * 1000
    : undefined;
  const drilldownUrl = opts._drilldown_url?.trim() || undefined;

  const dataQ = useQuery({
    queryKey: ["widget-data", widget.id, widget.datasource_code, widget.datasource_params],
    queryFn: () => getWidgetData(widget.id),
    staleTime: 60_000,
    // Only refetch in the background when the user has opted in. The
    // backend can be sluggish on heavy aggregates; default stays manual.
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: false,
  });

  const onDrilldown = () => {
    if (!drilldownUrl) return;
    // Expand {category}/{series}/{value} placeholders with the first
    // data point. This gives a sensible "click the widget to dive in"
    // flow without needing per-type click handlers everywhere.
    const d = dataQ.data;
    let url = drilldownUrl;
    const cat = d?.categories?.[0] ?? "";
    const series = d?.series?.[0]?.name ?? "";
    const val = d?.series?.[0]?.data?.[0];
    url = url
      .replace(/\{category\}/g, encodeURIComponent(String(cat)))
      .replace(/\{series\}/g, encodeURIComponent(String(series)))
      .replace(/\{value\}/g, encodeURIComponent(String(val ?? "")));
    if (/^https?:\/\//.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      nav(url);
    }
  };

  // Memoize export handlers — they touch dataQ.data which changes on refresh.
  const exportMenu = useMemo(() => {
    const safeName = (widget.title || "widget").replace(/[^\w\-Ѐ-ӿ]+/g, "_");
    const handleData = (fmt: "csv" | "json") => () => {
      const d = dataQ.data;
      if (!d) return;
      try {
        const blob = fmt === "csv" ? toCsvBlob(d) : toJsonBlob(d);
        downloadBlob(blob, `${safeName}.${fmt}`);
      } catch (err: any) {
        notify.error(err?.message ?? "Не удалось выгрузить");
      }
    };

    // PNG / SVG only make sense for ApexCharts-rendered widgets. The
    // native renderers (stat / progress / table) and the iframe-based
    // ``custom`` widget don't have an Apex chart instance to call
    // dataURI()/exportToSVG() on.
    const isApex = !APEX_EXPORT_BLACKLIST.has(widget.widget_type);

    const handleImage = (fmt: "png" | "svg") => async () => {
      try {
        // ``ApexCharts`` is exposed globally by react-apexcharts. We
        // grab it from window to avoid pulling apexcharts as a direct
        // dep here. ``exec`` returns a Promise resolving to the
        // requested artefact for "dataURI" / "exportToSVG".
        const Apex = (window as any).ApexCharts;
        if (!Apex || !Apex.exec) {
          notify.error("ApexCharts недоступен");
          return;
        }
        if (fmt === "png") {
          const result = await Apex.exec(widget.id, "dataURI");
          const dataURI: string | undefined = result?.imgURI;
          if (!dataURI) {
            notify.error("Пустой результат экспорта");
            return;
          }
          const blob = dataURIToBlob(dataURI);
          downloadBlob(blob, `${safeName}.png`);
        } else {
          const svg: string = await Apex.exec(widget.id, "exportToSVG");
          if (!svg) {
            notify.error("Пустой результат экспорта");
            return;
          }
          downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${safeName}.svg`);
        }
      } catch (err: any) {
        notify.error(err?.message ?? "Не удалось выгрузить картинку");
      }
    };

    const items: { key: string; label: string; onClick: () => void }[] = [];
    if (isApex) {
      items.push({ key: "png", label: "Скачать PNG",       onClick: handleImage("png") });
      items.push({ key: "svg", label: "Скачать SVG",       onClick: handleImage("svg") });
    }
    items.push({ key: "csv",   label: "Скачать как CSV",   onClick: handleData("csv") });
    items.push({ key: "json",  label: "Скачать как JSON",  onClick: handleData("json") });
    return items;
  }, [dataQ.data, widget.title, widget.id, widget.widget_type]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Title bar — drag handle for the grid (no data-no-drag here). */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          cursor: canEdit ? "grab" : "default",
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        <Typography.Text
          strong
          ellipsis
          style={{ flex: 1, fontSize: 13 }}
        >
          {widget.title}
        </Typography.Text>
        {refreshInterval && (
          <Tooltip title={`Автообновление каждые ${opts._refresh_seconds} сек`}>
            <Tag color="processing" style={{ fontSize: 10, margin: 0 }}>
              live
            </Tag>
          </Tooltip>
        )}
        <Space size={0} data-no-drag="1">
          <Tooltip title="Обновить сейчас">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined spin={dataQ.isFetching} />}
              onClick={() => dataQ.refetch()}
            />
          </Tooltip>
          <Dropdown menu={{ items: exportMenu }} trigger={["click"]}>
            <Tooltip title="Экспорт">
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
              />
            </Tooltip>
          </Dropdown>
          <Tooltip title="Справка по виджету">
            <Button
              type="text"
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => setHelpOpen(true)}
            />
          </Tooltip>
          {canEdit && (
            <>
              <Tooltip title="Настройки виджета">
                <Button
                  type="text"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={onEdit}
                />
              </Tooltip>
              <Popconfirm
                title="Удалить виджет?"
                onConfirm={() => onDelete()}
                okText="Удалить"
                cancelText="Отмена"
                okButtonProps={{ danger: true }}
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      </div>

      {/* Widget body — flex:1 so Apex fills the rest of the card. */}
      <div
        data-no-drag="1"
        onClick={drilldownUrl ? onDrilldown : undefined}
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          padding: widget.widget_type === "table" ? 0 : 8,
          overflow: widget.widget_type === "table" ? "auto" : "hidden",
          cursor: drilldownUrl ? "pointer" : "default",
        }}
        title={drilldownUrl ? "Клик — перейти к деталям" : undefined}
      >
        <WidgetRenderer
          widget={widget}
          data={dataQ.data}
          loading={dataQ.isLoading}
        />
      </div>

      <WidgetHelp widget={widget} open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

/* ═══ Export helpers ═════════════════════════════════════════════════
 * Keep CSV close to what Excel expects: BOM + CRLF + quote escaping.
 * JSON is the raw WidgetDataResponse (minus internal ``error`` key).
 * Images come from ApexCharts via globalApex.exec() — handler above
 * receives a base64 data URI for PNG and a raw SVG string for SVG.
 * ──────────────────────────────────────────────────────────────── */

function escapeCsv(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  // Quote if there's a comma, quote, or newline. Double internal quotes.
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsvBlob(d: WidgetDataResponse): Blob {
  const lines: string[] = [];

  if (d.is_tabular) {
    const cols = d.columns ?? [];
    lines.push(cols.map((c) => escapeCsv(c.name)).join(","));
    for (const row of d.rows ?? []) {
      lines.push(row.map(escapeCsv).join(","));
    }
  } else {
    const cats = d.categories ?? [];
    const series = d.series ?? [];
    // Categorical / timeseries: first column is the category axis,
    // each series becomes its own column. Matches what users expect
    // to paste into Excel.
    lines.push(["category", ...series.map((s) => escapeCsv(s.name))].join(","));
    const maxLen = Math.max(cats.length, ...series.map((s) => s.data.length));
    for (let i = 0; i < maxLen; i++) {
      const cat = cats[i] ?? "";
      const row = [escapeCsv(cat), ...series.map((s) => escapeCsv(s.data[i]))];
      lines.push(row.join(","));
    }
  }

  // ﻿ (UTF-8 BOM) so Excel opens Cyrillic correctly.
  return new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
}

function toJsonBlob(d: WidgetDataResponse): Blob {
  const clean: Partial<WidgetDataResponse> = { ...d };
  delete clean.error;
  return new Blob([JSON.stringify(clean, null, 2)], { type: "application/json" });
}

// Convert a base64 ``data:image/png;base64,...`` URI into a Blob so we
// can hand it to downloadBlob. ApexCharts.dataURI() returns this shape;
// fetch+blob is cheaper and avoids issues with large images parsed via
// atob in older browsers.
function dataURIToBlob(uri: string): Blob {
  const [header, body = ""] = uri.split(",");
  const mime = /:([^;]+);/.exec(header)?.[1] ?? "application/octet-stream";
  const isBase64 = /;base64/i.test(header);
  if (!isBase64) {
    return new Blob([decodeURIComponent(body)], { type: mime });
  }
  const bin = atob(body);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
