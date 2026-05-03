import { useQuery } from "@tanstack/react-query";
import { Alert, Radio, Select, Space, Tooltip } from "antd";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { ScreenDetailDrawer } from "@/components/ScreenDetailDrawer";
import { listRunDefects } from "@/api/defects";
import { getRunDiff, listRuns } from "@/api/runs";
import { getMySettings } from "@/api/settings";
import type {
  GraphLibrary,
  GraphOverlayMode,
  NodeOverlayStyle,
  RunEdgeSummary,
  RunScreenSummary,
} from "@/types";

import { clusterScreens } from "./clusterScreens";
import { GraphCytoscape } from "./GraphCytoscape";
import { GraphReactFlow } from "./GraphReactFlow";
import { GraphVisNetwork } from "./GraphVisNetwork";
import { NodeContextMenu, type NodeContextMenuItem } from "./NodeContextMenu";
import {
  defectsOverlay,
  diffOverlay,
  specOverlay,
  visitsOverlay,
} from "./overlay";

interface Props {
  screens: RunScreenSummary[];
  edges: RunEdgeSummary[];
  height?: number;
  runId?: string;
  /** Override the user's saved preference (used by Settings preview). */
  libraryOverride?: GraphLibrary;
  /** PER-42: extra entries appended to the right-click context menu.
   *  Each item receives the clicked screen_id_hash. The host page
   *  (RunResults) injects "Replay path", "Start from screen", etc. */
  contextMenuItems?: NodeContextMenuItem[];
  /** PER-42: when true (default), clicking a node opens the
   *  ScreenDetailDrawer. Pages embedding the graph in a non-detail
   *  context (Settings preview) can disable. */
  openDrawerOnClick?: boolean;
  /** PER-39: workspace ID — needed to populate the baseline picker
   *  for the "diff" overlay. When omitted, "diff" is hidden. */
  workspaceId?: string | null;
}

// Threshold above which we auto-cluster screens by name prefix
// (PER-28). Below this the renderer gets the full data; above, the
// cluster-collapsed view becomes the default and the user has a
// toggle to expand back. 100 picked empirically — react-flow stays
// snappy at that size and below on a mid-laptop.
const CLUSTER_THRESHOLD = 100;

const OVERLAY_MODES: GraphOverlayMode[] = [
  "default",
  "defects",
  "spec",
  "visits",
  "diff",
];

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
 * Click / right-click on a node bubbles up through the adapters into
 * the ScreenDetailDrawer + NodeContextMenu integration here (PER-42).
 *
 * PER-39: Above the renderer is a Radio.Group that lets the user pick
 * a data overlay (defects / spec / visits / diff). The selected mode
 * is mirrored to ?overlay=… so links into a coloured graph share
 * the visualisation, not just the data.
 *
 * If the settings request fails for any reason, falls back to React Flow.
 */
