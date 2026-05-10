/**
 * Frontend graph validator (PER-84).
 *
 * Runs synchronously on each save attempt + lights up error pills in
 * the editor. The backend has its own loose schema-level checks (no
 * two start/end nodes), but anything semantic — dangling actions,
 * unreachable subgraphs, loops without an exit — lives here so the
 * user gets feedback while editing instead of after a 400.
 */

import type { GraphEdge, GraphNode, ScenarioGraphV2 } from "./types";

export type Severity = "error" | "warning";

export interface ValidationIssue {
  severity: Severity;
  /** ``node:<id>`` or ``edge:<id>`` or ``graph`` for global issues. */
  target: string;
  /** Human-friendly message in Russian — surfaced directly in the UI. */
  message: string;
}

/** Walk the graph from start, return every reachable node id. */
function reachable(nodes: GraphNode[], edges: GraphEdge[]): Set<string> {
  const start = nodes.find((n) => n.type === "start");
  if (!start) return new Set();
  const out = new Map<string, string[]>();
  for (const e of edges) {
    const list = out.get(e.source) ?? [];
    list.push(e.target);
    out.set(e.source, list);
  }
  const seen = new Set<string>([start.id]);
  const queue: string[] = [start.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const target of out.get(id) ?? []) {
      if (!seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return seen;
}

/**
 * Detect every directed cycle in the graph. By default a scenario
 * must be acyclic — the agent walks from start to end and shouldn't
 * loop back. The exception is a back-edge explicitly marked with
 * ``data.loop = true``: those represent intended retry / repeat
 * structures and the worker tracks them with a max-iterations cap.
 *
 * Returns the set of node ids that participate in an unmarked
 * cycle. The editor uses this to highlight the offending vertices.
 */
function findUnmarkedCycleNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Set<string> {
  const ids = nodes.map((n) => n.id);
  // Adjacency restricted to NON-loop edges. A cycle that involves at
  // least one ``loop=true`` edge is allowed by design — the worker
  // counts iterations and bails after max_iterations.
  const out = new Map<string, string[]>();
  for (const e of edges) {
    if (e.data?.loop) continue;
    const list = out.get(e.source) ?? [];
    list.push(e.target);
    out.set(e.source, list);
  }

  // Standard Tarjan SCC over the loop-edge-stripped graph: any SCC
  // larger than one node, or a one-node SCC that has a self-edge,
  // is a real cycle in the strict scenario.
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  let counter = 0;
  const offending = new Set<string>();

  const strongconnect = (v: string): void => {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of out.get(v) ?? []) {
      if (!index.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }
    if (low.get(v) === index.get(v)) {
      const component: string[] = [];
      let w: string | undefined;
      do {
        w = stack.pop();
        if (w !== undefined) {
          onStack.delete(w);
          component.push(w);
        }
      } while (w !== undefined && w !== v);
      const isCycle =
        component.length > 1 ||
        (component.length === 1 &&
          (out.get(component[0]) ?? []).includes(component[0]));
      if (isCycle) {
        for (const m of component) offending.add(m);
      }
    }
  };

  for (const id of ids) {
    if (!index.has(id)) strongconnect(id);
  }
  return offending;
}

/**
 * Detect strongly-connected components that don't have an exit edge
 * leading to a node outside the component. Such SCCs are infinite
 * loops at runtime.
 */
function findLoopsWithoutExit(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Set<string> {
  const ids = nodes.map((n) => n.id);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const out = new Map<string, string[]>();
  for (const e of edges) {
    const list = out.get(e.source) ?? [];
    list.push(e.target);
    out.set(e.source, list);
  }

  // Tarjan's SCC.
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  let counter = 0;
  const sccs: string[][] = [];

  const strongconnect = (v: string): void => {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of out.get(v) ?? []) {
      if (!index.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }
    if (low.get(v) === index.get(v)) {
      const component: string[] = [];
      let w: string | undefined;
      do {
        w = stack.pop();
        if (w !== undefined) {
          onStack.delete(w);
          component.push(w);
        }
      } while (w !== undefined && w !== v);
      sccs.push(component);
    }
  };

  for (const id of ids) {
    if (!index.has(id)) strongconnect(id);
  }

  // SCCs of size > 1, or a single node with a self-edge, qualify as
  // cycles. A cycle is "without exit" if every outgoing edge from
  // every member targets another member of the same component.
  const offending = new Set<string>();
  for (const comp of sccs) {
    if (comp.length === 1) {
      const only = comp[0];
      const hasSelfLoop = (out.get(only) ?? []).includes(only);
      if (!hasSelfLoop) continue;
    }
    const set = new Set(comp);
    let hasExit = false;
    for (const member of comp) {
      for (const target of out.get(member) ?? []) {
        if (!set.has(target)) {
          hasExit = true;
          break;
        }
      }
      if (hasExit) break;
    }
    if (!hasExit) {
      // The component is the offending cycle. Flag every member.
      for (const m of comp) offending.add(m);
    }
  }
  void idx;
  return offending;
}

/**
 * Run all checks. Returns the full list of issues — empty list means
 * the graph is shippable. The editor surfaces these in a banner so
 * the user can address them before saving.
 */
export function validateGraph(graph: ScenarioGraphV2): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { nodes, edges } = graph;

  // Cardinality: exactly one start and one end.
  const starts = nodes.filter((n) => n.type === "start");
  const ends = nodes.filter((n) => n.type === "end");
  if (starts.length === 0) {
    issues.push({
      severity: "error",
      target: "graph",
      message: "В графе нет начального узла (Начало).",
    });
  } else if (starts.length > 1) {
    issues.push({
      severity: "error",
      target: "graph",
      message: `В графе несколько узлов «Начало» (${starts.length}). Должен быть ровно один.`,
    });
  }
  if (ends.length === 0) {
    issues.push({
      severity: "error",
      target: "graph",
      message: "В графе нет конечного узла (Конец).",
    });
  } else if (ends.length > 1) {
    issues.push({
      severity: "error",
      target: "graph",
      message: `В графе несколько узлов «Конец» (${ends.length}). Должен быть ровно один.`,
    });
  }

  // Outgoing-edge counters.
  const outCount = new Map<string, number>();
  const inCount = new Map<string, number>();
  for (const n of nodes) {
    outCount.set(n.id, 0);
    inCount.set(n.id, 0);
  }
  for (const e of edges) {
    outCount.set(e.source, (outCount.get(e.source) ?? 0) + 1);
    inCount.set(e.target, (inCount.get(e.target) ?? 0) + 1);
  }

  for (const n of nodes) {
    // Group nodes are pure visual containers — they don't participate
    // in execution, so the runtime checks below don't apply.
    if (n.type === "group") continue;
    // Each non-end node must have at least one outgoing edge.
    if (n.type !== "end" && (outCount.get(n.id) ?? 0) === 0) {
      issues.push({
        severity: "error",
        target: `node:${n.id}`,
        message: `Узел «${labelFor(n)}» не имеет исходящего перехода.`,
      });
    }
    // Each non-start node should be reachable (we'll re-check below
    // via BFS — but a missing in-edge is the cheap pre-check).
    if (
      n.type !== "start" &&
      (inCount.get(n.id) ?? 0) === 0
    ) {
      issues.push({
        severity: "warning",
        target: `node:${n.id}`,
        message: `Узел «${labelFor(n)}» не достижим из «Начало» (нет входящих рёбер).`,
      });
    }
    // Decision nodes need at least 2 outgoing edges to be useful.
    if (n.type === "decision" && (outCount.get(n.id) ?? 0) < 2) {
      issues.push({
        severity: "warning",
        target: `node:${n.id}`,
        message: `Узел «Условие» имеет меньше двух исходящих переходов — ветвление работает только при ≥2 рёбрах.`,
      });
    }
    // A decision must have at least one default branch (no condition)
    // — otherwise unmatched runs hit a hard step_failed.
    if (n.type === "decision") {
      const outgoing = edges.filter((e) => e.source === n.id);
      const hasDefault = outgoing.some(
        (e) => !((e.data?.condition ?? "") as string).trim(),
      );
      if (outgoing.length > 0 && !hasDefault) {
        issues.push({
          severity: "error",
          target: `node:${n.id}`,
          message: `У узла «Условие» нет ветки «иначе» (хотя бы одно ребро без условия).`,
        });
      }
    }
  }

  // BFS reachability — flags nodes that are not reachable from start
  // even though they may have incoming edges (in a disconnected
  // sub-component).
  const seen = reachable(nodes, edges);
  for (const n of nodes) {
    if (!seen.has(n.id) && n.type !== "start") {
      // Only emit when not already covered by the in-edge check.
      const alreadyFlagged = issues.some(
        (i) => i.target === `node:${n.id}` && i.severity === "warning",
      );
      if (!alreadyFlagged) {
        issues.push({
          severity: "warning",
          target: `node:${n.id}`,
          message: `Узел «${labelFor(n)}» не достижим из «Начало».`,
        });
      }
    }
  }

  // Cycles without an explicit back-edge marker. The runtime would
  // either loop forever or rely on the worker's safety cap to stop —
  // both are surprises we'd rather flag at edit time.
  const inCycle = findUnmarkedCycleNodes(nodes, edges);
  const flagged = new Set<string>();
  for (const id of inCycle) {
    if (flagged.has(id)) continue;
    flagged.add(id);
    const n = nodes.find((x) => x.id === id);
    issues.push({
      severity: "error",
      target: `node:${id}`,
      message: `Узел «${labelFor(n!)}» участвует в цикле. Если это намеренно — отметьте обратную стрелку «back-edge» в редакторе стрелки.`,
    });
  }

  // Even cycles WITH a back-edge still need an exit — otherwise the
  // worker spends max_iterations runs and gives up. Keep the existing
  // SCC-without-exit check for that case.
  const noExit = findLoopsWithoutExit(nodes, edges);
  for (const id of noExit) {
    if (inCycle.has(id)) continue; // already flagged as unmarked cycle
    const n = nodes.find((x) => x.id === id);
    issues.push({
      severity: "error",
      target: `node:${id}`,
      message: `Узел «${labelFor(n!)}» в цикле без выхода — добавьте ветку, которая выводит из цикла.`,
    });
  }

  // Sub-scenario nodes need a linked scenario.
  for (const n of nodes) {
    if (n.type === "sub_scenario") {
      const id = (n.data as { linked_scenario_id?: string })?.linked_scenario_id;
      if (!id) {
        issues.push({
          severity: "error",
          target: `node:${n.id}`,
          message: `У узла «Связанный сценарий» не выбран целевой сценарий.`,
        });
      }
    }
  }

  return issues;
}

function labelFor(n: GraphNode): string {
  if (n.type === "start") return "Начало";
  if (n.type === "end") return "Конец";
  if (n.type === "group") {
    const d = n.data as { label?: string };
    return d.label ? `Группа: ${d.label}` : "Группа";
  }
  if (n.type === "sub_scenario") {
    const d = n.data as { linked_scenario_title?: string };
    return d.linked_scenario_title
      ? `Связанный: ${d.linked_scenario_title}`
      : "Связанный сценарий";
  }
  if (n.type === "decision") return "Условие";
  if (n.type === "wait") return "Пауза";
  if (n.type === "screen_check") return "Проверка экрана";
  if (n.type === "loop_back") return "Возврат";
  const data = n.data as { element_label?: string; label?: string };
  return data.element_label || data.label || n.id;
}
