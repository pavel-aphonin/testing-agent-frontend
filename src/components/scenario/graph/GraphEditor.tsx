/**
 * Visual scenario graph editor.
 *
 * Miro-/Lucidchart-style canvas:
 *  - Empty canvas starts with a centred "add the first node" CTA.
 *  - Drag from a node's handle into empty space → a floating shape
 *    picker pops up at the drop location → choosing a shape creates
 *    that node + the connecting edge in one gesture.
 *  - Drag from a handle directly onto another node's handle → just
 *    the edge is added (standard React Flow behaviour).
 *  - Click a node or edge → right-side editor drawer.
 *  - Selected non-start/end node + Delete/Backspace → removes node
 *    plus incident edges.
 *
 * The component is fully controlled: parent passes the v2 graph in
 * `value` and receives a fresh graph in `onChange`. Position changes
 * (drag inside canvas) flow through the same onChange so the parent's
 * dirty-flag tracks layout edits too.
 */

import {
  ApartmentOutlined,
  BlockOutlined,
  ClusterOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Alert,
  AutoComplete,
  Button,
  Drawer,
  Empty,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useThemeStore } from "@/store/theme";

import { useQuery } from "@tanstack/react-query";

import { listScenarioShapes } from "@/api/scenarioShapes";
import type { ScenarioShapeRead } from "@/types";

import { autoLayout } from "./autoLayout";
import { SCENARIO_NODE_TYPES, getIconNode } from "./nodes";
import {
  newNodeId,
  type ActionNodeData,
  type GraphEdge,
  type GraphNode,
  type GraphNodeType,
  type ScenarioGraphV2,
} from "./types";
import { useScenarioDictionaries, type DictItem } from "./useScenarioDictionaries";
import { validateGraph, type ValidationIssue } from "./validate";

// ──────────────────────────────────────────────────────────────────────

interface Props {
  value: ScenarioGraphV2;
  onChange: (next: ScenarioGraphV2) => void;
  /** Variables available for {{test_data.X}} autocomplete in input/value
   *  fields. Optional — when omitted, plain Input is used. */
  variables?: { key: string; value?: string }[];
  /** All other scenarios in the workspace (for sub_scenario links).
   *  When undefined, sub_scenario nodes are still creatable but the
   *  link picker shows an empty list. */
  allScenarios?: { id: string; title: string }[];
  /** Id of the scenario currently being edited — excluded from the
   *  sub_scenario picker so it can't reference itself. */
  currentScenarioId?: string;
  /** Active workspace id — used to look up custom dictionaries that
   *  feed the action / element pickers. When omitted the editor falls
   *  back to its hardcoded option set. */
  workspaceId?: string | null;
  height?: number;
}

/** Picker / palette item — derived from the scenario_shapes
 *  dictionary at runtime. The category is used as React Flow's
 *  ``node.type`` so the runtime renderer dispatches to the right
 *  geometry component, and ``code`` is stored in ``data.shape_code``
 *  for backend resolution. */
interface ShapeItem {
  code: string;
  category: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
}

/** Build the default ``data`` payload for a freshly-added node from
 *  the shape's attribute schema — every attribute with a ``default``
 *  becomes a starting value, the rest stay unset. The action verb
 *  is also seeded from ``shape.action_code`` so the worker has
 *  something to dispatch on if the user saves without editing. */
function defaultDataForShape(
  shape: ScenarioShapeRead | undefined,
): Record<string, unknown> {
  if (!shape) return {};
  const data: Record<string, unknown> = { shape_code: shape.code };
  for (const attr of shape.attributes ?? []) {
    if (attr.default !== undefined && attr.default !== null) {
      data[attr.key] = attr.default;
    }
  }
  if (shape.category === "action" && shape.action_code && !data.action) {
    data.action = shape.action_code;
  }
  return data;
}

// ──────────────────────────────────────────────────────────────────────

