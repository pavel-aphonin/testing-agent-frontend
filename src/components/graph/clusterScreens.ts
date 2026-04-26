/**
 * Auto-cluster screens by common prefix of their human-readable names
 * when a run carries more than ``threshold`` of them. Lets the StateGraph
 * stay readable on long runs without forcing the user to manually drill
 * down (PER-28).
 *
 * The clustering rule is intentionally simple: take everything before the
 * first delimiter (``.`` / ``/`` / ` — ` / ` - `) as the cluster key.
 * "Profile.Settings", "Profile.Edit" and "Profile" all collapse into a
 * single "Profile (3)" node; "Login" stays as itself. When a cluster has
 * fewer than ``min_cluster_size`` members it's expanded back out so we
 * don't end up with a sea of single-screen clusters next to giant ones.
 *
 * Edges between clustered screens are merged: counts of inner edges
 * collapse into a single ``cluster → cluster`` edge with success=AND.
 * Self-loops within a cluster are dropped — they're noise at the
 * cluster level.
 */

import type { RunEdgeSummary, RunScreenSummary } from "@/types";

export interface ClusterResult {
  /** Synthesized RunScreenSummary list — clusters look like fake screens
   *  with name "Cluster (N)" and screen_id_hash "cluster:KEY". */
  screens: RunScreenSummary[];
  /** Edges deduped + merged onto cluster nodes. */
  edges: RunEdgeSummary[];
  /** Map original screen hash → cluster id, so callers (e.g. selection
   *  state in StateGraph) can translate user clicks. */
  hashToCluster: Record<string, string>;
  /** True iff clustering was actually applied. */
  clustered: boolean;
  /** Diagnostic counts for the warning banner. */
  originalScreenCount: number;
  originalEdgeCount: number;
}

const _SPLIT_RE = /[.\/]| - | — /;

function _clusterKey(name: string | null | undefined): string {
  if (!name) return "(unnamed)";
  const trimmed = name.trim();
  if (!trimmed) return "(unnamed)";
  const parts = trimmed.split(_SPLIT_RE);
  return parts[0]!.trim();
}

export function clusterScreens(
  screens: RunScreenSummary[],
  edges: RunEdgeSummary[],
  options: { threshold?: number; minClusterSize?: number } = {},
): ClusterResult {
  const threshold = options.threshold ?? 100;
  const minClusterSize = options.minClusterSize ?? 3;

  const baseResult: Omit<ClusterResult, "clustered"> = {
    screens,
    edges,
    hashToCluster: {},
    originalScreenCount: screens.length,
    originalEdgeCount: edges.length,
  };

  if (screens.length < threshold) {
    return { ...baseResult, clustered: false };
  }

  // Bucket screens by cluster key. Smaller-than-threshold clusters
  // are passed through as-is so users keep the resolution they need
  // for their long tail.
  const buckets = new Map<string, RunScreenSummary[]>();
  for (const s of screens) {
    const key = _clusterKey(s.name);
    const arr = buckets.get(key) ?? [];
    arr.push(s);
    buckets.set(key, arr);
  }

  const hashToCluster: Record<string, string> = {};
  const clusterScreens: RunScreenSummary[] = [];
  for (const [key, group] of buckets) {
    if (group.length < minClusterSize) {
      // Pass-through: each member keeps its own node + hash.
      for (const s of group) {
        clusterScreens.push(s);
        hashToCluster[s.screen_id_hash] = s.screen_id_hash;
      }
    } else {
      const clusterId = `cluster:${key}`;
      clusterScreens.push({
        // ``id`` is informational on the frontend (the renderer keys
        // by screen_id_hash) — use a negative integer so the synthetic
        // node never collides with a real DB row id.
        id: -clusterScreens.length - 1,
        screen_id_hash: clusterId,
        name: `${key} (${group.length})`,
        visit_count: group.reduce((a, s) => a + (s.visit_count ?? 0), 0),
        screenshot_path: group[0]?.screenshot_path ?? null,
        first_seen_at: group[0]?.first_seen_at ?? new Date().toISOString(),
      });
      for (const s of group) {
        hashToCluster[s.screen_id_hash] = clusterId;
      }
    }
  }

  // Re-key edges onto clusters; drop self-loops at the cluster level.
  const seenEdge = new Map<string, RunEdgeSummary>();
  for (const e of edges) {
    const src = hashToCluster[e.source_screen_hash] ?? e.source_screen_hash;
    const dst = hashToCluster[e.target_screen_hash] ?? e.target_screen_hash;
    if (src === dst) continue;
    const key = `${src}::${dst}::${e.action_type}`;
    const prev = seenEdge.get(key);
    if (!prev) {
      seenEdge.set(key, {
        ...e,
        source_screen_hash: src,
        target_screen_hash: dst,
        // Merged "did all underlying edges succeed" — pessimistic so a
        // single failure within the cluster shows up as a red edge.
        success: e.success,
      });
    } else {
      prev.success = prev.success && e.success;
    }
  }

  return {
    screens: clusterScreens,
    edges: Array.from(seenEdge.values()),
    hashToCluster,
    clustered: true,
    originalScreenCount: screens.length,
    originalEdgeCount: edges.length,
  };
}
