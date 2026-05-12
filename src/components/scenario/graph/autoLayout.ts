/**
 * Dagre-driven auto-layout for the scenario graph.
 *
 * The user can keep nudging nodes by hand — but once a graph grows to
 * 10+ nodes manual placement is a chore. The "Auto-layout" toolbar
 * button feeds the current graph into dagre and rewrites positions in
 * one go. Edges and node payloads are left alone.
 *
 * We pick a top-down rank direction (TB) by default — scenarios read
 * from the start at the top to the end at the bottom. Per-shape size
 * estimates feed dagre so nodes don't overlap; values match what
 * ``nodes.tsx`` actually renders.
 */

import dagre from "dagre";

import type { GraphNode, ScenarioGraphV2 } from "./types";

const DEFAULT_SIZE = { w: 220, h: 80 };

const NODE_SIZES: Record<GraphNode["type"], { w: number; h: number }> = {
  start: { w: 84, h: 84 },
  end: { w: 84, h: 84 },
  action: { w: 220, h: 90 },
  decision: { w: 160, h: 96 },
  wait: { w: 160, h: 50 },
  screen_check: { w: 220, h: 70 },
  loop_back: { w: 160, h: 50 },
  sub_scenario: { w: 220, h: 80 },
  // Group containers don't shrink to dagre's grid — we leave them
  // big enough for typical content but they get laid out around
  // their own children separately when they have any.
  group: { w: 320, h: 200 },
  // PER-110: goal nodes carry a multi-line description so they tend
  // to be a bit taller than action nodes.
  goal: { w: 260, h: 110 },
};

export function autoLayout(graph: ScenarioGraphV2): ScenarioGraphV2 {
  if (graph.nodes.length === 0) return graph;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: 60,
    ranksep: 90,
    marginx: 20,
    marginy: 20,
  });

  for (const n of graph.nodes) {
    const size = NODE_SIZES[n.type] ?? DEFAULT_SIZE;
    g.setNode(n.id, { width: size.w, height: size.h });
  }
  for (const e of graph.edges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const laid = g.node(n.id);
      if (!laid) return n;
      const size = NODE_SIZES[n.type] ?? DEFAULT_SIZE;
      return {
        ...n,
        position: {
          // dagre returns the centre of the node; React Flow expects
          // the top-left corner.
          x: laid.x - size.w / 2,
          y: laid.y - size.h / 2,
        },
      };
    }),
  };
}
