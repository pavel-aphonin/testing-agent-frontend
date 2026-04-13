import { ArrowLeftOutlined, DownloadOutlined, FilterOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { getRunResults } from "@/api/runs";
import { StateGraph } from "@/components/graph/StateGraph";
import type { RunEdgeSummary, RunScreenSummary, RunStatus } from "@/types";

const STATUS_COLOR: Record<RunStatus, string> = {
  pending: "default",
  running: "processing",
  completed: "success",
  failed: "error",
  cancelled: "warning",
};

/** Format date respecting locale — DD.MM.YYYY HH:MM:SS for Russian */
function formatDate(iso: string | null, lang?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (lang === "ru") {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const time = d.toLocaleTimeString("ru-RU", { hour12: false });
    return `${day}.${month}.${year} ${time}`;
  }
  return d.toLocaleString();
}

/** Format duration between two dates */
function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  if (min < 1) return `${sec} сек`;
  return `${min} мин ${sec % 60} сек`;
}

/** Human-readable mode name */
function modeName(mode: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    hybrid: t("newRunModal.modes.hybrid"),
    mc: t("newRunModal.modes.mc"),
    ai: t("newRunModal.modes.ai"),
  };
  return map[mode] || mode;
}

/** Build screen name lookup from hash */
function buildScreenNameMap(screens: RunScreenSummary[]): Map<string, string> {
  const map = new Map<string, string>();
  screens.forEach((s) => map.set(s.screen_id_hash, s.name || s.screen_id_hash.slice(0, 8)));
  return map;
}

/** Describe an action in human-readable form */
function describeAction(edge: RunEdgeSummary): string {
  const details = edge.action_details_json as Record<string, string> | null;
  if (!details) return edge.action_type;

  const label = (details.target_label || details.target_test_id || "") as string;
  const text = details.input_text as string | undefined;
  const category = details.input_category as string | undefined;

  if (edge.action_type === "input") {
    if (text) {
      const truncated = text.length > 40 ? text.slice(0, 37) + "…" : text;
      return `Ввод "${truncated}"${label ? ` в ${label}` : ""}${category ? ` [${category}]` : ""}`;
    }
    return `Ввод в ${label || "поле"}`;
  }
  if (edge.action_type === "tap") {
    return `Нажатие на "${label || "элемент"}"`;
  }
  if (edge.action_type === "swipe") {
    return `Свайп ${label || ""}`;
  }
  return `${edge.action_type} ${label}`;
}

/** Build a small Mermaid flowchart from the discovered edges. */
function buildMermaid(
  screens: RunScreenSummary[],
  edges: RunEdgeSummary[],
): string {
  const idFor = new Map<string, string>();
  screens.forEach((s, i) => idFor.set(s.screen_id_hash, `S${i}`));
  const lines: string[] = ["flowchart LR"];
  screens.forEach((s) => {
    const sid = idFor.get(s.screen_id_hash) ?? "?";
    const safeName = (s.name || s.screen_id_hash.slice(0, 8)).replace(/[^\w\s.-]/g, "");
    lines.push(`  ${sid}["${safeName}"]`);
  });
  edges.forEach((e) => {
    const a = idFor.get(e.source_screen_hash);
    const b = idFor.get(e.target_screen_hash);
    if (!a || !b) return;
    const ok = e.success ? "" : ":::failed";
    lines.push(`  ${a} -- ${e.action_type} --> ${b}${ok}`);
  });
  lines.push("  classDef failed stroke:#cf1322,color:#cf1322;");
  return lines.join("\n");
}

