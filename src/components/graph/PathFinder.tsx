import { ArrowRightOutlined, NodeIndexOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Card, Checkbox, Empty, Modal, Select, Space, Tag, Typography, theme } from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { replayPath } from "@/api/runs";
import type { RunEdgeSummary, RunScreenSummary } from "@/types";
import { notify } from "@/utils/notify";

interface Props {
  screens: RunScreenSummary[];
  edges: RunEdgeSummary[];
  /** PER-40: when provided, enables the "Replay" button that creates
   *  a new run replaying the found path. Without runId the path
   *  finder stays read-only. */
  runId?: string;
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
export function PathFinder({ screens, edges, runId }: Props) {
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [replayModalOpen, setReplayModalOpen] = useState(false);
  const [continueAfter, setContinueAfter] = useState(false);
  const nav = useNavigate();
  const { token } = theme.useToken();

  const replayM = useMutation({
    mutationFn: ({ edgeIds, continueAfterReplay }: { edgeIds: number[]; continueAfterReplay: boolean }) =>
      replayPath(runId!, {
        edge_ids: edgeIds,
        continue_after_replay: continueAfterReplay,
      }),
    onSuccess: (created) => {
      notify.success("Replay run создан");
      setReplayModalOpen(false);
      nav(`/runs/${created.id}/progress`);
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

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
        <ArrowRightOutlined style={{ color: token.colorTextTertiary }} />
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
        <>
          <PathView path={path} screenByHash={screenByHash} />
          {runId && path.length > 0 && (
            <div style={{ marginTop: 12, textAlign: "right" }}>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => setReplayModalOpen(true)}
                loading={replayM.isPending}
              >
                Replay этот путь
              </Button>
            </div>
          )}
        </>
      )}

      {/* PER-40: replay confirmation modal — explicit "stop after
          replay" / "continue with exploration" choice so the user
          knows whether the new run will be a 4-step regression
          check or a full exploration anchored on the path's end. */}
      <Modal
        open={replayModalOpen}
        title="Запустить replay"
        onCancel={() => setReplayModalOpen(false)}
        onOk={() => {
          if (!path) return;
          replayM.mutate({
            edgeIds: path.map((p) => p.edge.id),
            continueAfterReplay: continueAfter,
          });
        }}
        okText="Запустить"
        cancelText="Отмена"
        confirmLoading={replayM.isPending}
        destroyOnHidden
      >
        <Typography.Paragraph>
          Создаётся новый run, который проиграет {path?.length ?? 0}{" "}
          сохранённых действий из этого графа. Приложение, устройство и
          режим — те же, что были у исходного run-а.
        </Typography.Paragraph>
        <Checkbox
          checked={continueAfter}
          onChange={(e) => setContinueAfter(e.target.checked)}
        >
          Продолжить свободное исследование после replay
        </Checkbox>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
          Если выключено — run остановится сразу после проигрывания пути
          (полезно для проверки «исправлен ли баг в новой сборке»).
        </Typography.Paragraph>
      </Modal>
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
