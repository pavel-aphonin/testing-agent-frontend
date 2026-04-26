import { Card, Empty, Image, Space, Tag, Typography } from "antd";

import type { RunEdgeSummary } from "@/types";

/**
 * Per-step timeline for /runs/{id}/results (PER-25). Each row is one
 * edge: before screenshot → action description → after screenshot.
 *
 * Both screenshots are loaded via /api/runs/{run_id}/edges/{id}/screenshot
 * with side=before|after; the AntD <Image> wrapper handles lazy load
 * and a click-to-zoom modal. When an edge has neither screenshot we
 * fall back to a compact text-only row so MC-mode runs (which don't
 * capture before/after) still get a usable view.
 */
interface Props {
  runId: string;
  edges: RunEdgeSummary[];
}

export function RunTimeline({ runId, edges }: Props) {
  if (!edges.length) {
    return <Empty description="Нет шагов" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }
  // Sort by step_idx ascending so the timeline reads top-down.
  const sorted = [...edges].sort((a, b) => a.step_idx - b.step_idx);
  return (
    <Space direction="vertical" size="small" style={{ width: "100%" }}>
      {sorted.map((e) => (
        <TimelineStep key={e.id} runId={runId} edge={e} />
      ))}
    </Space>
  );
}

function TimelineStep({ runId, edge }: { runId: string; edge: RunEdgeSummary }) {
  const detail = (edge.action_details_json ?? {}) as Record<string, unknown>;
  const element = (detail.element as string | undefined) ?? "";
  const value = (detail.value as string | undefined) ?? "";
  const before = edge.screenshot_before_path
    ? `/api/runs/${runId}/edges/${edge.id}/screenshot?side=before`
    : null;
  const after = edge.screenshot_after_path
    ? `/api/runs/${runId}/edges/${edge.id}/screenshot?side=after`
    : null;

  const description = humanizeAction(edge.action_type, element, value);

  return (
    <Card size="small" bodyStyle={{ padding: 12 }}>
      <Space align="start" size="middle" style={{ width: "100%" }} wrap>
        {/* Step badge — fixed-width column so the text aligns. */}
        <div style={{ minWidth: 56, textAlign: "center" }}>
          <Typography.Text strong style={{ fontSize: 18 }}>
            #{edge.step_idx}
          </Typography.Text>
          <div>
            <Tag color={edge.success ? "green" : "red"} style={{ margin: 0 }}>
              {edge.success ? "ok" : "fail"}
            </Tag>
          </div>
        </div>
        {/* Before screenshot */}
        <ScreenshotCell src={before} alt={`step ${edge.step_idx} before`} label="до" />
        {/* Description column */}
        <div style={{ flex: 1, minWidth: 220 }}>
          <Typography.Text strong>{description}</Typography.Text>
          {value && (
            <div style={{ fontSize: 12, color: "#8c8c8c" }}>
              значение: <Typography.Text code>{value}</Typography.Text>
            </div>
          )}
          {edge.llm_reasoning && (
            <Typography.Paragraph
              type="secondary"
              style={{ fontSize: 12, marginTop: 6, marginBottom: 0, fontStyle: "italic" }}
            >
              «{edge.llm_reasoning}»
            </Typography.Paragraph>
          )}
        </div>
        {/* After screenshot */}
        <ScreenshotCell src={after} alt={`step ${edge.step_idx} after`} label="после" />
      </Space>
    </Card>
  );
}

function ScreenshotCell({
  src, alt, label,
}: { src: string | null; alt: string; label: string }) {
  return (
    <div style={{ width: 120, textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#8c8c8c", marginBottom: 2 }}>{label}</div>
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={120}
          height={200}
          style={{ objectFit: "cover", borderRadius: 4 }}
          preview
          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg=="
        />
      ) : (
        <div
          style={{
            width: 120, height: 200,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px dashed #d9d9d9", borderRadius: 4,
            color: "#bfbfbf", fontSize: 11,
          }}
        >
          нет
        </div>
      )}
    </div>
  );
}

function humanizeAction(
  actionType: string,
  element: string,
  value: string,
): string {
  const normalized = actionType.toLowerCase();
  if (normalized.includes("input") || normalized.includes("type")) {
    return element ? `Ввод в «${element}»` : "Ввод текста";
  }
  if (normalized.includes("swipe")) return "Свайп";
  if (normalized.includes("back")) return "Назад";
  if (normalized.includes("tap")) {
    return element ? `Тап по «${element}»` : "Тап";
  }
  return value
    ? `${actionType} → «${element || value}»`
    : element
    ? `${actionType} → «${element}»`
    : actionType;
}