// Outer wrapper exposes a ReactFlowProvider so the inner component can
// call ``useReactFlow`` for screen↔flow coordinate conversion. Without
// this wrapper the hook throws — the React Flow context is only set
// up inside <ReactFlowProvider> or below a <ReactFlow> render.
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
  workspaceId,
  height = 600,
}: Props) {
  const { token } = theme.useToken();
  const themeMode = useThemeStore((s) => s.resolved);
  const rfApi = useReactFlow();
  // Workspace dictionaries — when available, the action node form
  // uses these instead of hardcoded options so admins can extend
  // the picker without a code change.
  const dicts = useScenarioDictionaries(workspaceId ?? null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // PER-90: shape palette comes from the scenario_shapes dictionary,
  // not a hardcoded array. Built-ins are seeded by the backend so
  // this list is never empty in practice.
  const shapesQ = useQuery({
    queryKey: ["scenario-shapes"],
    queryFn: listScenarioShapes,
    staleTime: 5 * 60_000,
  });
  const shapes = shapesQ.data ?? [];
  const shapeByCode = useMemo(() => {
    const m = new Map<string, ScenarioShapeRead>();
    for (const s of shapes) m.set(s.code, s);
    return m;
  }, [shapes]);
  const shapeItems: ShapeItem[] = useMemo(
    () =>
      shapes
        .slice()
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order || a.name.localeCompare(b.name),
        )
        .map((s) => ({
          code: s.code,
          category: s.category,
          label: s.name,
          hint: s.description ?? "",
          icon: getIconNode(s.icon),
        })),
    [shapes],
  );

  // Tracks the source of an in-progress drag from a handle. Set on
  // onConnectStart, cleared on onConnectEnd. We also stash the
  // initial mouse coords so onConnectEnd can tell a deliberate
  // drag (mouse moved >= a few pixels) from a "just a click on the
  // handle" gesture (no movement) — clicks auto-place the next
  // node in the handle's direction without forcing the user to
  // drag a line.
  const connectStartRef = useRef<{
    nodeId: string;
    handleId?: string | null;
    startX: number;
    startY: number;
  } | null>(null);

  // Floating shape picker. ``screenX/Y`` are viewport coords for the
  // popup placement; ``flowX/Y`` are graph coords for the new node.
  // ``sourceId`` is set when invoked from a drag-from-handle drop;
  // null when invoked from the empty-canvas CTA (first node).
  const [picker, setPicker] = useState<
    | {
        screenX: number;
        screenY: number;
        flowX: number;
        flowY: number;
        sourceId: string | null;
        sourceHandle: string | null;
      }
    | null
  >(null);
  // Mode for the help drawer (step 6).
  const [helpOpen, setHelpOpen] = useState(false);

  // React Flow expects its own Node/Edge shape. We keep our v2 model
  // as the source of truth and translate on each render — cheap, and
  // saves us from writing diff-detection code.
  const rfNodes: Node[] = useMemo(
    () =>
      value.nodes.map((n) => {
        const rfNode: Node = {
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data as Record<string, unknown>,
          // start + end are not deletable to keep the graph well-formed.
          deletable: n.type !== "start" && n.type !== "end",
        };
        if (n.parentId) {
          // PER-86 followup: ``parentId`` makes React Flow render this
          // node inside the named group's bounds. ``extent: "parent"``
          // confines drag movements to the group.
          rfNode.parentId = n.parentId;
          rfNode.extent = "parent";
        }
        if (n.type === "group") {
          // Group nodes need an explicit width/height for React Flow
          // to size the container. ``selectable`` so the user can
          // open the editor; ``draggable`` for repositioning the
          // whole group at once.
          rfNode.style = {
            width: n.width ?? 320,
            height: n.height ?? 200,
          };
          rfNode.zIndex = -1; // children sit on top
        }
        return rfNode;
      }),
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
      // PER-86 followup: react-flow doesn't bubble parentId changes
      // through NodeChange; we do the parent-detection ourselves on
      // every drag-stop. A node sitting fully inside a group's bbox
      // becomes a child of that group; a node dragged outside its
      // current group bbox becomes top-level again.
      const groupRects = next
        .filter((n) => n.type === "group")
        .map((g) => {
          const style = (g as Node & { style?: { width?: number; height?: number } }).style;
          const w = (style?.width as number | undefined) ?? 320;
          const h = (style?.height as number | undefined) ?? 200;
          return {
            id: g.id,
            x: g.position?.x ?? 0,
            y: g.position?.y ?? 0,
            w,
            h,
          };
        });
      const inside = (
        nx: number,
        ny: number,
        rect: (typeof groupRects)[number],
      ): boolean =>
        nx >= rect.x &&
        nx <= rect.x + rect.w &&
        ny >= rect.y &&
        ny <= rect.y + rect.h;

      onChange({
        ...value,
        nodes: next.map<GraphNode>((n) => {
          const original = value.nodes.find((x) => x.id === n.id);
          // For non-group nodes look at where they are relative to
          // every existing group. Smallest enclosing group wins.
          // ``parentId`` carries through React Flow as-is once set,
          // but we still want to recompute it to allow drag-out.
          let parentId: string | null = null;
          if (n.type !== "group") {
            // React Flow positions of children with parentId are
            // RELATIVE to the parent. We need absolute positions for
            // the inside-test, so add the parent offset back.
            const rfParentId =
              (n as Node & { parentId?: string }).parentId ?? null;
            const parentRect = rfParentId
              ? groupRects.find((g) => g.id === rfParentId)
              : null;
            const absX = (n.position?.x ?? 0) + (parentRect?.x ?? 0);
            const absY = (n.position?.y ?? 0) + (parentRect?.y ?? 0);
            for (const g of groupRects) {
              if (inside(absX, absY, g)) {
                parentId = g.id;
                break;
              }
            }
          }
          const out: GraphNode = {
            id: n.id,
            type: (n.type ?? original?.type ?? "action") as GraphNodeType,
            position: n.position ?? original?.position ?? { x: 0, y: 0 },
            data: (n.data ?? original?.data ?? {}) as Record<string, unknown>,
          };
          if (parentId) out.parentId = parentId;
          if (original?.width) out.width = original.width;
          if (original?.height) out.height = original.height;
          return out;
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

  // ────────────────────────── Drag-to-create handlers
  // React Flow's connect lifecycle:
  //   * onConnectStart fires when the user grabs a handle. We capture
  //     the source so we can use it later if the drop misses any
  //     real target.
  //   * onConnectEnd fires once at the end of the gesture, regardless
  //     of where the cursor went. If the drop landed on another
  //     handle, ``onConnect`` already handled the wiring; we detect
  //     "fell into empty pane" by inspecting the event target.

  const handleConnectStart = useCallback<
    NonNullable<React.ComponentProps<typeof ReactFlow>["onConnectStart"]>
  >((event, params) => {
    // PER-86 followup: with ``connectionMode="loose"`` users can grab
    // any handle (source OR target) and drag from it. We capture the
    // node id regardless of handleType so the drag-into-empty-pane
    // flow can wire an outgoing edge from this node.
    const nativeEvent = (event as unknown as { clientX?: number; clientY?: number; touches?: TouchList });
    const startX =
      nativeEvent.touches && nativeEvent.touches.length > 0
        ? nativeEvent.touches[0].clientX
        : nativeEvent.clientX ?? 0;
    const startY =
      nativeEvent.touches && nativeEvent.touches.length > 0
        ? nativeEvent.touches[0].clientY
        : nativeEvent.clientY ?? 0;
    if (params.nodeId) {
      connectStartRef.current = {
        nodeId: params.nodeId,
        handleId: params.handleId ?? null,
        startX,
        startY,
      };
    } else {
      connectStartRef.current = null;
    }
  }, []);

  const handleConnectEnd = useCallback<
    NonNullable<React.ComponentProps<typeof ReactFlow>["onConnectEnd"]>
  >(
    (event, connectionState) => {
      const start = connectStartRef.current;
      connectStartRef.current = null;
      if (!start) return;
      // React Flow v12 hands us the final connection state — if the
      // drop landed on a real target handle, ``isValid`` is true and
      // ``onConnect`` already created the edge.
      if (connectionState && connectionState.isValid) return;
      const toNode =
        (connectionState as { toNode?: unknown } | undefined)?.toNode;
      if (toNode) return;

      // Resolve the cursor's release coords (mouse OR touch).
      const point =
        "touches" in event && (event as TouchEvent).touches.length > 0
          ? {
              x: (event as TouchEvent).touches[0].clientX,
              y: (event as TouchEvent).touches[0].clientY,
            }
          : "changedTouches" in event &&
            (event as TouchEvent).changedTouches.length > 0
          ? {
              x: (event as TouchEvent).changedTouches[0].clientX,
              y: (event as TouchEvent).changedTouches[0].clientY,
            }
          : {
              x: (event as MouseEvent).clientX,
              y: (event as MouseEvent).clientY,
            };

      // Click vs drag: if the cursor barely moved, treat it as a
      // click on the handle and auto-place the next node in the
      // handle's direction. Drag (movement >= 8 px) keeps the old
      // "drop wherever" behaviour.
      const moved = Math.hypot(
        point.x - start.startX,
        point.y - start.startY,
      );
      const wasClick = moved < 8;

      let flow: { x: number; y: number };
      let screen: { x: number; y: number };

      if (wasClick) {
        // Place the new node a fixed distance from the source's
        // edge in the direction of the clicked handle. Source-node
        // position is the top-left, so we add half-width/half-height
        // to start from its centre.
        const source = value.nodes.find((n) => n.id === start.nodeId);
        if (!source) return;
        const NODE_HALF_W = 90;
        const NODE_HALF_H = 50;
        const STEP_H = 240;
        const STEP_V = 200;
        const dirOffset: Record<string, { x: number; y: number }> = {
          t: { x: 0, y: -STEP_V },
          r: { x: STEP_H, y: 0 },
          b: { x: 0, y: STEP_V },
          l: { x: -STEP_H, y: 0 },
          // Decision's left/right semantic handles use these ids:
          true: { x: STEP_H, y: 80 },
          false: { x: -STEP_H, y: 80 },
        };
        const off = dirOffset[start.handleId ?? "b"] ?? dirOffset.b;
        flow = {
          x: (source.position?.x ?? 0) + NODE_HALF_W + off.x,
          y: (source.position?.y ?? 0) + NODE_HALF_H + off.y,
        };
        // For the picker popup we need viewport coords too so the
        // floating menu lands near where the user is looking.
        const screenPos = rfApi.flowToScreenPosition?.(flow);
        screen = screenPos
          ? { x: screenPos.x, y: screenPos.y }
          : { x: point.x, y: point.y };
      } else {
        flow = rfApi.screenToFlowPosition(point);
        screen = { x: point.x, y: point.y };
      }

      setPicker({
        screenX: screen.x,
        screenY: screen.y,
        flowX: flow.x,
        flowY: flow.y,
        sourceId: start.nodeId,
        sourceHandle: start.handleId ?? null,
      });
    },
    [rfApi, value.nodes],
  );

  // Empty-canvas first-node CTA: when the user clicks the centre of
  // an empty pane we open the picker without a source so the chosen
  // shape is added free-floating.
  const openEmptyPicker = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const flow = rfApi.screenToFlowPosition({ x: cx, y: cy });
    setPicker({
      screenX: cx,
      screenY: cy,
      flowX: flow.x,
      flowY: flow.y,
      sourceId: null,
      sourceHandle: null,
    });
  }, [rfApi]);

  /**
   * Create a node at the given graph-coordinate position. When
   * ``sourceId`` is provided, also wire a fresh edge from that
   * source to the new node — used by the drag-to-empty-pane flow.
   *
   * Refuses to create a second start node (only one start is valid).
   * Centers the node on the supplied position so the cursor lands in
   * its middle (more natural feel than offsetting away).
   */
  const addNodeAt = useCallback(
    (
      shapeCode: string,
      flowPos: { x: number; y: number },
      sourceId: string | null,
      sourceHandle: string | null,
    ) => {
      const shape = shapeByCode.get(shapeCode);
      if (!shape) return;
      const category = shape.category as GraphNodeType;
      // Only one start per scenario.
      if (category === "start" && value.nodes.some((n) => n.type === "start")) {
        return;
      }
      const id = newNodeId(category[0]);
      const node: GraphNode = {
        id,
        // ``type`` drives React Flow's renderer dispatch — we route
        // it through the category so any shape with category="action"
        // uses the shared action-node renderer, etc.
        type: category,
        position: { x: flowPos.x - 80, y: flowPos.y - 24 },
        data: defaultDataForShape(shape),
      };
      const edges: GraphEdge[] = [...value.edges];
      if (sourceId) {
        edges.push({
          id: `e_${sourceId}_${id}`,
          source: sourceId,
          target: id,
          data: sourceHandle ? { branch: sourceHandle } : {},
        });
      }
      onChange({ ...value, nodes: [...value.nodes, node], edges });
      setSelectedId(id);
    },
    [value, onChange, shapeByCode],
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
      {/* Handle styling.
          - We never touch ``transform`` on the handle itself —
            React Flow positions handles via per-side translate(...)
            and overriding it shifts the visual dot away from its
            hit target.
          - Visible halo via box-shadow.
          - Invisible ``::before`` ring extends the pointer hit area
            to ~36×36 so a slightly off click still starts a drag.
          - ``::after`` shows a directional arrow on hover that
            points outward from the node — it doubles as a
            "click here to add a node in this direction" hint, and
            is purely visual (pointer-events: none). */}
      <style>{`
        .react-flow__node .react-flow__handle {
          opacity: 1;
          pointer-events: all;
          transition: box-shadow 120ms ease-out;
        }
        .react-flow__node .react-flow__handle::before {
          content: "";
          position: absolute;
          inset: -10px;
          border-radius: 50%;
          background: transparent;
        }
        .react-flow__node .react-flow__handle::after {
          position: absolute;
          color: #ee3424;
          font-size: 18px;
          font-weight: 800;
          line-height: 1;
          opacity: 0;
          pointer-events: none;
          transition: opacity 120ms;
          text-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
        .react-flow__node .react-flow__handle.react-flow__handle-top::after {
          content: "↑"; left: 50%; top: -22px; transform: translateX(-50%);
        }
        .react-flow__node .react-flow__handle.react-flow__handle-right::after {
          content: "→"; left: 22px; top: 50%; transform: translateY(-50%);
        }
        .react-flow__node .react-flow__handle.react-flow__handle-bottom::after {
          content: "↓"; left: 50%; bottom: -22px; transform: translateX(-50%);
        }
        .react-flow__node .react-flow__handle.react-flow__handle-left::after {
          content: "←"; right: 22px; top: 50%; transform: translateY(-50%);
        }
        .react-flow__node:hover .react-flow__handle {
          box-shadow:
            0 0 0 1.5px rgba(0,0,0,0.2),
            0 0 0 6px rgba(238, 52, 36, 0.22);
        }
        .react-flow__node:hover .react-flow__handle::after {
          opacity: 0.85;
        }
        .react-flow__handle.connectionindicator,
        .react-flow__handle {
          cursor: crosshair !important;
        }
      `}</style>

      {/* ─── Compact toolbar ─────────────────────────────────────
          The Miro-style canvas does most of the heavy lifting via
          drag-from-handle interactions, so the toolbar only carries
          two affordances: delete-selected (also bound to Backspace)
          and a "?" that opens the shape glossary. */}
      <Space wrap style={{ marginBottom: 8 }}>
        <Tooltip title="Подсказка по фигурам">
          <Button
            icon={<QuestionCircleOutlined />}
            size="small"
            onClick={() => setHelpOpen(true)}
          >
            Что есть что
          </Button>
        </Tooltip>
        <Tooltip title="Авторазложить узлы по сетке (dagre)">
          <Button
            icon={<ClusterOutlined />}
            size="small"
            onClick={() => onChange(autoLayout(value))}
            disabled={value.nodes.length === 0}
          >
            Авторазметка
          </Button>
        </Tooltip>
        <Tooltip title="Добавить группу — потом перетащите в неё узлы">
          <Button
            icon={<BlockOutlined />}
            size="small"
            onClick={() => {
              // Drop the group at the bottom of the existing layout
              // so it doesn't cover anything; addNodeAt handles the
              // shape lookup + default-data plumbing.
              const ys = value.nodes.map((n) => n.position?.y ?? 0);
              addNodeAt(
                "group",
                { x: 200, y: Math.max(...ys, 0) + 280 },
                null,
                null,
              );
            }}
          >
            Группа
          </Button>
        </Tooltip>
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
          <ApartmentOutlined /> Потяните мышью от точки на узле — там, где отпустите, появится выбор фигур.
        </Typography.Text>
      </Space>

      {/* ─── Validation banner ─────────────────────────────────── */}
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
        ref={canvasRef}
        style={{
          height,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          background: token.colorFillQuaternary,
          position: "relative",
        }}
      >
        <ReactFlow
          nodes={decoratedRfNodes}
          edges={rfEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectEnd}
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
            setPicker(null);
          }}
          nodeTypes={SCENARIO_NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          colorMode={themeMode}
          deleteKeyCode={null} /* handled manually so we can preserve start/end */
          // PER-88 followup: each node has handles on all four sides.
          // Loose mode lets a single ``type="source"`` handle act as
          // a connection target too — so the user can drag an arrow
          // IN or OUT from any side without us having to render
          // overlapping source+target dots per side.
          connectionMode={ConnectionMode.Loose}
          // Generous snap distance: the user doesn't need to land
          // exactly on the destination handle — coming within 32 px
          // counts. Combined with the handle's own ::before halo
          // this makes it almost impossible to miss.
          connectionRadius={32}
        >
          <Background />
          <Controls />
          {/* MiniMap is overkill for an empty canvas — hide until we
              actually have nodes to map. */}
          {value.nodes.length > 0 && (
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
          )}
        </ReactFlow>

        {/* Empty-canvas CTA. The user has to add SOMETHING before
            they can drag-to-create, so we offer one obvious entry
            point right at the centre of the empty pane. */}
        {value.nodes.length === 0 && !picker && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                pointerEvents: "auto",
                textAlign: "center",
                padding: 24,
                borderRadius: 12,
                background: token.colorBgElevated,
                border: `1px dashed ${token.colorBorder}`,
                maxWidth: 380,
              }}
            >
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span>
                    Холст пуст. Начните со «Старта» — потом потяните стрелку,
                    чтобы добавить следующий узел.
                  </span>
                }
              />
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={openEmptyPicker}
                style={{ marginTop: 8 }}
              >
                Добавить первый узел
              </Button>
            </div>
          </div>
        )}

        {/* Floating shape picker — appears at the drop position when
            the user releases a connect-drag in empty space, or in
            the canvas centre via the empty-state CTA. */}
        {picker && (
          <ShapePicker
            picker={picker}
            items={shapeItems}
            existingHasStart={value.nodes.some((n) => n.type === "start")}
            onPick={(code) => {
              addNodeAt(
                code,
                { x: picker.flowX, y: picker.flowY },
                picker.sourceId,
                picker.sourceHandle,
              );
              setPicker(null);
            }}
            onCancel={() => setPicker(null)}
          />
        )}
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
            allScenarios={allScenarios}
            currentScenarioId={currentScenarioId}
            actionOptions={dicts.actions}
            elementOptions={dicts.elements}
            hasElementsDict={dicts.hasElementsDict}
            onChange={handleSelectedDataChange}
          />
        )}
      </Drawer>

      {/* ─── Edge edit drawer ──────────────────────────────────── */}
      <Drawer
        open={selectedEdge !== null}
        onClose={() => setSelectedEdgeId(null)}
        width={420}
        title="Стрелка (переход)"
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

      {/* ─── Help drawer ───────────────────────────────────────── */}
      <Drawer
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        width={460}
        title="Подсказка по фигурам"
        destroyOnHidden
      >
        <ShapeHelp items={shapeItems} />
      </Drawer>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Shape picker — floating popup for the drag-to-create flow.

