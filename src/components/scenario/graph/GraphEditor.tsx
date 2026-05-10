/**
 * Scenario graph editor — built on React Flow's stock primitives,
 * no visual customisations.
 *
 * What's in here:
 *   * The vanilla "Add Node on Edge Drop" pattern from RF's docs
 *     (drag from a node's handle, release in empty space → a new
 *     node + a connecting edge appear).
 *   * A two-way bridge to our v2 scenario graph format: ``value``
 *     coming in is converted to RF nodes/edges, every change goes
 *     back through ``onChange`` as a fresh v2 graph.
 *   * Click on a node → drawer where the user picks the node's
 *     semantic type (action / decision / wait / screen check /
 *     sub-scenario / start / end) and edits its fields.
 *   * Click on an edge → drawer with the edge condition / label.
 *
 * What's NOT in here on purpose:
 *   * No custom shape components — every node renders as RF's
 *     default rectangle. Semantic type lives in ``data._category``,
 *     not in geometry.
 *   * No CSS overrides on handles or edges.
 *   * No floating shape picker, no sidebar palette. The vanilla
 *     drag-to-create flow is enough; richer pickers can come back
 *     later once the baseline is rock solid.
 */

import {
  addEdge,
  Background,
  ConnectionMode,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { listScenarioShapes } from "@/api/scenarioShapes";
import { useQuery } from "@tanstack/react-query";

import {
  ACTION_VERBS,
  newNodeId,
  type GraphEdge,
  type GraphNode,
  type GraphNodeType,
  type ScenarioGraphV2,
} from "./types";

// ──────────────────────────────────────────────────────────────────────

interface Props {
  value: ScenarioGraphV2;
  onChange: (next: ScenarioGraphV2) => void;
  variables?: { key: string; value?: string }[];
  allScenarios?: { id: string; title: string }[];
  currentScenarioId?: string;
  workspaceId?: string | null;
  height?: number;
}

// Internal category attached to each RF node's data so we know what
// semantic type the worker should treat it as. Default category for
// freshly-dropped nodes is "action" — that's the most common case
// and the drawer lets the user change it immediately.
const DEFAULT_CATEGORY: GraphNodeType = "action";

const CATEGORY_OPTIONS = [
  { value: "start", label: "Начало" },
  { value: "end", label: "Конец" },
  { value: "action", label: "Действие" },
  { value: "decision", label: "Условие" },
  { value: "wait", label: "Пауза" },
  { value: "screen_check", label: "Проверка экрана" },
  { value: "sub_scenario", label: "Связанный сценарий" },
  { value: "loop_back", label: "Возврат" },
  { value: "group", label: "Группа" },
];

// ──────────────────────────────────────────────────────────────────────
// Bisect step 4: full set of category shapes.
//
// Step 3 proved one custom shape works with useNodesState; now we
// extend to every category. Each shape is a plain ``<div>`` with
// stock ``<Handle>`` children — no CSS overrides on the handles
// themselves. Top handle = target, bottom = source, matching the
// vanilla "Add Node on Edge Drop" example. Start nodes have only
// a source (nothing flows in), end nodes have only a target.
//
// All shapes share two base style blocks so visual tweaks stay in
// one place; per-category overrides are limited to background +
// border-radius. Sizes are intentionally close to React Flow's
// default rectangle so the canvas feel doesn't shift.

const CARD_BASE: CSSProperties = {
  minWidth: 130,
  minHeight: 40,
  padding: "8px 14px",
  borderRadius: 6,
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 500,
  fontSize: 13,
  textAlign: "center",
  lineHeight: 1.25,
};

const CIRCLE_BASE: CSSProperties = {
  width: 86,
  height: 86,
  borderRadius: "50%",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  fontSize: 13,
  textAlign: "center",
  padding: 6,
  lineHeight: 1.2,
};

// Four-sided handles, one per side. With ConnectionMode.Loose the
// user can drag from any of them — RF's strict source-vs-target
// gating is off, so we just need each handle to be on the canvas
// for the gesture to start. Distinct IDs let edges remember which
// side they came out of so re-renders don't snap them back to the
// top/bottom default.
//
// ``hasIn`` / ``hasOut`` toggle the target / source pairs as a
// whole. Start nodes pass hasIn={false} (nothing flows in), end
// nodes pass hasOut={false} (nothing flows out). Everything else
// gets the full four.
function SideHandles({
  hasIn = true,
  hasOut = true,
}: {
  hasIn?: boolean;
  hasOut?: boolean;
}) {
  return (
    <>
      {hasIn && <Handle type="target" id="t" position={Position.Top} />}
      {hasIn && <Handle type="target" id="l" position={Position.Left} />}
      {hasOut && <Handle type="source" id="b" position={Position.Bottom} />}
      {hasOut && <Handle type="source" id="r" position={Position.Right} />}
    </>
  );
}

function StartNodeCircle({ data }: NodeProps) {
  return (
    <div style={{ ...CIRCLE_BASE, background: "#52c41a" }}>
      <SideHandles hasIn={false} />
      {(data?.label as string) ?? "Начало"}
    </div>
  );
}

function EndNodeCircle({ data }: NodeProps) {
  return (
    <div style={{ ...CIRCLE_BASE, background: "#f5222d" }}>
      <SideHandles hasOut={false} />
      {(data?.label as string) ?? "Конец"}
    </div>
  );
}

function ActionNodeCard({ data }: NodeProps) {
  return (
    <div style={{ ...CARD_BASE, background: "#1677ff" }}>
      <SideHandles />
      {(data?.label as string) ?? "Действие"}
    </div>
  );
}

function DecisionNodeCard({ data }: NodeProps) {
  return (
    <div style={{ ...CARD_BASE, background: "#fa8c16", borderRadius: 24 }}>
      <SideHandles />
      {(data?.label as string) ?? "Условие"}
    </div>
  );
}

function WaitNodeCard({ data }: NodeProps) {
  return (
    <div style={{ ...CARD_BASE, background: "#8c8c8c", borderRadius: 999 }}>
      <SideHandles />
      {(data?.label as string) ?? "Пауза"}
    </div>
  );
}

function ScreenCheckNodeCard({ data }: NodeProps) {
  return (
    <div style={{ ...CARD_BASE, background: "#722ed1" }}>
      <SideHandles />
      {(data?.label as string) ?? "Проверка экрана"}
    </div>
  );
}

function SubScenarioNodeCard({ data }: NodeProps) {
  return (
    <div style={{ ...CARD_BASE, background: "#13c2c2" }}>
      <SideHandles />
      {(data?.label as string) ?? "Связанный сценарий"}
    </div>
  );
}

function LoopBackNodeCard({ data }: NodeProps) {
  return (
    <div style={{ ...CARD_BASE, background: "#d4b106", borderRadius: 24 }}>
      <SideHandles />
      {(data?.label as string) ?? "Возврат"}
    </div>
  );
}

function GroupNodeCard({ data }: NodeProps) {
  return (
    <div
      style={{
        ...CARD_BASE,
        background: "transparent",
        color: "#595959",
        border: "1px dashed #bfbfbf",
      }}
    >
      <SideHandles />
      {(data?.label as string) ?? "Группа"}
    </div>
  );
}

const SCENARIO_NODE_TYPES = {
  start: StartNodeCircle,
  end: EndNodeCircle,
  action: ActionNodeCard,
  decision: DecisionNodeCard,
  wait: WaitNodeCard,
  screen_check: ScreenCheckNodeCard,
  sub_scenario: SubScenarioNodeCard,
  loop_back: LoopBackNodeCard,
  group: GroupNodeCard,
};

// ──────────────────────────────────────────────────────────────────────

export function GraphEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphEditorInner {...props} />
    </ReactFlowProvider>
  );
}

