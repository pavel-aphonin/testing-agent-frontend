import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Card,
  Empty,
  Radio,
  Space,
  Spin,
  Tag,
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
    </Card>
  );
}