export function RunResults() {
  const { t, i18n } = useTranslation();
  const { id: runId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [edgeFilter, setEdgeFilter] = useState<"all" | "success" | "failed">("all");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["run-results", runId],
    queryFn: () => getRunResults(runId!),
    enabled: !!runId,
  });

  const mermaid = useMemo(() => {
    if (!data) return "";
    return buildMermaid(data.screens, data.edges);
  }, [data]);

  const screenNames = useMemo(() => {
    if (!data) return new Map<string, string>();
    return buildScreenNameMap(data.screens);
  }, [data]);

  if (!runId) return <Alert type="error" message={t("common.error")} />;
  if (isLoading) return <Card loading />;
  if (isError || !data) {
    return (
      <Alert
        type="error"
        message={t("runResults.loadFailed")}
        description={(error as Error)?.message}
      />
    );
  }

  const { run, screens, edges } = data;
  const successfulEdges = edges.filter((e) => e.success).length;
  const failedEdges = edges.length - successfulEdges;
  const lang = i18n.language;

  // Filter edges based on selected filter
  const filteredEdges =
    edgeFilter === "all" ? edges :
    edgeFilter === "success" ? edges.filter((e) => e.success) :
    edges.filter((e) => !e.success);

  // Device display: hide __PENDING__, show device_type if available
  const deviceDisplay = run.device_type
    ? run.device_type.replace(/com\.apple\.CoreSimulator\.SimDeviceType\./, "").replace(/-/g, " ")
    : run.device_id === "__PENDING__" ? "—" : run.device_id;

  const screenColumns: ColumnsType<RunScreenSummary> = [
    { title: "#", key: "idx", width: 50, render: (_, __, i) => i + 1 },
    { title: t("runResults.screenColumns.name"), dataIndex: "name", key: "name" },
    { title: t("runResults.screenColumns.visits"), dataIndex: "visit_count", key: "visits", width: 100 },
    {
      title: t("runResults.screenColumns.firstSeen"),
      dataIndex: "first_seen_at",
      key: "first_seen_at",
      width: 200,
      render: (iso: string) => formatDate(iso, lang),
    },
  ];

  const edgeColumns: ColumnsType<RunEdgeSummary> = [
    { title: t("runResults.edgeColumns.step"), dataIndex: "step_idx", key: "step", width: 60 },
    {
      title: t("runResults.edgeColumns.action"),
      key: "action_desc",
      render: (_, edge) => (
        <Tooltip title={JSON.stringify(edge.action_details_json, null, 2)} placement="left">
          <span style={{ fontSize: 12 }}>{describeAction(edge)}</span>
        </Tooltip>
      ),
    },
    {
      title: t("runResults.edgeColumns.source"),
      dataIndex: "source_screen_hash",
      key: "src",
      width: 140,
      render: (h: string) => (
        <Tag>{screenNames.get(h) || h.slice(0, 8)}</Tag>
      ),
    },
    {
      title: t("runResults.edgeColumns.target"),
      dataIndex: "target_screen_hash",
      key: "tgt",
      width: 140,
      render: (h: string) => (
        <Tag>{screenNames.get(h) || h.slice(0, 8)}</Tag>
      ),
    },
    {
      title: t("runResults.edgeColumns.ok"),
      dataIndex: "success",
      key: "ok",
      width: 60,
      render: (b: boolean) =>
        b ? <Tag color="green">{t("runResults.tag.ok")}</Tag> : <Tag color="red">{t("runResults.tag.fail")}</Tag>,
    },
  ];

  const downloadMermaid = () => {
    const blob = new Blob([mermaid], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `run-${runId}.mermaid`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/runs")}>
          {t("common.back")}
        </Button>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("runResults.title")}
        </Typography.Title>
        <Tag color={STATUS_COLOR[run.status as RunStatus]}>{t(`runStatus.${run.status as RunStatus}`)}</Tag>
      </Space>

      {/* Run info — human-readable, Russian labels */}
      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label={t("runProgress.bundle")}>{run.bundle_id}</Descriptions.Item>
          <Descriptions.Item label={t("runProgress.mode")}>{modeName(run.mode, t)}</Descriptions.Item>
          <Descriptions.Item label={t("adminDevices.deviceType")}>{deviceDisplay}</Descriptions.Item>
          <Descriptions.Item label={t("runProgress.started")}>
            {formatDate(run.started_at, lang)}
          </Descriptions.Item>
          <Descriptions.Item label={t("runs.columns.duration")}>
            {formatDuration(run.started_at, run.finished_at)}
          </Descriptions.Item>
          <Descriptions.Item label={t("newRunModal.maxSteps")}>{run.max_steps}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Stats — clickable filters */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card hoverable onClick={() => setEdgeFilter("all")} style={edgeFilter === "all" ? { borderColor: "#1677ff" } : {}}>
            <Statistic title={t("runResults.screensDiscovered")} value={screens.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={() => setEdgeFilter("all")} style={edgeFilter === "all" ? { borderColor: "#1677ff" } : {}}>
            <Statistic title={t("runResults.totalEdges")} value={edges.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={() => setEdgeFilter("success")} style={edgeFilter === "success" ? { borderColor: "#52c41a" } : {}}>
            <Statistic title={t("runResults.successful")} value={successfulEdges} valueStyle={edgeFilter === "success" ? { color: "#52c41a" } : undefined} />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={() => setEdgeFilter("failed")} style={edgeFilter === "failed" ? { borderColor: "#cf1322" } : {}}>
            <Statistic
              title={t("runResults.failed")}
              value={failedEdges}
              valueStyle={{ color: failedEdges > 0 ? "#cf1322" : undefined }}
            />
          </Card>
        </Col>
      </Row>

      {edgeFilter !== "all" && (
        <Alert
          type="info"
          showIcon
          icon={<FilterOutlined />}
          style={{ marginBottom: 16 }}
          message={
            edgeFilter === "success"
              ? `Показаны только успешные переходы (${successfulEdges})`
              : `Показаны только неуспешные переходы (${failedEdges})`
          }
          action={
            <Button size="small" onClick={() => setEdgeFilter("all")}>
              Показать все
            </Button>
          }
        />
      )}

      <Card
        title={t("runResults.stateGraph")}
        size="small"
        style={{ marginBottom: 16 }}
        extra={
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={downloadMermaid}
            disabled={!mermaid}
          >
            {t("runResults.downloadMermaid")}
          </Button>
        }
        styles={{ body: { padding: 0 } }}
      >
        <StateGraph screens={screens} edges={edges} height={520} runId={runId} />
      </Card>

      <Row gutter={16}>
        <Col span={10}>
          <Card title={`${t("runResults.screens")} (${screens.length})`} size="small">
            <Table<RunScreenSummary>
              rowKey="id"
              columns={screenColumns}
              dataSource={screens}
              pagination={{ pageSize: 10 }}
              size="small"
              scroll={{ x: "max-content" }}
            />
          </Card>
        </Col>
        <Col span={14}>
          <Card
            title={`${t("runResults.edgesTab")} (${filteredEdges.length}${edgeFilter !== "all" ? ` / ${edges.length}` : ""})`}
            size="small"
          >
            <Table<RunEdgeSummary>
              rowKey="id"
              columns={edgeColumns}
              dataSource={filteredEdges}
              pagination={{ pageSize: 10 }}
              size="small"
              scroll={{ x: "max-content" }}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
