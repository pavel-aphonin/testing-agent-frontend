/**
 * PER-39: derive per-node visual overrides for the StateGraph data
 * overlays. Each function accepts the source data and returns a
 * Map<screen_id_hash, NodeOverlayStyle> the renderers consume.
 *
 * Kept side-effect-free + dependency-free so tests / storybook can
 * exercise the colour rules without spinning up a full graph.
 */

import type { DefectRead } from "@/api/defects";
import type { RunDiffPayload } from "@/api/runs";
import type {
  NodeOverlayStyle,
  RunEdgeSummary,
  RunScreenSummary,
} from "@/types";

/** AntD-aligned palette so overlays look at home next to the rest of
 *  the UI. Colours roughly map to the priority-Tag colours used in
 *  DefectsPanel. */
const PRIORITY_COLOR: Record<string, string> = {
  P0: "#cf1322", // red-7
  P1: "#fa8c16", // orange-6
  P2: "#faad14", // gold-6
  P3: "#bfbfbf", // gray-6
};

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export interface DefectAggregate {
  total: number;
  /** Most critical priority code present (lowest rank wins). */
  worst: "P0" | "P1" | "P2" | "P3";
  /** {P0: 2, P1: 1, ...} — used for tooltips / future drill-downs. */
  byPriority: Record<string, number>;
}

/** Group defects by screen and compute the aggregate used by the
 *  "defects" overlay + by ScreenDetailDrawer if it wants the same. */
export function aggregateDefectsByScreen(
  defects: DefectRead[],
): Map<string, DefectAggregate> {
  const out = new Map<string, DefectAggregate>();
  for (const d of defects) {
    if (!d.screen_id_hash) continue;
    const prev = out.get(d.screen_id_hash);
    const byPriority = prev?.byPriority ?? { P0: 0, P1: 0, P2: 0, P3: 0 };
    byPriority[d.priority] = (byPriority[d.priority] ?? 0) + 1;
    const worst = (() => {
      const candidates = (prev ? [prev.worst, d.priority] : [d.priority]) as (
        | "P0" | "P1" | "P2" | "P3"
      )[];
      candidates.sort((a, b) => PRIORITY_RANK[a]! - PRIORITY_RANK[b]!);
      return candidates[0]!;
    })();
    out.set(d.screen_id_hash, {
      total: (prev?.total ?? 0) + 1,
      worst,
      byPriority,
    });
  }
  return out;
}

/** Defects overlay — colour the node by the priority of its worst
 *  defect, badge with total count. Screens without defects stay
 *  neutral (no override) so the contrast is loud. */
export function defectsOverlay(
  defects: DefectRead[],
): Map<string, NodeOverlayStyle> {
  const agg = aggregateDefectsByScreen(defects);
  const out = new Map<string, NodeOverlayStyle>();
  for (const [hash, a] of agg) {
    const color = PRIORITY_COLOR[a.worst] ?? "#cf1322";
    out.set(hash, {
      borderColor: color,
      bgColor: hexAlpha(color, 0.1),
      badgeText: String(a.total),
      badgeColor: color,
    });
  }
  return out;
}

/** Spec overlay — green if every edge into the screen matched its
 *  RAG snippet, red if any didn't, yellow if data is partial /
 *  mixed. Screens nobody verified stay neutral. */
export function specOverlay(
  edges: RunEdgeSummary[],
): Map<string, NodeOverlayStyle> {
  const verdicts = new Map<string, { matched: number; missed: number }>();
  for (const e of edges) {
    const v = e.rag_verdict_json;
    if (!v) continue;
    const prev = verdicts.get(e.target_screen_hash) ?? { matched: 0, missed: 0 };
    if (v.matched) prev.matched += 1; else prev.missed += 1;
    verdicts.set(e.target_screen_hash, prev);
  }
  const out = new Map<string, NodeOverlayStyle>();
  for (const [hash, v] of verdicts) {
    if (v.missed === 0) {
      out.set(hash, { borderColor: "#52c41a", bgColor: hexAlpha("#52c41a", 0.1) });
    } else if (v.matched === 0) {
      out.set(hash, { borderColor: "#cf1322", bgColor: hexAlpha("#cf1322", 0.1) });
    } else {
      out.set(hash, { borderColor: "#faad14", bgColor: hexAlpha("#faad14", 0.1) });
    }
  }
  return out;
}

/** Visits overlay — heatmap from pale to saturated blue. Normalised
 *  by the run's max visit_count so the contrast stays useful even on
 *  short runs where everything was visited 1–2 times. */
export function visitsOverlay(
  screens: RunScreenSummary[],
): Map<string, NodeOverlayStyle> {
  const max = screens.reduce((m, s) => Math.max(m, s.visit_count ?? 0), 0);
  const out = new Map<string, NodeOverlayStyle>();
  if (max <= 0) return out;
  for (const s of screens) {
    const v = s.visit_count ?? 0;
    if (v <= 0) continue;
    // 0..1 normalised intensity; clamp the floor so 1-visit screens
    // still get a visible tint instead of disappearing into white.
    const t = Math.max(0.15, v / max);
    out.set(s.screen_id_hash, {
      borderColor: "#1677ff",
      bgColor: hexAlpha("#1677ff", t * 0.5),
    });
  }
  return out;
}

/** Diff overlay — green for screens new vs baseline, dashed grey
 *  for screens missing in current. The "removed" screens don't
 *  exist in the current screens[] so RunResults must inject
 *  ghost nodes if it wants to render them; this overlay just
 *  styles the ones it can see. */
export function diffOverlay(
  diff: RunDiffPayload | null | undefined,
): Map<string, NodeOverlayStyle> {
  const out = new Map<string, NodeOverlayStyle>();
  if (!diff) return out;
  for (const s of diff.screens_added) {
    out.set(s.hash, {
      borderColor: "#52c41a",
      bgColor: hexAlpha("#52c41a", 0.12),
      badgeText: "+",
      badgeColor: "#52c41a",
    });
  }
  for (const s of diff.screens_removed) {
    out.set(s.hash, {
      borderColor: "#bfbfbf",
      bgColor: "#f5f5f5",
      badgeText: "−",
      badgeColor: "#8c8c8c",
    });
  }
  return out;
}

/** Append an alpha channel to a #RRGGBB hex. Returns rgba() string
 *  because hex8 isn't well supported in older browsers and AntD's
 *  inline-style consumers prefer rgba anyway. */
function hexAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}