function GraphEditorInner({
  value,
  onChange,
  variables,
  allScenarios,
  currentScenarioId,
  height = 640,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const connectingNodeId = useRef<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  // ── v2 graph → RF state ────────────────────────────────────────
  //
  // The editor owns its own RF state internally. Whenever it
  // changes, we emit a fresh v2 graph up to the parent so the
  // parent's dirty-flag knows the scenario has unsaved edits. The
  // tricky bit is that the parent typically re-renders with a NEW
  // identity for ``value`` after the emit (its own setState), and
  // a naive useEffect on ``value`` would re-hydrate the editor
  // from that echoed value — triggering another emit — triggering
  // another echo — infinite loop, and the visible nodes flicker.
  //
  // We break the loop by JSON-comparing the parent's value against
  // what we last emitted. If they match, the new value is just our
  // own echo — skip the re-hydrate. If they differ, it's a real
  // external change (parent loaded a different scenario, JSON tab
  // pasted a different graph, etc.) — re-hydrate.
  const initial = useMemo(() => v2ToRf(value), [value]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);

  const lastEmittedJsonRef = useRef<string>(JSON.stringify(value));

  useEffect(() => {
    const incomingJson = JSON.stringify(value);
    if (incomingJson === lastEmittedJsonRef.current) return;
    lastEmittedJsonRef.current = incomingJson;
    const next = v2ToRf(value);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [value, setNodes, setEdges]);

  // Skip the very first emit (the editor just mounted with the
  // initial value — no real change yet).
  const isFirstEmitRef = useRef(true);
  useEffect(() => {
    if (isFirstEmitRef.current) {
      isFirstEmitRef.current = false;
      return;
    }
    const next = rfToV2(nodes, edges, value.version);
    const json = JSON.stringify(next);
    if (json === lastEmittedJsonRef.current) return; // nothing new
    lastEmittedJsonRef.current = json;
    onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // ── Selection + drawers ────────────────────────────────────────
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // ── Add a fresh node at the canvas centre ──────────────────────
  // The vanilla "drag from an existing node" pattern is the main
  // way to grow the graph, but there has to be something to drag
  // FROM. New scenarios start empty, so we expose one button that
  // drops a node at the centre of the visible canvas. Selecting
  // the new node immediately opens the drawer so the user can
  // change its type and fill fields.
  const addNodeAtCenter = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const position = screenToFlowPosition({ x: cx, y: cy });
    const id = newNodeId("n");
    const newNode: Node = {
      id,
      position,
      type: DEFAULT_CATEGORY,
      data: { label: "Новый шаг", _category: DEFAULT_CATEGORY },
    };
    setNodes((nds) => nds.concat(newNode));
    setSelectedNodeId(id);
  }, [screenToFlowPosition, setNodes]);

  // ── Vanilla "Add Node on Edge Drop" handlers ───────────────────
  const onConnect: OnConnect = useCallback(
    (params) => {
      connectingNodeId.current = null;
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges],
  );

  const onConnectStart: OnConnectStart = useCallback((_event, { nodeId }) => {
    connectingNodeId.current = nodeId;
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (connectionState.isValid) return;
      const id = newNodeId("n");
      const { clientX, clientY } =
        "changedTouches" in event ? event.changedTouches[0] : event;
      const position = screenToFlowPosition({ x: clientX, y: clientY });
      const newNode: Node = {
        id,
        position,
        type: DEFAULT_CATEGORY,
        data: { label: "Новый шаг", _category: DEFAULT_CATEGORY },
      };
      setNodes((nds) => nds.concat(newNode));
      if (connectingNodeId.current) {
        setEdges((eds) =>
          eds.concat({
            id: `e_${connectingNodeId.current}_${id}_${Math.random().toString(36).slice(2, 6)}`,
            source: connectingNodeId.current!,
            target: id,
          }),
        );
      }
      // Open the drawer right away so the user can pick a category /
      // fill in fields without a separate click.
      setSelectedNodeId(id);
    },
    [screenToFlowPosition, setNodes, setEdges],
  );

  // ── Edit drawer plumbing ───────────────────────────────────────
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;

  const updateSelectedNodeData = (patch: Record<string, unknown>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNodeId) return n;
        const nextData = { ...n.data, ...patch };
        // If the user switched category in the drawer, also swap
        // the RF type so the new shape renders immediately. Falling
        // back to ``undefined`` keeps RF on its default rectangle
        // for categories we haven't registered a shape for.
        let nextType = n.type;
        if ("_category" in patch) {
          const cat = String(patch._category);
          nextType = cat in SCENARIO_NODE_TYPES ? cat : undefined;
        }
        return { ...n, type: nextType, data: nextData };
      }),
    );
  };
  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) =>
      eds.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId,
      ),
    );
    setSelectedNodeId(null);
  };

  const updateSelectedEdgeData = (patch: Record<string, unknown>) => {
    if (!selectedEdgeId) return;
    setEdges((eds) =>
      eds.map((e) =>
        e.id === selectedEdgeId
          ? {
              ...e,
              label: typeof patch.label === "string" ? patch.label : e.label,
              data: { ...(e.data ?? {}), ...patch },
            }
          : e,
      ),
    );
  };
  const deleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
    setSelectedEdgeId(null);
  };

  return (
    <>
      {/* Minimal toolbar — just the "add node" button + a hint
          reminding the user about drag-from-handle. */}
      <Space style={{ marginBottom: 8 }}>
        <Button onClick={addNodeAtCenter}>+ Добавить узел</Button>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Или потяните мышью от точки на любом узле — там, где
          отпустите, появится следующий узел.
        </Typography.Text>
      </Space>

      <div ref={wrapperRef} style={{ width: "100%", height, position: "relative" }}>
        {nodes.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 5,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                pointerEvents: "auto",
                padding: 24,
                borderRadius: 12,
                border: "1px dashed currentColor",
                textAlign: "center",
                opacity: 0.85,
              }}
            >
              <div style={{ marginBottom: 12 }}>Холст пуст</div>
              <Button type="primary" onClick={addNodeAtCenter}>
                Добавить первый узел
              </Button>
            </div>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id);
            setSelectedEdgeId(null);
          }}
          onEdgeClick={(_, edge) => {
            setSelectedEdgeId(edge.id);
            setSelectedNodeId(null);
          }}
          fitView
          fitViewOptions={{ padding: 2 }}
          nodeOrigin={[0.5, 0]}
          nodeTypes={SCENARIO_NODE_TYPES}
          // Bisect step 5: any handle can initiate a connection,
          // not just source handles. Lets the user grab the top
          // handle of a card and drag a connection upward without
          // RF refusing the gesture because top is typed
          // ``target``. The vanilla "Add Node on Edge Drop" pattern
          // continues to work because connectionState.isValid
          // still reflects whether the drop landed on a compatible
          // node.
          connectionMode={ConnectionMode.Loose}
        >
          <Background />
          <Controls />
          {nodes.length > 0 && <MiniMap pannable zoomable />}
        </ReactFlow>
      </div>

      <Drawer
        open={selectedNode !== null}
        onClose={() => setSelectedNodeId(null)}
        title={selectedNode ? "Узел сценария" : ""}
        width={420}
        destroyOnHidden
      >
        {selectedNode && (
          <NodeForm
            node={selectedNode}
            variables={variables}
            allScenarios={allScenarios}
            currentScenarioId={currentScenarioId}
            onChange={updateSelectedNodeData}
            onDelete={deleteSelectedNode}
          />
        )}
      </Drawer>

      <Drawer
        open={selectedEdge !== null}
        onClose={() => setSelectedEdgeId(null)}
        title="Стрелка (переход)"
        width={420}
        destroyOnHidden
      >
        {selectedEdge && (
          <EdgeForm
            edge={selectedEdge}
            onChange={updateSelectedEdgeData}
            onDelete={deleteSelectedEdge}
          />
        )}
      </Drawer>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Drawer: node form