function ShapePicker({
  picker,
  items,
  existingHasStart,
  onPick,
  onCancel,
}: {
  picker: {
    screenX: number;
    screenY: number;
    flowX: number;
    flowY: number;
    sourceId: string | null;
    sourceHandle: string | null;
  };
  items: ShapeItem[];
  existingHasStart: boolean;
  onPick: (code: string) => void;
  onCancel: () => void;
}) {
  // The picker lives in viewport coords (position: fixed) so its
  // placement is straightforward — just use the captured screen
  // position. We also dim the rest of the canvas with a click-to-
  // dismiss backdrop so the user can opt out of the gesture.
  const { token } = theme.useToken();

  // Hide ``start`` from the picker when one already exists — only
  // one start is valid per scenario.
  const visible = items.filter((s) => {
    if (s.category === "start" && existingHasStart) return false;
    return true;
  });

  // Clamp horizontally so the menu doesn't fall off the viewport
  // edge for drops near the right.
  const left = Math.min(picker.screenX + 12, window.innerWidth - 240);
  const top = Math.min(picker.screenY - 8, window.innerHeight - 360);

  return (
    <>
      <div
        // Backdrop catches outside clicks; transparent so the canvas
        // is still visible underneath.
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999,
        }}
      />
      <div
        style={{
          position: "fixed",
          top,
          left,
          zIndex: 1000,
          background: token.colorBgElevated,
          border: `1px solid ${token.colorBorder}`,
          borderRadius: 8,
          boxShadow: token.boxShadowSecondary,
          padding: 6,
          width: 240,
          maxHeight: 380,
          overflowY: "auto",
        }}
      >
        <Typography.Text
          type="secondary"
          style={{ fontSize: 11, padding: "2px 8px", display: "block" }}
        >
          Выберите фигуру
        </Typography.Text>
        {visible.map((s) => (
          <Tooltip key={s.code} title={s.hint} placement="right">
            <div
              role="button"
              onClick={() => onPick(s.code)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                cursor: "pointer",
                borderRadius: 6,
                fontSize: 13,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = token.colorFillTertiary)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>
                {s.icon}
              </span>
              <span>{s.label}</span>
            </div>
          </Tooltip>
        ))}
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
// In-app glossary — explains every shape so first-time users know
// what to pick. Surfaced via the "Что есть что" toolbar button.

