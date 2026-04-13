import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiClient } from "@/api/client";

interface Props {
  runId: string;
  /** Polling interval in ms when the upstream is up. 200ms ≈ 5 fps. */
  intervalMs?: number;
  /** Polling interval in ms when the upstream is down. */
  retryIntervalMs?: number;
}

/**
 * Live mirror of the iOS simulator window during a real-iOS exploration run.
 *
 * Uses authenticated snapshot polling instead of an MJPEG `<img>` because
 * `<img>` can't carry the JWT bearer header — and exposing the mirror
 * endpoint without auth would let anyone on the LAN watch the simulator.
 *
 * Behavior:
 * - On success: poll at intervalMs (200ms / 5fps).
 * - On failure: keep polling at retryIntervalMs (1500ms / "auto-recovery"),
 *   showing a "waiting for simulator" placeholder. Never gives up — the
 *   sidecar might come up a few seconds after the run starts (worker
 *   needs to claim the run, launch the app, boot capture). The previous
 *   "hide after 8 failures" behavior was wrong: it killed the mirror
 *   for the entire page session if the user opened RunProgress before
 *   the worker had spawned SimMirror.
 *
 * 5fps is a good demo balance: looks live, ~250KB/sec at JPEG q=70
 * width=480, and the backend proxy stays cheap because each frame is one
 * short HTTP round trip rather than a long streaming connection.
 */
export function LiveMirror({
  runId,
  intervalMs = 200,
  retryIntervalMs = 1500,
}: Props) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(true);
  const aliveRef = useRef(true);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    setWaiting(true);
    setSrc(null);

    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (!aliveRef.current) return;
      let nextDelay = intervalMs;
      try {
        const response = await apiClient.get(
          `/api/runs/${runId}/mirror/snapshot`,
          { responseType: "blob" },
        );
        if (!aliveRef.current) return;
        // Revoke the previous object URL to avoid leaking memory
        // across N hundreds of frames.
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        const url = URL.createObjectURL(response.data as Blob);
        objectUrlRef.current = url;
        setSrc(url);
        setWaiting(false);
      } catch {
        // Keep showing the previous frame if we have one — better than
        // a flash of "waiting" when a single request hiccups. Only
        // switch to the placeholder if we never got a frame at all.
        setWaiting((prev) => prev || src === null);
        nextDelay = retryIntervalMs;
      } finally {
        if (aliveRef.current) {
          timer = setTimeout(tick, nextDelay);
        }
      }
    };

    tick();

    return () => {
      aliveRef.current = false;
      if (timer) clearTimeout(timer);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
    // We intentionally don't depend on `src` so the closure capturing it
    // for the placeholder check stays stable; the latest is read via
    // setWaiting's functional form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, intervalMs, retryIntervalMs]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
        borderRadius: 4,
        padding: 8,
        minHeight: 480,
      }}
    >
      {src ? (
        <img
          src={src}
          alt="iOS simulator live mirror"
          style={{
            maxHeight: 700,
            maxWidth: "100%",
          }}
        />
      ) : (
        <div
          style={{
            color: "#888",
            fontSize: 13,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div>{t("runProgress.wsConnecting")}</div>
          {waiting && (
            <div style={{ fontSize: 11, color: "#666" }}>
              {t("liveMirror.waiting")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
