import { useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Image, theme } from "antd";

import { apiClient } from "@/api/client";
import type { NodeOverlayStyle } from "@/types";

/** Data payload carried by each screen node. */
export interface ScreenNodeData {
  label: string;
  visitCount: number;
  screenIdHash: string;
  hasScreenshot: boolean;
  runId?: string;
  /** PER-39: optional visual override from the active data overlay
   *  (defects / spec / visits / diff). When undefined the node
   *  renders with the built-in neutral palette. */
  overlay?: NodeOverlayStyle;
  [key: string]: unknown;
}

/** Shared cache so re-renders / layout recalcs don't re-fetch blobs. */
const screenshotCache = new Map<string, string>();

export function ScreenNode({ data }: NodeProps) {
  const { label, visitCount, screenIdHash, hasScreenshot, runId, overlay } =
    data as unknown as ScreenNodeData;
  const { token } = theme.useToken();

  const [src, setSrc] = useState<string | null>(
    screenshotCache.get(screenIdHash) ?? null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasScreenshot || !runId) return;
    if (screenshotCache.has(screenIdHash)) {
      setSrc(screenshotCache.get(screenIdHash)!);
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiClient
      .get(`/api/runs/${runId}/screens/${screenIdHash}/screenshot`, {
        responseType: "blob",
      })
      .then((res) => {
        if (cancelled) return;
        const url = URL.createObjectURL(res.data as Blob);
        screenshotCache.set(screenIdHash, url);
        setSrc(url);
      })
      .catch(() => {
        /* screenshot unavailable — keep placeholder */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasScreenshot, runId, screenIdHash]);

  return (
    <div
      style={{
        position: "relative",
        width: 200,
        height: 260,
        background: overlay?.bgColor ?? token.colorBgContainer,
        border: `${overlay?.borderColor ? 2 : 1}px solid ${overlay?.borderColor ?? token.colorBorder}`,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 8,
        overflow: "hidden",
        transition: "background 200ms, border-color 200ms",
      }}
    >
      <Handle type="target" position={Position.Left} />

      {/* PER-39: corner badge — defect count, "+" / "−" diff
          markers etc. Rendered absolutely so it overlays the
          thumbnail without nudging the layout. */}
      {overlay?.badgeText && (
        <div
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 9,
            background: overlay.badgeColor ?? "#cf1322",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
            zIndex: 1,
          }}
        >
          {overlay.badgeText}
        </div>
      )}

      {/* Thumbnail area */}
      <div
        style={{
          width: 120,
          height: 200,
          borderRadius: 6,
          overflow: "hidden",
          background: token.colorFillQuaternary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {loading ? (
          <span style={{ color: token.colorTextQuaternary, fontSize: 11 }}>...</span>
        ) : src ? (
          <Image
            src={src}
            alt={label}
            width={120}
            height={200}
            style={{ objectFit: "cover", cursor: "pointer" }}
            preview={{ mask: null }}
          />
        ) : (
          <span style={{ color: token.colorTextQuaternary, fontSize: 11 }}>No screenshot</span>
        )}
      </div>

      {/* Label + badge */}
      <div
        style={{
          marginTop: 6,
          width: "100%",
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 10,
            color: token.colorTextSecondary,
            marginTop: 1,
          }}
        >
          {visitCount}x
        </div>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
