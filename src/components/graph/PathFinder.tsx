import { ArrowRightOutlined, NodeIndexOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, Select, Space, Tag, Typography } from "antd";
import { useMemo, useState } from "react";

import type { RunEdgeSummary, RunScreenSummary } from "@/types";

interface Props {
  screens: RunScreenSummary[];
  edges: RunEdgeSummary[];
}

/**
 * Path finder for large state graphs. Garri's demo feedback: rendering the
 * full graph for a real (Альфа-Мобайл-scale) app is unreadable. Instead let
 * the user pick start + end screens and we show ONLY the shortest path
 * between them as an ordered list of steps.
 *
 * BFS over the directed graph of (screen_hash → screen_hash) edges. If
 * multiple edges connect the same pair, we keep the first found — the user
 * doesn't care about parallel transitions for navigation.
 */
export function PathFinder({ screens, edges }: Props) {
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();

  // Map hash → screen for quick label lookup.
  const screenByHash = useMemo(() => {
    const m = new Map<string, RunScreenSummary>();
    for (const s of screens) {
      m.set(s.screen_id_hash, s);
    }
    return m;
  }, [screens]);

  // Adjacency: source_hash → [{ target_hash, edge }, ...].
  const adjacency = useMemo(() => {
    const map = new Map<string, { target: string; edge: RunEdgeSummary }[]>();
    for (const e of edges) {
      if (!e.success) continue; // skip broken transitions for path finding
      const list = map.get(e.source_screen_hash) ?? [];
      list.push({ target: e.target_screen_hash, edge: e });
      map.set(e.source_screen_hash, list);
    }
    return map;
  }, [edges]);

  const path = useMemo(() => {
    if (!from || !to || from === to) return null;
    return bfs(from, to, adjacency);
  }, [from, to, adjacency]);

  const screenOptions = useMemo(
    () =>
      [...screens]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ value: s.screen_id_hash, label: s.name })),
    [screens],
  );

  return (
    <Card size="small" title={<><NodeIndexOutlined /> Поиск пути между экранами</>}>
      <Space style={{ marginBottom: 12, width: "100%" }} wrap>
        <Select
          showSearch
          placeholder="Откуда"
          value={from}
          onChange={setFrom}
          options={screenOptions}
          style={{ minWidth: 220 }}
          optionFilterProp="label"
          allowClear
        />
        <ArrowRightOutlined style={{ color: "#999" }} />
        <Select
          showSearch
          placeholder="Куда"
          value={to}
          onChange={setTo}
          options={screenOptions}
          style={{ minWidth: 220 }}
          optionFilterProp="label"
          allowClear
        />
        {(from || to) && (
          <Button
            size="small"
            type="link"
            onClick={() => { setFrom(undefined); setTo(undefined); }}
          >
            Сбросить
          </Button>
        )}
      </Space>

      {!from || !to ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Выберите начальный и конечный экраны, чтобы увидеть путь между ними.
        </Typography.Text>
      ) : from === to ? (
        <Alert type="info" message="Начальный и конечный экраны совпадают." />
      ) : path === null ? (
        <Empty description={`Прямой путь от «${screenByHash.get(from)?.name}» к «${screenByHash.get(to)?.name}» не найден`} />
      ) : (
        <PathView path={path} screenByHash={screenByHash} />
      )}
    </Card>
  );
}

interface PathStep {
  source_hash: string;
  target_hash: string;
  edge: RunEdgeSummary;
}

function PathView({
  path,
  screenByHash,
}: {
  path: PathStep[];
  screenByHash: Map<string, RunScreenSummary>;
}) {
  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
        {path.length} переход{path.length === 1 ? "" : path.length < 5 ? "а" : "ов"}:
      </Typography.Text>
      <ol style={{ paddingLeft: 24, margin: 0 }}>
        {path.map((step, i) => {
          const src = screenByHash.get(step.source_hash);
          const tgt = screenByHash.get(step.target_hash);
          const action = (step.edge.action_details_json as { element?: string; value?: string } | null) ?? null;
          return (
            <li key={i} style={{ marginBottom: 6, fontSize: 13 }}>
              <Typography.Text strong>{src?.name ?? step.source_hash.slice(0, 8)}</Typography.Text>
              {" "}
              <Tag style={{ margin: "0 4px" }}>{step.edge.action_type}</Tag>
              {action?.element && (
                <Typography.Text code style={{ fontSize: 11 }}>
                  {action.element}
                </Typography.Text>
              )}
              {action?.value && (
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {" "}= "{action.value}"
                </Typography.Text>
              )}
              {" → "}
              <Typography.Text>{tgt?.name ?? step.target_hash.slice(0, 8)}</Typography.Text>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** BFS shortest-path through the directed graph. Returns null if unreachable. */
function bfs(
  start: string,
  end: string,
  adjacency: Map<string, { target: string; edge: RunEdgeSummary }[]>,
): PathStep[] | null {
  if (start === end) return [];

  const visited = new Set<string>([start]);
  const queue: { node: string; path: PathStep[] }[] = [{ node: start, path: [] }];

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;
    const edges = adjacency.get(node) ?? [];
    for (const { target, edge } of edges) {
      if (visited.has(target)) continue;
      const nextPath = [
        ...path,
        { source_hash: node, target_hash: target, edge },
      ];
      if (target === end) return nextPath;
      visited.add(target);
      queue.push({ node: target, path: nextPath });
    }
  }

  return null;
}