function ShapeHelp({ items }: { items: ShapeItem[] }) {
  const { token } = theme.useToken();
  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        Сценарий — это диаграмма из узлов и стрелок. Агент идёт по
        стрелкам от «Начала» к «Концу», выполняя действия в узлах.
      </Typography.Paragraph>
      <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
        {items.map((s) => (
          <li
            key={s.code}
            style={{
              display: "flex",
              gap: 12,
              padding: "10px 0",
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <span
              style={{
                fontSize: 18,
                width: 28,
                textAlign: "center",
                color: token.colorPrimary,
              }}
            >
              {s.icon}
            </span>
            <div>
              <Typography.Text strong>{s.label}</Typography.Text>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {s.hint}
                </Typography.Text>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Typography.Paragraph
        type="secondary"
        style={{ fontSize: 12, marginTop: 12 }}
      >
        Соединить два узла — потяните мышью от точки на одном к точке на
        другом. Чтобы открыть редактор узла или стрелки — кликните по
        ним. Чтобы удалить выделенный узел — нажмите Backspace или
        кнопку «Удалить» в верхней панели.
      </Typography.Paragraph>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────

function NodeEditor({
  node,
  variables,
  allScenarios,
  currentScenarioId,
  actionOptions,
  elementOptions,
  hasElementsDict,
  onChange,
}: {
  node: GraphNode;
  variables?: { key: string; value?: string }[];
  allScenarios?: { id: string; title: string }[];
  currentScenarioId?: string;
  actionOptions: DictItem[];
  elementOptions: DictItem[];
  hasElementsDict: boolean;
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
            options={actionOptions}
          />
        </Form.Item>
        <Form.Item
          label="Элемент"
          extra={
            hasElementsDict
              ? "Подсказки берутся из справочника «Элементы UI»."
              : "Подсказок нет — заведите справочник с кодом ui_elements в разделе «Справочники», чтобы появился autocomplete."
          }
        >
          <AutoComplete
            value={d.element_label ?? ""}
            onChange={(v) => onChange({ element_label: v ?? "" })}
            options={elementOptions}
            placeholder="Кнопка, поле, переключатель..."
            filterOption={(input, option) =>
              (option?.label ?? "")
                .toString()
                .toLowerCase()
                .includes(input.toLowerCase())
            }
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
          extra="Опишите экран словами на любом языке. Если пусто — проверки нет; если заполнено, перед шагом агент сверится с реальным экраном."
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
          extra="Условия ветвления задаются на исходящих стрелках — кликните по стрелке для редактирования."
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
          extra="Агент сверит текущий экран с этим описанием перед тем, как продолжить."
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

  if (node.type === "group") {
    const d = node.data as { label?: string };
    return (
      <Form layout="vertical">
        <Form.Item
          label="Название группы"
          extra="Группа — это просто визуальный контейнер. Перетащите внутрь неё узлы, чтобы объединить смысловой блок."
        >
          <Input
            value={d.label ?? ""}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="например: Регистрация"
          />
        </Form.Item>
      </Form>
    );
  }

  if (node.type === "sub_scenario") {
    const d = node.data as {
      linked_scenario_id?: string;
      linked_scenario_title?: string;
    };
    const options = (allScenarios ?? [])
      .filter((s) => s.id !== currentScenarioId)
      .map((s) => ({ value: s.id, label: s.title || s.id.slice(0, 8) }));
    return (
      <Form layout="vertical">
        <Form.Item
          label="Сценарий, который нужно запустить"
          extra="Агент дойдёт до этого узла, выполнит выбранный сценарий целиком и вернётся, чтобы продолжить текущий."
        >
          <Select
            showSearch
            allowClear
            placeholder="Выберите сценарий"
            value={d.linked_scenario_id}
            optionFilterProp="label"
            options={options}
            onChange={(v) => {
              const picked = (allScenarios ?? []).find((s) => s.id === v);
              onChange({
                linked_scenario_id: v ?? undefined,
                linked_scenario_title: picked?.title ?? undefined,
              });
            }}
          />
        </Form.Item>
        {options.length === 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            В этом рабочем пространстве пока нет других сценариев. Создайте
            ещё один и вернитесь сюда — он появится в списке.
          </Typography.Text>
        )}
      </Form>
    );
  }

  return (
    <Typography.Text type="secondary">
      Узел этого типа — без редактируемых полей.
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
