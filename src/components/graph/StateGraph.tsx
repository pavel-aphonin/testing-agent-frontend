import { useQuery } from "@tanstack/react-query";

import { getMySettings } from "@/api/settings";
import type { GraphLibrary, RunEdgeSummary, RunScreenSummary } from "@/types";

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

/**
 * Picks one of three graph renderers (React Flow / Cytoscape / vis-network)
 * based on the current user's `graph_library` setting. The setting is
 * persisted server-side via /api/settings.
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

  if (lib === "cytoscape") {
    return <GraphCytoscape screens={screens} edges={edges} height={height} />;
  }
  if (lib === "vis-network") {
    return <GraphVisNetwork screens={screens} edges={edges} height={height} />;
  }
  return <GraphReactFlow screens={screens} edges={edges} height={height} runId={runId} />;
}
