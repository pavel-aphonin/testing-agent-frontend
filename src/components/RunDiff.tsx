import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Empty,
  List,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";

import { getRunDiff, listRuns, type RunDiffPayload } from "@/api/runs";
import type { Run } from "@/types";

interface Props {
  runId: string;
  workspaceId?: string | null;
}

/**
 * Cross-run comparison panel for /runs/{id}/results (PER-27).
 *
 * The user picks a baseline run (last 10 from the same workspace,
 * filtered to non-current and non-pending). We hit /api/runs/{id}/diff
 * and render the result as five sections: screens added/removed,
 * edges added/removed/changed, defects new/resolved/persisted.
 *
 * Kept deliberately on a "load on demand" trigger — the diff query
 * scans the full screen+edge+defect tables for both runs, which can
 * be heavy on long runs and shouldn't fire on every page open.
 */
export function RunDiff({ runId, workspaceId }: Props) {
  const [baseline, setBaseline] = useState<string | undefined>();

  // Last ~20 runs in the workspace; the dropdown filters out the
  // current run + anything still pending so we don't suggest a
  // useless baseline.
  const candidatesQ = useQuery({
    queryKey: ["run-diff-candidates", workspaceId ?? "none"],
    queryFn: () => listRuns(workspaceId ?? undefined),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });

  // Diff is fetched manually so we don't burn cycles when the user
  // never opens the dropdown.
  const diffM = useMutation({
    mutationFn: (against: string) => getRunDiff(runId, against),
  });

  const options = (candidatesQ.data ?? [])
    .filter((r: Run) => r.id !== runId && r.status !== "pending" && r.status !== "running")
    .slice(0, 20)
    .map((r: Run) => ({
      value: r.id,
      label: `${new Date(r.started_at ?? r.created_at).toLocaleString("ru-RU")} · ${r.bundle_id ?? "—"} · ${r.status}`,
    }));

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      <Space wrap>
        <Typography.Text>Сравнить с:</Typography.Text>
        <Select
          style={{ width: 480 }}
          showSearch
          placeholder="Выберите baseline-запуск"
          options={options}
          loading={candidatesQ.isLoading}
          value={baseline}
          onChange={setBaseline}
          filterOption={(input, opt) =>
            String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
          }
        />
        <Button
          type="primary"
          disabled={!baseline}
          loading={diffM.isPending}
          onClick={() => baseline && diffM.mutate(baseline)}
        >
          Сравнить
        </Button>
      </Space>

      {diffM.error && (
        <Alert type="error" message={(diffM.error as Error).message} showIcon />
      )}
      {diffM.data?.error && (
        <Alert type="error" message={diffM.data.error} showIcon />
      )}
      {diffM.data && !diffM.data.error && <DiffView data={diffM.data} />}
    </Space>
  );
}

function DiffView({ data }: { data: RunDiffPayload }) {
  const s = data.summary;
  return (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      <Card size="small">
        <Space size="large" wrap>
          <Statistic title="Новых экранов" value={s.screens_added} valueStyle={{ color: "#52c41a" }} />
          <Statistic title="Пропавших экранов" value={s.screens_removed} valueStyle={{ color: "#cf1322" }} />
          <Statistic title="Новых рёбер" value={s.edges_added} valueStyle={{ color: "#52c41a" }} />
          <Statistic title="Пропавших рёбер" value={s.edges_removed} valueStyle={{ color: "#cf1322" }} />
          <Statistic title="Регрессий" value={s.edges_changed} valueStyle={{ color: "#faad14" }} />
          <Statistic title="Новых дефектов" value={s.defects_new} valueStyle={{ color: "#cf1322" }} />
          <Statistic title="Закрытых дефектов" value={s.defects_resolved} valueStyle={{ color: "#52c41a" }} />
          <Statistic title="Persistent" value={s.defects_persisted} />
        </Space>
      </Card>

      <DiffSection title="Новые экраны" tone="green" items={data.screens_added.map((sc) => sc.name)} />
      <DiffSection title="Пропали экраны" tone="red" items={data.screens_removed.map((sc) => sc.name)} />
      {data.edges_changed.length > 0 && (
        <DiffSection
          title="Регрессии (success → fail)"
          tone="orange"
          items={data.edges_changed
            .filter((e) => e.old_success && !e.new_success)
            .map((e) => `${shortHash(e.source_hash)} → ${shortHash(e.target_hash)} (${e.action_type})`)}
        />
      )}
      <DiffSection
        title="Новые дефекты"
        tone="red"
        items={data.defects_new.map((d) => `${d.priority} · ${d.title}`)}
      />
      <DiffSection
        title="Закрытые дефекты"
        tone="green"
        items={data.defects_resolved.map((d) => `${d.priority} · ${d.title}`)}
      />
      {data.defects_persisted.length > 0 && (
        <DiffSection
          title="Persistent дефекты"
          tone="default"
          items={data.defects_persisted.map((d) => `${d.priority} · ${d.title}`)}
        />
      )}
    </Space>
  );
}

function DiffSection({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "green" | "red" | "orange" | "default";
  items: string[];
}) {
  if (items.length === 0) return null;
  const toneColor = tone === "default" ? undefined : tone;
  return (
    <Card size="small" title={<Space><Tag color={toneColor}>{items.length}</Tag>{title}</Space>}>
      <List
        size="small"
        dataSource={items}
        renderItem={(t) => <List.Item>{t}</List.Item>}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
    </Card>
  );
}

function shortHash(h: string): string {
  return h.slice(0, 8);
}
