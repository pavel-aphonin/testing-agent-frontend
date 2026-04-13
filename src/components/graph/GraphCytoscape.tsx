import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import cytoscape, { type Core } from "cytoscape";
// @ts-expect-error — cytoscape-dagre ships its own types but they don't
// re-export the default for use as a Cytoscape extension.
import dagre from "cytoscape-dagre";

import type { RunEdgeSummary, RunScreenSummary } from "@/types";

cytoscape.use(dagre);

interface Props {
  screens: RunScreenSummary[];
  edges: RunEdgeSummary[];
  height?: number;
}

export function GraphCytoscape({ screens, edges, height = 520 }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const idFor = new Map<string, string>();
    screens.forEach((s, i) => idFor.set(s.screen_id_hash, `s${i}`));

    const nodeElements: cytoscape.ElementDefinition[] = screens.map((s, i) => ({
      data: {
        id: `s${i}`,
        label: s.name || s.screen_id_hash.slice(0, 10),
        visits: s.visit_count,
      },
    }));

    const edgeElements: cytoscape.ElementDefinition[] = [];
    edges.forEach((e, i) => {
      const a = idFor.get(e.source_screen_hash);
      const b = idFor.get(e.target_screen_hash);
      if (!a || !b) return;
      edgeElements.push({
        data: {
          id: `e${i}`,
          source: a,
          target: b,
          label: e.action_type,
          success: e.success ? 1 : 0,
        },
      });
    });

    const elements: cytoscape.ElementDefinition[] = [
      ...nodeElements,
      ...edgeElements,
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#fff",
            "border-width": 1,
            "border-color": "#d9d9d9",
            label: "data(label)",
            "text-valign": "center",
            "text-halign": "center",
            "font-size": 11,
            color: "#333",
            shape: "round-rectangle",
            width: 140,
            height: 50,
            "text-wrap": "wrap",
            "text-max-width": "130px",
            padding: "8px",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#1677ff",
            "target-arrow-color": "#1677ff",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": 9,
            "text-background-color": "#fff",
            "text-background-opacity": 1,
            "text-background-padding": "2px",
            color: "#555",
          },
        },
        {
          selector: "edge[success = 0]",
          style: {
            "line-color": "#cf1322",
            "target-arrow-color": "#cf1322",
            width: 2,
          },
        },
      ],
      layout: {
        name: "dagre",
        // dagre options
        // @ts-expect-error — extension props not in the base typedef
        rankDir: "LR",
        nodeSep: 40,
        rankSep: 80,
        fit: true,
        padding: 20,
      },
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
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
