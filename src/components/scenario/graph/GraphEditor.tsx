/**
 * Visual scenario graph editor (PER-82).
 *
 * Replaces the old linear FlowchartEditor. Users build the scenario by:
 *  1. Adding nodes from the palette toolbar (Action, Decision, Wait,
 *     Screen check, Loop back).
 *  2. Dragging from a source handle to a target handle to wire edges.
 *  3. Selecting a node → right-side Drawer for editing fields.
 *  4. Selecting a node + Backspace / Del → removes node and any
 *     incident edges.
 *
 * The component is fully controlled: parent passes the v2 graph in
 * `value` and receives a fresh graph in `onChange`. Position changes
 * (drag inside canvas) are debounced into the same onChange so the
 * parent's "isDirty" flag is set and the layout persists.
 */

import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  BranchesOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tooltip,
  Typography,
  theme,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useThemeStore } from "@/store/theme";

import { SCENARIO_NODE_TYPES } from "./nodes";
import {
  ACTION_VERBS,
  newNodeId,
  type ActionNodeData,
  type GraphEdge,
  type GraphNode,
  type GraphNodeType,
  type ScenarioGraphV2,
} from "./types";
import { validateGraph, type ValidationIssue } from "./validate";

// ──────────────────────────────────────────────────────────────────────

interface Props {
  value: ScenarioGraphV2;
  onChange: (next: ScenarioGraphV2) => void;
  /** Variables available for {{test_data.X}} autocomplete in input/value
   *  fields. Optional — when omitted, plain Input is used. */
  variables?: { key: string; value?: string }[];
  height?: number;
}

// Palette buttons → which node-type to add.
const PALETTE: { type: GraphNodeType; icon: React.ReactNode; label: string }[] = [
  { type: "action", icon: <ThunderboltOutlined />, label: "Действие" },
  { type: "decision", icon: <BranchesOutlined />, label: "Условие" },
  { type: "wait", icon: <ClockCircleOutlined />, label: "Пауза" },
  { type: "screen_check", icon: <EyeOutlined />, label: "Проверить экран" },
  { type: "loop_back", icon: <ArrowLeftOutlined />, label: "Цикл" },
];

// Default field values for each new node type.
function defaultDataFor(type: GraphNodeType): Record<string, unknown> {
  switch (type) {
    case "action":
      return { action: "tap", element_label: "" } as ActionNodeData;
    case "decision":
      return { label: "Условие" };
    case "wait":
      return { ms: 1000 };
    case "screen_check":
      return { screen_description: "" };
    case "loop_back":
      return { max_iterations: 10 };
    default:
      return {};
  }
}

// ──────────────────────────────────────────────────────────────────────

