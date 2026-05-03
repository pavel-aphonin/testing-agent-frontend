import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";

import type {
  NodeOverlayStyle,
  RunEdgeSummary,
  RunScreenSummary,
} from "@/types";

import { ScreenNode, type ScreenNodeData } from "./ScreenNode";

interface Props {
  screens: RunScreenSummary[];
  edges: RunEdgeSummary[];
  height?: number;
  runId?: string;
  /** PER-42: callbacks the host page wires up to react to user
   *  interaction with graph nodes. Both optional — when null the
   *  renderer falls back to its built-in "select node" behaviour. */
  onNodeClick?: (screenHash: string) => void;
  onNodeContextMenu?: (screenHash: string, anchor: { x: number; y: number }) => void;
  /** PER-39: hash → visual override; missing entries render with the
   *  built-in defaults. */
  overlayByHash?: Map<string, NodeOverlayStyle>;
}

const NODE_W = 216;
const NODE_H = 276;

/** Lay out nodes left-to-right with dagre. */
function layout(
  rfNodes: Node[],
  rfEdges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80 });

  rfNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  rfEdges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  const positioned: Node[] = rfNodes.map((n) => {
    const { x, y } = g.node(n.id);
    return {
      ...n,
      position: { x: x - NODE_W / 2, y: y - NODE_H / 2 },
    };
  });

  return { nodes: positioned, edges: rfEdges };
}

// eslint-disable-next-line react-refresh/only-export-components
const NODE_TYPES = { screenNode: ScreenNode };

export function GraphReactFlow({
  screens, edges, height = 520, runId,
  onNodeClick, onNodeContextMenu, overlayByHash,
}: Props) {
  const { t } = useTranslation();
  // PER-42 bugfix: react-flow's onNode* events surface ``node.id``
  // (synthetic "s0", "s1" labels we use for layout), not the screen
  // hash. Build a reverse map and translate before bubbling up.
  const hashByNodeId = useMemo(() => {
    const m = new Map<string, string>();
    screens.forEach((s, i) => m.set(`s${i}`, s.screen_id_hash));
    return m;
  }, [screens]);

  const { nodes, edges: rfEdges } = useMemo(() => {
    const idFor = new Map<string, string>();
    screens.forEach((s, i) => idFor.set(s.screen_id_hash, `s${i}`));

    const baseNodes: Node[] = screens.map((s, i) => {
      const overlay = overlayByHash?.get(s.screen_id_hash);
      const data: ScreenNodeData = {
        label: s.name || s.screen_id_hash.slice(0, 10),
        visitCount: s.visit_count,
        screenIdHash: s.screen_id_hash,
        hasScreenshot: !!s.screenshot_path,
        runId,
        overlay,
      };
      return {
        id: `s${i}`,
        type: "screenNode",
        data,
        position: { x: 0, y: 0 },
      };
    });

    const seen = new Set<string>();
    const baseEdges: Edge[] = [];
    edges.forEach((e, i) => {
      const a = idFor.get(e.source_screen_hash);
      const b = idFor.get(e.target_screen_hash);
      if (!a || !b) return;
      // De-duplicate parallel edges of the same action_type to keep the
      // graph readable. We still keep one representative.
      const key = `${a}-${b}-${e.action_type}-${e.success}`;
      if (seen.has(key)) return;
      seen.add(key);
      baseEdges.push({
        id: `e${i}`,
        source: a,
        target: b,
        label: e.action_type,
        animated: false,
        style: {
          stroke: e.success ? "#1677ff" : "#cf1322",
          strokeWidth: e.success ? 1.5 : 2,
        },
        labelStyle: { fontSize: 10 },
        labelBgStyle: { fill: "#fff" },
      });
    });

    return layout(baseNodes, baseEdges);
  }, [screens, edges, runId, overlayByHash]);

  if (screens.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999",
          fontSize: 13,
        }}
      >
        {t("graph.noData")}
      </div>
    );
  }

  return (
    <div style={{ height, border: "1px solid #f0f0f0", borderRadius: 4 }}>
      <ReactFlow
        nodes={nodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        fitView
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          const hash = hashByNodeId.get(node.id);
          if (hash) onNodeClick?.(hash);
        }}
        onNodeContextMenu={(event, node) => {
          // Prevent the browser's native context menu — we render our
          // own (PER-42). ``event`` is a synthetic React event; cast
          // because react-flow's signature is more permissive.
          (event as unknown as { preventDefault: () => void }).preventDefault();
          const e = event as unknown as { clientX: number; clientY: number };
          const hash = hashByNodeId.get(node.id);
          if (hash) onNodeContextMenu?.(hash, { x: e.clientX, y: e.clientY });
        }}
      >
        <Background />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
