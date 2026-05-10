/**
 * Frontend types for the v2 scenario graph (PER-79 / PER-80).
 *
 * The on-the-wire JSON shape is mirrored from
 * ``app/schemas/scenario_graph.py`` on the backend. Pydantic validates
 * the same fields server-side; this module mostly exists so the
 * editor + node components have something to lean on.
 */

export type GraphNodeType =
  | "start"
  | "end"
  | "action"
  | "decision"
  | "wait"
  | "screen_check"
  | "loop_back";

export interface GraphPosition {
  x: number;
  y: number;
}

export type ActionVerb = "tap" | "input" | "swipe" | "wait" | "assert" | "back";

/** Payload carried by an action node — same fields the legacy
 *  ``ScenarioStep`` had. ``screen_description`` is added by PER-85.
 *  Index signature lets the type slot into ``Record<string, unknown>``
 *  slots in React Flow's typings without explicit casts everywhere. */
export interface ActionNodeData {
  action: ActionVerb;
  element_label: string;
  value?: string;
  expected_result?: string;
  /** Legacy free-text screen identifier — kept for backward compat. */
  screen_name?: string;
  /** PER-85 (planned): free-form description of the screen the worker
   *  should be on before this action runs. */
  screen_description?: string;
  [key: string]: unknown;
}

export interface DecisionNodeData {
  /** Optional human label for the diamond. */
  label?: string;
  [key: string]: unknown;
}

export interface WaitNodeData {
  /** Milliseconds to wait. */
  ms?: number;
  [key: string]: unknown;
}

export interface ScreenCheckNodeData {
  /** Free-form description that the worker matches against the live
   *  screen via LLM (PER-85). */
  screen_description?: string;
  [key: string]: unknown;
}

export interface LoopBackNodeData {
  /** Hard cap on iterations across the back-edge. PER-84 wires this
   *  into the worker. */
  max_iterations?: number;
  [key: string]: unknown;
}

export type NodeData =
  | ActionNodeData
  | DecisionNodeData
  | WaitNodeData
  | ScreenCheckNodeData
  | LoopBackNodeData
  | Record<string, unknown>; // start/end carry no data

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  position: GraphPosition;
  data: NodeData;
}

export interface GraphEdgeData {
  /** PER-83: condition expression evaluated to pick the edge from a
   *  decision node. ``"default"`` (or empty) marks the fallback. */
  condition?: string;
  label?: string;
  branch?: "true" | "false" | "default" | string;
  /** PER-84: marks a back-edge (cycles must use this so the worker can
   *  count iterations and refuse to spin). */
  loop?: boolean;
  [key: string]: unknown;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  data?: GraphEdgeData;
}

export interface ScenarioGraphV2 {
  version: 2;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Minimal valid graph: just the start and end nodes, one edge between
 *  them. Used as the seed for a brand-new scenario. */
export function emptyGraph(): ScenarioGraphV2 {
  return {
    version: 2,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
      { id: "end", type: "end", position: { x: 0, y: 240 }, data: {} },
    ],
    edges: [
      { id: "e_start_end", source: "start", target: "end", data: {} },
    ],
  };
}

/**
 * Coerce any legacy or partial payload into a valid v2 graph.
 *
 * Mirrors backend ``normalize()`` so the editor never has to deal with
 * v1 shapes even if the API returns one (e.g. mid-deploy race).
 *
 * Inputs accepted:
 *  - already v2 ({ nodes, edges, ... })
 *  - v1 ({ steps: [...] })
 *  - empty / undefined / unknown → empty graph
 */
export function normalizeGraph(input: unknown): ScenarioGraphV2 {
  if (
    input &&
    typeof input === "object" &&
    Array.isArray((input as { nodes?: unknown }).nodes) &&
    Array.isArray((input as { edges?: unknown }).edges)
  ) {
    const obj = input as ScenarioGraphV2;
    return {
      version: 2,
      nodes: obj.nodes.map((n) => ({
        id: String(n.id),
        type: n.type,
        position: n.position ?? { x: 0, y: 0 },
        data: n.data ?? {},
      })),
      edges: obj.edges.map((e) => ({
        id: String(e.id),
        source: String(e.source),
        target: String(e.target),
        data: e.data ?? {},
      })),
    };
  }

  // v1 fallback
  const v1Steps =
    input &&
    typeof input === "object" &&
    Array.isArray((input as { steps?: unknown }).steps)
      ? ((input as { steps: unknown[] }).steps as Record<string, unknown>[])
      : [];

  const nodes: GraphNode[] = [
    { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
  ];
  const edges: GraphEdge[] = [];
  let prev = "start";
  v1Steps.forEach((step, idx) => {
    const id = `n${idx}`;
    nodes.push({
      id,
      type: "action",
      position: { x: 0, y: (idx + 1) * 120 },
      data: (step as ActionNodeData) ?? {},
    });
    edges.push({ id: `e_${prev}_${id}`, source: prev, target: id, data: {} });
    prev = id;
  });
  nodes.push({
    id: "end",
    type: "end",
    position: { x: 0, y: (v1Steps.length + 1) * 120 },
    data: {},
  });
  edges.push({ id: `e_${prev}_end`, source: prev, target: "end", data: {} });

  return { version: 2, nodes, edges };
}

/** Action verbs displayed in the palette + node editor. */
export const ACTION_VERBS: { value: ActionVerb; label: string }[] = [
  { value: "tap", label: "👆 Нажать" },
  { value: "input", label: "⌨️ Ввести" },
  { value: "swipe", label: "👉 Свайп" },
  { value: "wait", label: "⏳ Ждать" },
  { value: "assert", label: "✅ Проверить" },
  { value: "back", label: "↩ Назад" },
];

/** Generates a short, monotonic node id. UUID4 is overkill on the
 *  client and the backend doesn't care about format. */
export function newNodeId(prefix: string = "n"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}