function NodeForm({
  node,
  variables,
  allScenarios,
  currentScenarioId,
  onChange,
  onDelete,
}: {
  node: Node;
  variables?: { key: string; value?: string }[];
  allScenarios?: { id: string; title: string }[];
  currentScenarioId?: string;
  onChange: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  // ``data._category`` carries the semantic type; the rest of ``data``
  // is the per-type payload (action, element_label, value, etc.)
  const d = (node.data ?? {}) as Record<string, unknown>;
  const category = (d._category as GraphNodeType) ?? "action";

  return (
    <Form layout="vertical">
      <Form.Item label="Тип узла">
        <Select
          value={category}
          options={CATEGORY_OPTIONS}
          onChange={(v) => onChange({ _category: v })}
        />
      </Form.Item>
      <Form.Item label="Подпись (видна на холсте)">
        <Input
          value={(d.label as string) ?? ""}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </Form.Item>

      {category === "action" && (
        <>
          <Form.Item label="Действие">
            <Select
              value={(d.action as string) ?? "tap"}
              options={ACTION_VERBS}
              onChange={(v) => onChange({ action: v })}
            />
          </Form.Item>
          <Form.Item label="Элемент">
            <Input
              value={(d.element_label as string) ?? ""}
              onChange={(e) => onChange({ element_label: e.target.value })}
              placeholder="Кнопка, поле, переключатель…"
            />
          </Form.Item>
          <Form.Item label="Значение">
            <Input
              value={(d.value as string) ?? ""}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder="Текст или {{test_data.key}}"
            />
          </Form.Item>
          <Form.Item label="Ожидаемый результат">
            <Input.TextArea
              rows={2}
              value={(d.expected_result as string) ?? ""}
              onChange={(e) => onChange({ expected_result: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="Описание экрана">
            <Input.TextArea
              rows={2}
              value={(d.screen_description as string) ?? ""}
              onChange={(e) => onChange({ screen_description: e.target.value })}
            />
          </Form.Item>
        </>
      )}

      {category === "wait" && (
        <Form.Item label="Длительность (мс)">
          <InputNumber
            min={100}
            max={60_000}
            value={(d.ms as number) ?? 1000}
            onChange={(v) => onChange({ ms: v ?? 1000 })}
            style={{ width: "100%" }}
          />
        </Form.Item>
      )}

      {category === "screen_check" && (
        <Form.Item label="Описание экрана">
          <Input.TextArea
            rows={3}
            value={(d.screen_description as string) ?? ""}
            onChange={(e) => onChange({ screen_description: e.target.value })}
          />
        </Form.Item>
      )}

      {category === "loop_back" && (
        <Form.Item label="Максимум итераций">
          <InputNumber
            min={1}
            max={1000}
            value={(d.max_iterations as number) ?? 10}
            onChange={(v) => onChange({ max_iterations: v ?? 10 })}
            style={{ width: "100%" }}
          />
        </Form.Item>
      )}

      {category === "sub_scenario" && (
        <Form.Item label="Сценарий">
          <Select
            showSearch
            allowClear
            value={(d.linked_scenario_id as string) ?? null}
            options={(allScenarios ?? [])
              .filter((s) => s.id !== currentScenarioId)
              .map((s) => ({ value: s.id, label: s.title }))}
            optionFilterProp="label"
            onChange={(v) =>
              onChange({
                linked_scenario_id: v ?? undefined,
                linked_scenario_title:
                  (allScenarios ?? []).find((s) => s.id === v)?.title,
              })
            }
          />
        </Form.Item>
      )}

      {variables && variables.length > 0 && (
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Переменные:{" "}
          {variables.slice(0, 6).map((v) => `{{${v.key}}}`).join(", ")}
          {variables.length > 6 ? ", …" : ""}
        </Typography.Text>
      )}

      <Form.Item style={{ marginTop: 24 }}>
        <Button danger onClick={onDelete}>
          Удалить узел
        </Button>
      </Form.Item>
    </Form>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Drawer: edge form

function EdgeForm({
  edge,
  onChange,
  onDelete,
}: {
  edge: Edge;
  onChange: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const d = (edge.data ?? {}) as Record<string, unknown>;
  return (
    <Form layout="vertical">
      <Form.Item
        label="Условие"
        extra="Опционально. Если задано, агент пойдёт по этой стрелке только когда выражение истинно."
      >
        <Input.TextArea
          rows={2}
          value={(d.condition as string) ?? ""}
          onChange={(e) => onChange({ condition: e.target.value })}
          placeholder='{{test_data.role}} == "admin"'
          style={{ fontFamily: "monospace" }}
        />
      </Form.Item>
      <Form.Item label="Подпись">
        <Input
          value={
            (typeof edge.label === "string" ? edge.label : (d.label as string)) ?? ""
          }
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </Form.Item>
      <Form.Item label="Это обратное ребро (цикл)">
        <Space>
          <Switch
            checked={Boolean(d.loop)}
            onChange={(checked) => onChange({ loop: checked })}
          />
          {Boolean(d.loop) && (
            <InputNumber
              min={1}
              max={1000}
              placeholder="максимум итераций"
              value={(d.max_iterations as number) ?? undefined}
              onChange={(v) => onChange({ max_iterations: v ?? undefined })}
              addonAfter="итераций"
              style={{ width: 180 }}
            />
          )}
        </Space>
      </Form.Item>
      <Form.Item>
        <Button danger onClick={onDelete}>
          Удалить стрелку
        </Button>
      </Form.Item>
    </Form>
  );
}

// ──────────────────────────────────────────────────────────────────────
// v2 ↔ RF conversion

function v2ToRf(graph: ScenarioGraphV2): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (graph.nodes ?? []).map((n) => {
    const base: Node = {
      id: n.id,
      position: n.position ?? { x: 0, y: 0 },
      data: {
        ...(n.data ?? {}),
        _category: n.type,
        label:
          (n.data as { element_label?: string; label?: string } | undefined)
            ?.label ??
          (n.data as { element_label?: string } | undefined)?.element_label ??
          labelForCategory(n.type),
      },
    };
    // Activate the custom shape only for categories that have a
    // matching React Flow node type registered. Every other category
    // still renders as RF's default rectangle — same baseline that
    // was confirmed working in /rf-test.
    if (n.type in SCENARIO_NODE_TYPES) {
      base.type = n.type;
    }
    return base;
  });
  const edges: Edge[] = (graph.edges ?? []).map((e) => {
    const d = e.data ?? {};
    // Per-edge handle IDs are stored in data with an underscore
    // prefix (same convention as node category). For legacy edges
    // that pre-date side handles we default to bottom→top, the
    // single source/target the editor used to render — keeps old
    // scenarios looking the way they always did.
    const sourceHandle =
      (d._sourceHandle as string | undefined) ?? "b";
    const targetHandle =
      (d._targetHandle as string | undefined) ?? "t";
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle,
      targetHandle,
      label: (d.label as string | undefined) ?? undefined,
      data: d,
    };
  });
  return { nodes, edges };
}

function rfToV2(nodes: Node[], edges: Edge[], version: 2): ScenarioGraphV2 {
  return {
    version,
    nodes: nodes.map<GraphNode>((n) => {
      const d = (n.data ?? {}) as Record<string, unknown>;
      const category = (d._category as GraphNodeType) ?? "action";
      // Strip the internal ``_category`` and ``label`` fields out of
      // the stored data so they don't pile up alongside the real
      // semantic fields.
      const cleanData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(d)) {
        if (k === "_category") continue;
        cleanData[k] = v;
      }
      return {
        id: n.id,
        type: category,
        position: n.position ?? { x: 0, y: 0 },
        data: cleanData,
      };
    }),
    edges: edges.map<GraphEdge>((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      data: {
        ...(e.data ?? {}),
        label:
          (e.data?.label as string | undefined) ??
          (typeof e.label === "string" ? e.label : undefined),
        // Persist which side of the node the user dragged from so
        // re-hydrating the graph (or reloading from the server)
        // doesn't snap edges back to bottom→top.
        _sourceHandle: e.sourceHandle ?? undefined,
        _targetHandle: e.targetHandle ?? undefined,
      },
    })),
  };
}

function labelForCategory(c: GraphNodeType): string {
  return (
    CATEGORY_OPTIONS.find((o) => o.value === c)?.label ?? c
  );
}

// Used by the parent to know we still need this import despite not
// rendering the API client directly here yet — keeps tree-shaking
// happy and lets the dictionary integration come back later without
// import churn.
void listScenarioShapes;
void useQuery;
