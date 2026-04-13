import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Network, type Edge, type Node } from "vis-network";
import { DataSet } from "vis-network/standalone";
import "vis-network/styles/vis-network.css";

import type { RunEdgeSummary, RunScreenSummary } from "@/types";

interface Props {
  screens: RunScreenSummary[];
  edges: RunEdgeSummary[];
  height?: number;
}

export function GraphVisNetwork({ screens, edges, height = 520 }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const idFor = new Map<string, string>();
    screens.forEach((s, i) => idFor.set(s.screen_id_hash, `s${i}`));

    const nodes = new DataSet<Node>(
      screens.map((s, i) => ({
        id: `s${i}`,
        label: `${s.name || s.screen_id_hash.slice(0, 10)}\n${t("graph.visits", { count: s.visit_count })}`,
        shape: "box",
        font: { size: 12, multi: false },
        color: { background: "#fff", border: "#d9d9d9" },
        margin: { top: 8, right: 12, bottom: 8, left: 12 },
      })),
    );

    const seen = new Set<string>();
    const edgeList: Edge[] = [];
    edges.forEach((e, i) => {
      const a = idFor.get(e.source_screen_hash);
      const b = idFor.get(e.target_screen_hash);
      if (!a || !b) return;
      const key = `${a}-${b}-${e.action_type}-${e.success}`;
      if (seen.has(key)) return;
      seen.add(key);
      edgeList.push({
        id: `e${i}`,
        from: a,
        to: b,
        label: e.action_type,
        font: { size: 10, color: "#555", strokeWidth: 0 },
        color: { color: e.success ? "#1677ff" : "#cf1322" },
        width: e.success ? 1.5 : 2,
        arrows: { to: { enabled: true, scaleFactor: 0.6 } },
        smooth: { enabled: true, type: "cubicBezier", roundness: 0.4 },
      });
    });
    const edgesDS = new DataSet<Edge>(edgeList);

    const network = new Network(
      containerRef.current,
      { nodes, edges: edgesDS },
      {
        layout: {
          hierarchical: {
            enabled: true,
            direction: "LR",
            sortMethod: "directed",
            nodeSpacing: 120,
            levelSeparation: 180,
          },
        },
        physics: { enabled: false },
        interaction: {
          dragNodes: true,
          zoomView: true,
          dragView: true,
        },
      },
    );

    networkRef.current = network;
    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [screens, edges]);

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
    <div
      ref={containerRef}
      style={{
        height,
        background: "#fafafa",
        border: "1px solid #f0f0f0",
        borderRadius: 4,
      }}
    />
  );
}
