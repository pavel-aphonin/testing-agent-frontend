import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Card,
  Collapse,
  Empty,
  Radio,
  Space,
  Spin,
  Tag,
  theme as antdTheme,
  Typography,
} from "antd";
import { useState } from "react";

import { listRunDefects, type DefectRead } from "@/api/defects";

const PRIORITY_COLORS: Record<string, string> = {
  P0: "red",
  P1: "volcano",
  P2: "orange",
  P3: "gold",
};

const KIND_LABELS: Record<string, string> = {
  functional: "Функционал",
  ui: "UI",
  validation: "Валидация",
  navigation: "Навигация",
  performance: "Производительность",
  crash: "Крэш",
  spec_mismatch: "Несоответствие спеке",
  infra_noise: "Инфра-шум",
};

const PRIORITY_DESCRIPTION: Record<string, string> = {
  P0: "Блокер",
  P1: "Критический",
  P2: "Существенный",
  P3: "Незначительный",
};

interface Props {
  runId: string;
}

/**
 * Defects panel for the run results page. Shows agent-detected issues
 * ranked by priority (P0 first) with filters. Designed for the triage
 * workflow where QA scans the top P0/P1 first and ignores the rest.
 */
export function DefectsPanel({ runId }: Props) {
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ["run-defects", runId, priorityFilter],
    queryFn: () => listRunDefects(runId, { priority: priorityFilter }),
    refetchInterval: 5000, // poll while run is active
  });

  const counts = (data ?? []).reduce(
    (acc, d) => {
      acc[d.priority] = (acc[d.priority] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  if (isLoading && !data) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Radio.Group
          value={priorityFilter ?? "all"}
          onChange={(e) =>
            setPriorityFilter(e.target.value === "all" ? undefined : e.target.value)
          }
          optionType="button"
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value="all">
            Все ({(data ?? []).length})
          </Radio.Button>
          {["P0", "P1", "P2", "P3"].map((p) => (
            <Radio.Button key={p} value={p} disabled={!counts[p]}>
              <Badge
                count={counts[p] ?? 0}
                color={PRIORITY_COLORS[p]}
                size="small"
                offset={[8, -4]}
              >
                {p}
              </Badge>
            </Radio.Button>
          ))}
        </Radio.Group>
      </div>

      {(data ?? []).length === 0 ? (
        <Empty description="Дефекты не обнаружены" />
      ) : (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {(data ?? []).map((d) => (
            <DefectCard key={d.id} defect={d} />
          ))}
        </Space>
      )}
    </div>
  );
}

function DefectCard({ defect }: { defect: DefectRead }) {
  const { token } = antdTheme.useToken();
  const llm = defect.llm_analysis_json;
  const hasLlm = llm && typeof llm === "object" && Object.keys(llm).length > 0;

  return (
    <Card
      size="small"
      title={
        <Space wrap>
          <Tag color={PRIORITY_COLORS[defect.priority]} style={{ margin: 0 }}>
            {defect.priority} · {PRIORITY_DESCRIPTION[defect.priority]}
          </Tag>
          <Tag style={{ margin: 0 }}>{KIND_LABELS[defect.kind] ?? defect.kind}</Tag>
          {defect.screen_name && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Экран: {defect.screen_name}
            </Typography.Text>
          )}
          {defect.step_idx != null && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Шаг #{defect.step_idx}
            </Typography.Text>
          )}
        </Space>
      }
    >
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        {defect.title}
      </Typography.Title>
      <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
        {defect.description}
      </Typography.Paragraph>
      {defect.external_ticket_id && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          TestOps: {defect.external_ticket_id}
        </Typography.Text>
      )}

      {/* LLM analysis (PER-26). Hidden when the detector didn't supply
          any rationale — heuristic fallbacks just leave it null. We
          render known keys (reasoning / evidence / confidence /
          suggested_fix) as labelled rows; everything else falls into
          the raw JSON dump at the bottom for power-users. */}
      {hasLlm && (
        <Collapse
          ghost
          size="small"
          style={{ marginTop: 8 }}
          items={[
            {
              key: "llm",
              label: (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Анализ модели
                </Typography.Text>
              ),
              children: <LlmAnalysisView data={llm!} token={token} />,
            },
          ]}
        />
      )}
    </Card>
  );
}

function LlmAnalysisView({
  data,
  token,
}: {
  data: Record<string, unknown>;
  token: ReturnType<typeof antdTheme.useToken>["token"];
}) {
  // Known structured keys we promote to labelled rows. Anything left
  // over goes into a raw JSON dump so nothing important is hidden.
  const PROMOTED: { key: string; label: string }[] = [
    { key: "reasoning",     label: "Рассуждение" },
    { key: "evidence",      label: "Доказательства" },
    { key: "confidence",    label: "Уверенность" },
    { key: "suggested_fix", label: "Возможное исправление" },
  ];
  const promotedKeys = new Set(PROMOTED.map((p) => p.key));
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!promotedKeys.has(k)) rest[k] = v;
  }

  const renderValue = (v: unknown) => {
    if (v == null) return <Typography.Text type="secondary">—</Typography.Text>;
    if (typeof v === "string") return <Typography.Paragraph style={{ marginBottom: 4, whiteSpace: "pre-wrap" }}>{v}</Typography.Paragraph>;
    if (typeof v === "number" || typeof v === "boolean") return <Typography.Text code>{String(v)}</Typography.Text>;
    return <pre style={{ fontSize: 11, margin: 0, color: token.colorTextSecondary }}>{JSON.stringify(v, null, 2)}</pre>;
  };

  return (
    <Space direction="vertical" size={4} style={{ width: "100%" }}>
      {PROMOTED.filter((p) => p.key in data).map((p) => (
        <div key={p.key}>
          <Typography.Text strong style={{ fontSize: 12 }}>{p.label}: </Typography.Text>
          {renderValue(data[p.key])}
        </div>
      ))}
      {Object.keys(rest).length > 0 && (
        <pre
          style={{
            fontSize: 11,
            margin: 0,
            padding: 8,
            background: token.colorFillQuaternary,
            color: token.colorText,
            borderRadius: 4,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(rest, null, 2)}
        </pre>
      )}
    </Space>
  );
}
