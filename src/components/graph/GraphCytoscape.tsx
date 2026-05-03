import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import cytoscape, { type Core } from "cytoscape";
// @ts-expect-error — cytoscape-dagre ships its own types but they don't
// re-export the default for use as a Cytoscape extension.
import dagre from "cytoscape-dagre";

import type {
  NodeOverlayStyle,
  RunEdgeSummary,
  RunScreenSummary,
} from "@/types";

cytoscape.use(dagre);

interface Props {
  screens: RunScreenSummary[];
  edges: RunEdgeSummary[];
  height?: number;
  /** PER-42: same node-interaction contract as the other adapters. */
  onNodeClick?: (screenHash: string) => void;
  onNodeContextMenu?: (screenHash: string, anchor: { x: number; y: number }) => void;
  /** PER-39: hash → visual override; missing entries render with the
   *  built-in defaults. */
  overlayByHash?: Map<string, NodeOverlayStyle>;
}

export function GraphCytoscape({
  screens, edges, height = 520,
  onNodeClick, onNodeContextMenu, overlayByHash,
}: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const idFor = new Map<string, string>();
    screens.forEach((s, i) => idFor.set(s.screen_id_hash, `s${i}`));

    const nodeElements: cytoscape.ElementDefinition[] = screens.map((s, i) => {
      const overlay = overlayByHash?.get(s.screen_id_hash);
      return {
        data: {
          id: `s${i}`,
          // PER-39: badge appears as a suffix in the label since
          // cytoscape doesn't have a first-class badge primitive
          // and overlays would require a node-html plugin.
          label: overlay?.badgeText
            ? `${s.name || s.screen_id_hash.slice(0, 10)} [${overlay.badgeText}]`
            : (s.name || s.screen_id_hash.slice(0, 10)),
          visits: s.visit_count,
          // Inline-style fields read by per-element selectors below.
          bg: overlay?.bgColor ?? "#fff",
          border: overlay?.borderColor ?? "#d9d9d9",
          borderWidth: overlay?.borderColor ? 2 : 1,
        },
      };
    });

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
            // PER-39: read overlay-driven values from per-element data.
            "background-color": "data(bg)",
            "border-width": "data(borderWidth)",
            "border-color": "data(border)",
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

    // PER-42: bridge cytoscape's tap / cxttap events to the parent.
    // Cytoscape uses ``data.id`` ("s0", "s1") internally — translate
    // back to the original screen_id_hash via the screens array.
    const handleTap = (evt: cytoscape.EventObject) => {
      const idx = parseInt(String(evt.target.id()).slice(1), 10);
      const hash = screens[idx]?.screen_id_hash;
      if (hash) onNodeClick?.(hash);
    };
    const handleContextTap = (evt: cytoscape.EventObject) => {
      const idx = parseInt(String(evt.target.id()).slice(1), 10);
      const hash = screens[idx]?.screen_id_hash;
      if (!hash) return;
      const orig = (evt.originalEvent ?? {}) as { clientX?: number; clientY?: number; preventDefault?: () => void };
      orig.preventDefault?.();
      onNodeContextMenu?.(hash, { x: orig.clientX ?? 0, y: orig.clientY ?? 0 });
    };
    cy.on("tap", "node", handleTap);
    cy.on("cxttap", "node", handleContextTap);

    return () => {
      cy.off("tap", "node", handleTap);
      cy.off("cxttap", "node", handleContextTap);
      cy.destroy();
      cyRef.current = null;
    };
  }, [screens, edges, onNodeClick, onNodeContextMenu, overlayByHash]);

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
