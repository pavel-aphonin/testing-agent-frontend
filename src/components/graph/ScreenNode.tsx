import { useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Image } from "antd";

import { apiClient } from "@/api/client";

/** Data payload carried by each screen node. */
export interface ScreenNodeData {
  label: string;
  visitCount: number;
  screenIdHash: string;
  hasScreenshot: boolean;
  runId?: string;
  [key: string]: unknown;
}

/** Shared cache so re-renders / layout recalcs don't re-fetch blobs. */
const screenshotCache = new Map<string, string>();

export function ScreenNode({ data }: NodeProps) {
  const { label, visitCount, screenIdHash, hasScreenshot, runId } =
    data as unknown as ScreenNodeData;

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
        width: 200,
        height: 260,
        background: "#fff",
        border: "1px solid #d9d9d9",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 8,
        overflow: "hidden",
      }}
    >
      <Handle type="target" position={Position.Left} />

      {/* Thumbnail area */}
      <div
        style={{
          width: 120,
          height: 200,
          borderRadius: 6,
          overflow: "hidden",
          background: "#f5f5f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {loading ? (
          <span style={{ color: "#bbb", fontSize: 11 }}>...</span>
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
          <span style={{ color: "#bbb", fontSize: 11 }}>No screenshot</span>
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
            color: "#888",
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
