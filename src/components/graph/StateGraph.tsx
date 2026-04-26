import { useQuery } from "@tanstack/react-query";
import { Alert, Space } from "antd";
import { useMemo, useState } from "react";

import { getMySettings } from "@/api/settings";
import type { GraphLibrary, RunEdgeSummary, RunScreenSummary } from "@/types";

import { clusterScreens } from "./clusterScreens";
import { GraphCytoscape } from "./GraphCytoscape";
import { GraphReactFlow } from "./GraphReactFlow";
import { GraphVisNetwork } from "./GraphVisNetwork";

interface Props {
  screens: RunScreenSummary[];
  edges: RunEdgeSummary[];
  height?: number;
  runId?: string;
  /** Override the user's saved preference (used by Settings preview). */
  libraryOverride?: GraphLibrary;
}

// Threshold above which we auto-cluster screens by name prefix
// (PER-28). Below this the renderer gets the full data; above, the
// cluster-collapsed view becomes the default and the user has a
// toggle to expand back. 100 picked empirically — react-flow stays
// snappy at that size and below on a mid-laptop.
const CLUSTER_THRESHOLD = 100;

/**
 * Picks one of three graph renderers (React Flow / Cytoscape / vis-network)
 * based on the current user's `graph_library` setting. The setting is
 * persisted server-side via /api/settings.
 *
 * For runs over CLUSTER_THRESHOLD screens, applies prefix-based
 * clustering before passing data to the renderer (PER-28). This keeps
 * the layout legible without any backend changes — the renderer
 * shouldn't have to know whether it's looking at the raw graph or a
 * clustered one.
 *
 * If the settings request fails for any reason, falls back to React Flow.
 */
export function StateGraph({ screens, edges, height, runId, libraryOverride }: Props) {
  const { data } = useQuery({
    queryKey: ["my-settings"],
    queryFn: getMySettings,
    enabled: libraryOverride === undefined,
    staleTime: 60_000,
  });

  const lib: GraphLibrary =
    libraryOverride ?? data?.graph_library ?? "react-flow";

  // Default to clustered view above threshold; let the user override
  // if they really want to see all 200 nodes (slow but possible).
  const [expandClusters, setExpandClusters] = useState(false);
  const cluster = useMemo(
    () => clusterScreens(screens, edges, { threshold: CLUSTER_THRESHOLD }),
    [screens, edges],
  );
  const useClustered = cluster.clustered && !expandClusters;
  const renderScreens = useClustered ? cluster.screens : screens;
  const renderEdges = useClustered ? cluster.edges : edges;

  const renderer = (() => {
    if (lib === "cytoscape") {
      return <GraphCytoscape screens={renderScreens} edges={renderEdges} height={height} />;
    }
    if (lib === "vis-network") {
      return <GraphVisNetwork screens={renderScreens} edges={renderEdges} height={height} />;
    }
    return <GraphReactFlow screens={renderScreens} edges={renderEdges} height={height} runId={runId} />;
  })();

  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      {cluster.clustered && (
        <Alert
          type="info"
          showIcon
          message={
            useClustered
              ? `Граф большой (${cluster.originalScreenCount} экранов) — экраны сгруппированы по префиксу имени.`
              : `Показаны все ${cluster.originalScreenCount} экранов — рендер может тормозить.`
          }
          action={
            <a onClick={() => setExpandClusters((v) => !v)} style={{ cursor: "pointer" }}>
              {useClustered ? "Развернуть всё" : "Снова сгруппировать"}
            </a>
          }
        />
      )}
      {renderer}
    </Space>
  );
}