export function GraphEditor({ value, onChange, variables, height = 600 }: Props) {
  const { token } = theme.useToken();
  const themeMode = useThemeStore((s) => s.resolved);

  // React Flow expects its own Node/Edge shape. We keep our v2 model
  // as the source of truth and translate on each render — cheap, and
  // saves us from writing diff-detection code.
  const rfNodes: Node[] = useMemo(
    () =>
      value.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data as Record<string, unknown>,
        // start + end are not deletable to keep the graph well-formed.
        deletable: n.type !== "start" && n.type !== "end",
      })),
    [value.nodes],
  );

  // PER-84: synchronous validation pass. Memoised so we don't re-walk
  // the graph on every pointer move.
  const issues: ValidationIssue[] = useMemo(() => validateGraph(value), [value]);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const issuesByNode = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues) {
      if (i.target.startsWith("node:")) {
        const id = i.target.slice("node:".length);
        if (!m.has(id) || (i.severity === "error" && m.get(id)?.severity !== "error")) {
          m.set(id, i);
        }
      }
    }
    return m;
  }, [issues]);

  // Inject a coloured outline on nodes that have validation issues so
  // the user can see the offending vertices without reading the
  // banner. Recomputed in a separate memo so the rfNodes memo above
  // doesn't have to depend on issues (cleaner cache invalidation).
  const decoratedRfNodes: Node[] = useMemo(() => {
    if (issuesByNode.size === 0) return rfNodes;
    return rfNodes.map((n) => {
      const issue = issuesByNode.get(n.id);
      if (!issue) return n;
      const colour =
        issue.severity === "error" ? token.colorError : token.colorWarning;
      return {
        ...n,
        style: {
          ...(n.style ?? {}),
          outline: `2px solid ${colour}`,
          outlineOffset: 2,
          borderRadius: 8,
        },
      };
    });
    // ``token`` deps because outline colour reads tokens — kept so
    // theme switches re-render highlights.
  }, [rfNodes, issuesByNode, token]);
  const rfEdges: Edge[] = useMemo(
    () =>
      value.edges.map((e) => {
        // PER-83: surface condition expressions on the edge label so
        // the user sees branching logic at a glance. Explicit
        // ``data.label`` (set by the user in the edge editor) wins
        // over the auto-derived condition string.
        const explicit = e.data?.label;
        const cond = (e.data?.condition ?? "").toString().trim();
        const display = explicit || (cond ? cond : undefined);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          // Loop edges drawn dashed + warning colour as a visual hint —
          // PER-84 will style this more carefully.
          animated: !e.data?.loop,
          style: e.data?.loop
            ? { stroke: token.colorWarning, strokeDasharray: "5 5", strokeWidth: 2 }
            : { stroke: token.colorTextTertiary, strokeWidth: 1.5 },
          label: display,
          labelStyle: {
            fontSize: 11,
            fill: token.colorText,
            fontFamily: cond && !explicit ? "monospace" : undefined,
          },
          labelBgStyle: {
            fill: token.colorBgContainer,
            fillOpacity: 0.85,
          },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
        };
      }),
    [value.edges, token],
  );

  // Selected node — drives the right-side editor drawer.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => (selectedId ? value.nodes.find((n) => n.id === selectedId) ?? null : null),
    [selectedId, value.nodes],
  );

  // PER-83: selected edge — separate state so the user can edit edge
  // condition/label without dismissing the node drawer first.
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const selectedEdge = useMemo(
    () =>
      selectedEdgeId
        ? value.edges.find((e) => e.id === selectedEdgeId) ?? null
        : null,
    [selectedEdgeId, value.edges],
  );

  const updateEdgeData = (patch: Record<string, unknown>) => {
    if (!selectedEdge) return;
    onChange({
      ...value,
      edges: value.edges.map((e) =>
        e.id === selectedEdge.id
          ? { ...e, data: { ...(e.data ?? {}), ...patch } }
          : e,
      ),
    });
  };

  // Apply React Flow's incremental changes back into the v2 model.
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, rfNodes);
      onChange({
        ...value,
        nodes: next.map<GraphNode>((n) => {
          const original = value.nodes.find((x) => x.id === n.id);
          return {
            id: n.id,
            type: (n.type ?? original?.type ?? "action") as GraphNodeType,
            position: n.position ?? original?.position ?? { x: 0, y: 0 },
            data: (n.data ?? original?.data ?? {}) as Record<string, unknown>,
          };
        }),
        // Drop edges that lost an endpoint (React Flow doesn't auto-prune
        // on node removal in v12).
        edges: value.edges.filter((e) => {
          const removed = changes.some(
            (c) => c.type === "remove" && (c.id === e.source || c.id === e.target),
          );
          return !removed;
        }),
      });
    },
    [rfNodes, value, onChange],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const next = applyEdgeChanges(changes, rfEdges);
      onChange({
        ...value,
        edges: next.map<GraphEdge>((e) => {
          const original = value.edges.find((x) => x.id === e.id);
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            data: original?.data ?? {},
          };
        }),
      });
    },
    [rfEdges, value, onChange],
  );

  // Drag-to-connect: parent decides whether the connection is allowed.
  // For now we accept anything except a self-loop on a non-loop_back
  // node (full validation lives in PER-84).
  const handleConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      if (conn.source === conn.target) {
        const node = value.nodes.find((n) => n.id === conn.source);
        if (node?.type !== "loop_back") return; // refuse trivial self-loop
      }
      const newEdge: GraphEdge = {
        id: `e_${conn.source}_${conn.target}_${Math.random().toString(36).slice(2, 6)}`,
        source: conn.source,
        target: conn.target,
        data: {},
      };
      onChange({
        ...value,
        edges: addEdge(
          {
            id: newEdge.id,
            source: newEdge.source,
            target: newEdge.target,
            data: newEdge.data,
          },
          rfEdges,
        ).map<GraphEdge>((e) => {
          const matched =
            e.id === newEdge.id
              ? newEdge
              : value.edges.find((x) => x.id === e.id);
          return matched ?? {
            id: e.id,
            source: e.source,
            target: e.target,
            data: {},
          };
        }),
      });
    },
    [value, onChange, rfEdges],
  );

  // Add a new node from the palette. Position it just below the
  // current centre so it's visible without colliding with start/end
  // by default. Auto-layout (dagre) is left for a follow-up.
  const handleAddNode = useCallback(
    (type: GraphNodeType) => {
      const id = newNodeId(type[0]);
      const ys = value.nodes.map((n) => n.position?.y ?? 0);
      const maxY = Math.max(...ys, 0);
      const node: GraphNode = {
        id,
        type,
        position: { x: 200, y: maxY + 120 },
        data: defaultDataFor(type),
      };
      onChange({ ...value, nodes: [...value.nodes, node] });
      // Auto-select so the user goes straight into editing the fresh
      // node without an extra click.
      setSelectedId(id);
    },
    [value, onChange],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!selected || selected.type === "start" || selected.type === "end") return;
    onChange({
      ...value,
      nodes: value.nodes.filter((n) => n.id !== selected.id),
      edges: value.edges.filter(
        (e) => e.source !== selected.id && e.target !== selected.id,
      ),
    });
    setSelectedId(null);
  }, [selected, value, onChange]);

  // Persist edits from the drawer into the model.
  const handleSelectedDataChange = (patch: Record<string, unknown>) => {
    if (!selected) return;
    onChange({
      ...value,
      nodes: value.nodes.map((n) =>
        n.id === selected.id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    });
  };

  // Keyboard shortcut: Delete / Backspace removes selected node.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.key === "Delete" || ev.key === "Backspace") && selected) {
        // Don't steal Backspace from inputs.
        const tag = (ev.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        ev.preventDefault();
        handleDeleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, handleDeleteSelected]);

  return (
    <>
      {/* ─── Palette toolbar ───────────────────────────────────── */}
      <Space wrap style={{ marginBottom: 8 }}>
        {PALETTE.map((p) => (
          <Tooltip key={p.type} title={`Добавить: ${p.label}`}>
            <Button
              icon={p.icon}
              onClick={() => handleAddNode(p.type)}
              size="small"
            >
              {p.label}
            </Button>
          </Tooltip>
        ))}
        {selected && selected.type !== "start" && selected.type !== "end" && (
          <Tooltip title="Удалить выделенный узел (Backspace)">
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={handleDeleteSelected}
            >
              Удалить
            </Button>
          </Tooltip>
        )}
        <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
          <ApartmentOutlined /> Соединить узлы — потяните мышью от точки к точке.
        </Typography.Text>
      </Space>

      {/* ─── Validation banner (PER-84) ────────────────────────── */}
      {(errors.length > 0 || warnings.length > 0) && (
        <Alert
          type={errors.length > 0 ? "error" : "warning"}
          showIcon
          style={{ marginBottom: 8 }}
          message={
            errors.length > 0
              ? `Граф невалиден: ${errors.length} ${errors.length === 1 ? "ошибка" : "ошибок"}`
              : `Предупреждений: ${warnings.length}`
          }
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {issues.slice(0, 6).map((i, idx) => (
                <li key={`${i.target}-${idx}`}>
                  <Typography.Text
                    type={i.severity === "error" ? "danger" : "warning"}
                    style={{ fontSize: 12 }}
                  >
                    {i.message}
                  </Typography.Text>
                </li>
              ))}
              {issues.length > 6 && (
                <li>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    …и ещё {issues.length - 6}.
                  </Typography.Text>
                </li>
              )}
            </ul>
          }
        />
      )}

      {/* ─── Canvas ────────────────────────────────────────────── */}
      <div
        style={{
          height,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          background: token.colorFillQuaternary,
        }}
      >
        <ReactFlow
          nodes={decoratedRfNodes}
          edges={rfEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onNodeClick={(_, n) => {
            setSelectedId(n.id);
            setSelectedEdgeId(null);
          }}
          onEdgeClick={(_, e) => {
            setSelectedEdgeId(e.id);
            setSelectedId(null);
          }}
          onPaneClick={() => {
            setSelectedId(null);
            setSelectedEdgeId(null);
          }}
          nodeTypes={SCENARIO_NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          colorMode={themeMode}
          deleteKeyCode={null} /* handled manually so we can preserve start/end */
        >
          <Background />
          <Controls />
          <MiniMap
            pannable
            zoomable
            maskColor={
              themeMode === "dark"
                ? "rgba(0, 0, 0, 0.6)"
                : "rgba(240, 240, 240, 0.6)"
            }
            nodeColor={() => token.colorPrimary}
            style={{
              background: token.colorBgElevated,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          />
        </ReactFlow>
      </div>

      {/* ─── Edit drawer ───────────────────────────────────────── */}
      <Drawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        width={420}
        title={selected ? `Узел: ${selected.type}` : ""}
        destroyOnHidden
      >
        {selected && (
          <NodeEditor
            node={selected}
            variables={variables}
            onChange={handleSelectedDataChange}
          />
        )}
      </Drawer>

      {/* ─── Edge edit drawer (PER-83) ─────────────────────────── */}
      <Drawer
        open={selectedEdge !== null}
        onClose={() => setSelectedEdgeId(null)}
        width={420}
        title="Ребро (переход)"
        destroyOnHidden
      >
        {selectedEdge && (
          <EdgeEditor
            edge={selectedEdge}
            onChange={updateEdgeData}
            onDelete={() => {
              onChange({
                ...value,
                edges: value.edges.filter((e) => e.id !== selectedEdge.id),
              });
              setSelectedEdgeId(null);
            }}
          />
        )}
      </Drawer>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────

function NodeEditor({
  node,
  variables,
  onChange,
}: {
  node: GraphNode;
  variables?: { key: string; value?: string }[];
  onChange: (patch: Record<string, unknown>) => void;
}) {
  if (node.type === "action") {
    const d = node.data as ActionNodeData;
    return (
      <Form layout="vertical">
        <Form.Item label="Действие">
          <Select
            value={d.action ?? "tap"}
            onChange={(v) => onChange({ action: v })}
            options={ACTION_VERBS}
          />
        </Form.Item>
        <Form.Item label="Элемент">
          <Input
            value={d.element_label ?? ""}
            onChange={(e) => onChange({ element_label: e.target.value })}
            placeholder="Кнопка, поле, переключатель..."
          />
        </Form.Item>
        <Form.Item label="Значение">
          <Input
            value={d.value ?? ""}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Текст или {{test_data.key}}"
          />
        </Form.Item>
        <Form.Item
          label="Ожидаемый результат"
          extra="Опционально — будет сверяться с базой знаний."
        >
          <Input.TextArea
            rows={2}
            value={d.expected_result ?? ""}
            onChange={(e) => onChange({ expected_result: e.target.value })}
          />
        </Form.Item>
        <Form.Item
          label="Описание экрана"
          extra="Опишите экран словами на любом языке (PER-85). Если пусто — проверки нет."
        >
          <Input
            value={d.screen_description ?? ""}
            onChange={(e) => onChange({ screen_description: e.target.value })}
            placeholder="например: экран входа"
          />
        </Form.Item>
        {variables && variables.length > 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            Доступные переменные: {variables.slice(0, 6).map((v) => `{{${v.key}}}`).join(", ")}
            {variables.length > 6 ? ", …" : ""}
          </Typography.Text>
        )}
      </Form>
    );
  }

  if (node.type === "decision") {
    const d = node.data as { label?: string };
    return (
      <Form layout="vertical">
        <Form.Item
          label="Подпись узла"
          extra="Условия задаются на исходящих рёбрах (PER-83)."
        >
          <Input
            value={d.label ?? ""}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Например: пользователь админ?"
          />
        </Form.Item>
      </Form>
    );
  }

  if (node.type === "wait") {
    const d = node.data as { ms?: number };
    return (
      <Form layout="vertical">
        <Form.Item label="Длительность (мс)">
          <InputNumber
            min={100}
            max={60_000}
            step={100}
            value={d.ms ?? 1000}
            onChange={(v) => onChange({ ms: v ?? 1000 })}
            style={{ width: "100%" }}
          />
        </Form.Item>
      </Form>
    );
  }

  if (node.type === "screen_check") {
    const d = node.data as { screen_description?: string };
    return (
      <Form layout="vertical">
        <Form.Item
          label="Описание экрана"
          extra="LLM сверит текущий экран с этим описанием перед следующим шагом (PER-85)."
        >
          <Input.TextArea
            rows={3}
            value={d.screen_description ?? ""}
            onChange={(e) => onChange({ screen_description: e.target.value })}
            placeholder="например: главная страница со списком заказов"
          />
        </Form.Item>
      </Form>
    );
  }

  if (node.type === "loop_back") {
    const d = node.data as { max_iterations?: number };
    return (
      <Form layout="vertical">
        <Form.Item label="Максимум итераций">
          <InputNumber
            min={1}
            max={1000}
            value={d.max_iterations ?? 10}
            onChange={(v) => onChange({ max_iterations: v ?? 10 })}
            style={{ width: "100%" }}
          />
        </Form.Item>
      </Form>
    );
  }

  return (
    <Typography.Text type="secondary">
      Узел типа «{node.type}» — без редактируемых полей.
    </Typography.Text>
  );
}

// ──────────────────────────────────────────────────────────────────────
// PER-83: edge condition + label editor.

function EdgeEditor({
  edge,
  onChange,
  onDelete,
}: {
  edge: GraphEdge;
  onChange: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const data = edge.data ?? {};
  return (
    <Form layout="vertical">
      <Form.Item
        label="Условие"
        extra={
          <span>
            Выражение проверяется перед переходом по этому ребру.
            Поддерживаются: <code>==</code>, <code>!=</code>, <code>{"<"}</code>,{" "}
            <code>{">"}</code>, <code>&&</code>, <code>||</code>, <code>!</code>,
            функции <code>contains()</code>, <code>starts_with()</code>,{" "}
            <code>ends_with()</code>, <code>length()</code>. Переменные —{" "}
            <code>{`{{test_data.x}}`}</code>,{" "}
            <code>{`{{last_action_result.ok}}`}</code>. Пустое поле = ветка
            «иначе».
          </span>
        }
      >
        <Input.TextArea
          rows={2}
          value={(data.condition as string | undefined) ?? ""}
          onChange={(e) => onChange({ condition: e.target.value })}
          placeholder='{{test_data.role}} == "admin"'
          style={{ fontFamily: "monospace" }}
        />
      </Form.Item>
      <Form.Item
        label="Подпись"
        extra="Опционально. Если задано — рисуется на ребре вместо условия."
      >
        <Input
          value={(data.label as string | undefined) ?? ""}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="например: admin"
        />
      </Form.Item>
      <Form.Item
        label="Это back-edge (цикл)"
        extra="Включите для рёбер, возвращающих поток назад по графу. Worker считает повторы и останавливается при достижении max_iterations."
      >
        <Space>
          <Switch
            checked={Boolean(data.loop)}
            onChange={(checked) => onChange({ loop: checked })}
          />
          {Boolean(data.loop) && (
            <InputNumber
              min={1}
              max={1000}
              placeholder="max"
              value={(data.max_iterations as number | undefined) ?? undefined}
              onChange={(v) => onChange({ max_iterations: v ?? undefined })}
              addonAfter="итераций"
              style={{ width: 180 }}
            />
          )}
        </Space>
      </Form.Item>
      <Form.Item>
        <Button danger size="small" onClick={onDelete}>
          Удалить ребро
        </Button>
      </Form.Item>
    </Form>
  );
}
