import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { theme } from "antd";
import { Network, type Edge, type Node } from "vis-network";
import { DataSet } from "vis-network/standalone";
import "vis-network/styles/vis-network.css";

import type {
  NodeOverlayStyle,
  RunEdgeSummary,
  RunScreenSummary,
} from "@/types";

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

export function GraphVisNetwork({
  screens, edges, height = 520,
  onNodeClick, onNodeContextMenu, overlayByHash,
}: Props) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const idFor = new Map<string, string>();
    screens.forEach((s, i) => idFor.set(s.screen_id_hash, `s${i}`));

    const nodes = new DataSet<Node>(
      screens.map((s, i) => {
        const overlay = overlayByHash?.get(s.screen_id_hash);
        const baseLabel = `${s.name || s.screen_id_hash.slice(0, 10)}\n${t("graph.visits", { count: s.visit_count })}`;
        return {
          id: `s${i}`,
          // PER-39: badge inlined into label — vis-network has no
          // first-class badge. Suffix is short enough not to break
          // the box layout.
          label: overlay?.badgeText ? `${baseLabel}\n[${overlay.badgeText}]` : baseLabel,
          shape: "box",
          font: { size: 12, multi: false, color: token.colorText },
          color: {
            background: overlay?.bgColor ?? token.colorBgContainer,
            border: overlay?.borderColor ?? token.colorBorder,
          },
          borderWidth: overlay?.borderColor ? 2 : 1,
          margin: { top: 8, right: 12, bottom: 8, left: 12 },
        };
      }),
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
        font: { size: 10, color: token.colorTextSecondary, strokeWidth: 0 },
        color: { color: e.success ? token.colorPrimary : token.colorError },
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

    // PER-42: bridge vis-network click / oncontext events to parent.
    // ``params.nodes[0]`` is "s0"-style id; translate to screen_id_hash.
    const hashFromVisId = (visId: string | number | undefined): string | undefined => {
      if (typeof visId !== "string") return undefined;
      const idx = parseInt(visId.slice(1), 10);
      return screens[idx]?.screen_id_hash;
    };
    network.on("click", (params: { nodes?: string[] }) => {
      const hash = hashFromVisId(params.nodes?.[0]);
      if (hash) onNodeClick?.(hash);
    });
    network.on("oncontext", (params: {
      nodes?: string[];
      pointer: { DOM: { x: number; y: number } };
      event: Event;
    }) => {
      const hash = hashFromVisId(params.nodes?.[0]);
      if (!hash) return;
      // vis-network synthesises its own event — preventDefault stops
      // the native browser context menu so ours can render.
      params.event.preventDefault?.();
      // ``DOM`` coords are relative to the canvas; the parent expects
      // viewport coords. Container's bounding rect bridges the gap.
      const rect = containerRef.current?.getBoundingClientRect();
      onNodeContextMenu?.(hash, {
        x: (rect?.left ?? 0) + params.pointer.DOM.x,
        y: (rect?.top ?? 0) + params.pointer.DOM.y,
      });
    });

    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [screens, edges, onNodeClick, onNodeContextMenu, overlayByHash, t, token]);

  if (screens.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: token.colorTextTertiary,
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
        background: token.colorFillQuaternary,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 4,
      }}
    />
  );
}