export function StateGraph({
  screens, edges, height, runId, libraryOverride,
  contextMenuItems, openDrawerOnClick = true, workspaceId,
}: Props) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["my-settings"],
    queryFn: getMySettings,
    enabled: libraryOverride === undefined,
    staleTime: 60_000,
  });

  const lib: GraphLibrary =
    libraryOverride ?? data?.graph_library ?? "react-flow";

  // ── PER-39: overlay state, persisted via URL search param ───────
  const [searchParams, setSearchParams] = useSearchParams();
  const overlayParam = searchParams.get("overlay") as GraphOverlayMode | null;
  const overlay: GraphOverlayMode =
    overlayParam && OVERLAY_MODES.includes(overlayParam) ? overlayParam : "default";
  const setOverlay = useCallback((next: GraphOverlayMode) => {
    setSearchParams((prev) => {
      const out = new URLSearchParams(prev);
      if (next === "default") out.delete("overlay");
      else out.set("overlay", next);
      // diff baseline only meaningful while diff mode is active
      if (next !== "diff") out.delete("baseline");
      return out;
    }, { replace: true });
  }, [setSearchParams]);

  // Baseline run picker for "diff" mode. Stored in the URL so a
  // shared link with ?overlay=diff&baseline=<uuid> reproduces the
  // exact comparison.
  const baselineParam = searchParams.get("baseline");
  const setBaseline = useCallback((next: string | null) => {
    setSearchParams((prev) => {
      const out = new URLSearchParams(prev);
      if (next) out.set("baseline", next);
      else out.delete("baseline");
      return out;
    }, { replace: true });
  }, [setSearchParams]);

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

  // ── PER-42: shared interaction state ──────────────────────────────
  // Cluster nodes (id starts with "cluster:") aren't real screens —
  // their "screen_id_hash" is synthetic, so click + right-click on
  // them shouldn't trigger drawer / replay. We swallow them here to
  // keep adapters dumb.
  const [drawerHash, setDrawerHash] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ hash: string; anchor: { x: number; y: number } } | null>(null);

  const handleNodeClick = useCallback((hash: string) => {
    if (hash.startsWith("cluster:")) return;
    if (openDrawerOnClick) setDrawerHash(hash);
  }, [openDrawerOnClick]);

  const handleNodeContext = useCallback((hash: string, anchor: { x: number; y: number }) => {
    if (hash.startsWith("cluster:")) return;
    setCtxMenu({ hash, anchor });
  }, []);

  // ── PER-39: data fetches feeding the overlay ────────────────────
  const defectsQ = useQuery({
    queryKey: ["run-defects-overlay", runId],
    queryFn: () => listRunDefects(runId!),
    enabled: overlay === "defects" && !!runId,
    staleTime: 30_000,
  });

  const baselineRunsQ = useQuery({
    queryKey: ["runs-for-baseline", workspaceId],
    queryFn: () => listRuns(workspaceId),
    enabled: overlay === "diff" && !!runId,
    staleTime: 60_000,
  });

  const diffQ = useQuery({
    queryKey: ["run-diff-overlay", runId, baselineParam],
    queryFn: () => getRunDiff(runId!, baselineParam!),
    enabled: overlay === "diff" && !!runId && !!baselineParam,
    staleTime: 30_000,
  });

  const overlayByHash = useMemo<Map<string, NodeOverlayStyle>>(() => {
    if (overlay === "defects") return defectsOverlay(defectsQ.data ?? []);
    if (overlay === "spec") return specOverlay(edges);
    if (overlay === "visits") return visitsOverlay(screens);
    if (overlay === "diff") return diffOverlay(diffQ.data);
    return new Map();
  }, [overlay, defectsQ.data, diffQ.data, edges, screens]);

  const renderer = (() => {
    const shared = {
      screens: renderScreens,
      edges: renderEdges,
      height,
      onNodeClick: handleNodeClick,
      onNodeContextMenu: handleNodeContext,
      overlayByHash,
    };
    if (lib === "cytoscape") {
      return <GraphCytoscape {...shared} />;
    }
    if (lib === "vis-network") {
      return <GraphVisNetwork {...shared} />;
    }
    return <GraphReactFlow {...shared} runId={runId} />;
  })();

  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      {/* PER-39: overlay picker. Hidden when there's no runId
          because every overlay needs run-scoped data. */}
      {runId && (
        <Space wrap style={{ paddingLeft: 8 }}>
          <span style={{ fontSize: 12, color: "#666" }}>
            {t("graph.overlay.label")}:
          </span>
          <Radio.Group
            size="small"
            value={overlay}
            onChange={(e) => setOverlay(e.target.value as GraphOverlayMode)}
            optionType="button"
            buttonStyle="solid"
          >
            {OVERLAY_MODES.map((m) => {
              // The "diff" overlay is only useful with a baseline,
              // and only the page host knows the workspace context —
              // hide it cleanly when neither is available.
              if (m === "diff" && !workspaceId) return null;
              return (
                <Tooltip
                  key={m}
                  title={t(`graph.overlay.tooltip.${m}`)}
                  placement="top"
                >
                  <Radio.Button value={m}>
                    {t(`graph.overlay.modes.${m}`)}
                  </Radio.Button>
                </Tooltip>
              );
            })}
          </Radio.Group>

          {overlay === "diff" && (
            <Select
              size="small"
              showSearch
              placeholder={t("graph.overlay.baselinePlaceholder")}
              value={baselineParam ?? undefined}
              onChange={(v) => setBaseline(v ?? null)}
              allowClear
              style={{ minWidth: 240 }}
              optionFilterProp="label"
              loading={baselineRunsQ.isLoading}
              options={(baselineRunsQ.data ?? [])
                .filter((r) => r.id !== runId)
                .map((r) => ({
                  value: r.id,
                  label: `${r.title || r.bundle_id} · ${new Date(r.created_at).toLocaleDateString()}`,
                }))}
            />
          )}
        </Space>
      )}

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

      {/* PER-42: drawer + context menu live alongside the graph so
          adapters stay rendering-only. */}
      <ScreenDetailDrawer
        open={drawerHash !== null}
        runId={runId}
        screenHash={drawerHash}
        onClose={() => setDrawerHash(null)}
      />
      {ctxMenu && (
        <NodeContextMenu
          anchor={ctxMenu.anchor}
          screenHash={ctxMenu.hash}
          items={contextMenuItems ?? []}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </Space>
  );
}
