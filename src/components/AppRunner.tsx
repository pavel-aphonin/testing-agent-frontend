import { CloseOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { Alert, Modal, Spin } from "antd";
import { useEffect, useRef, useState } from "react";

import { apiClient } from "@/api/client";
import { bundleFileUrl } from "@/api/apps";
import type { AppInstallationRead } from "@/types";

interface Props {
  installation: AppInstallationRead | null;
  slotPath: string | null;
  onClose: () => void;
  /** Extra context passed to the iframe (e.g. { run_id } on run pages). */
  contextData?: Record<string, unknown>;
}

/**
 * Loads the app's iframe in a full-screen modal, gets a short-lived
 * installation token, and hands it to the iframe via postMessage once
 * the iframe signals it's ready.
 */
export function AppRunner({ installation, slotPath, onClose, contextData }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const tokenM = useMutation({
    mutationFn: async () => {
      if (!installation) throw new Error("No installation");
      const res = await apiClient.post(
        `/api/workspaces/${installation.workspace_id}/apps/${installation.id}/token`,
      );
      return res.data as { token: string };
    },
  });

  // Re-issue token whenever the runner opens for a different installation
  useEffect(() => {
    if (installation && slotPath) {
      setTokenError(null);
      tokenM.mutate(undefined, {
        onError: (e: any) =>
          setTokenError(e?.response?.data?.detail ?? "Не удалось получить токен"),
      });
    }
  }, [installation?.id, slotPath]);

  // Listen for the "markov.ready" handshake and reply with bootstrap
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (!ev.data || ev.data.type !== "markov.ready") return;
      if (!iframeRef.current || !tokenM.data?.token) return;
      iframeRef.current.contentWindow?.postMessage(
        {
          type: "markov.bootstrap",
          token: tokenM.data.token,
          apiBase: import.meta.env.VITE_API_BASE_URL ?? "",
          context: contextData ?? {},
        },
        "*",
      );
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [tokenM.data?.token]);

  if (!installation || !slotPath) return null;

  const version = installation.version?.version;
  const code = installation.package?.code;
  const iframeSrc = version && code
    ? bundleFileUrl(code, version, slotPath)
    : "";

  return (
    <Modal
      open
      onCancel={onClose}
      footer={null}
      width="80vw"
      style={{ top: 40 }}
      title={installation.package?.name ?? "Приложение"}
      closeIcon={<CloseOutlined />}
      styles={{ body: { padding: 0, height: "80vh" } }}
    >
      {tokenError && (
        <Alert type="error" message={tokenError} style={{ margin: 16 }} showIcon />
      )}
      {tokenM.isPending && (
        <div style={{ textAlign: "center", padding: 64 }}>
          <Spin />
        </div>
      )}
      {tokenM.data?.token && !tokenError && (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          style={{ width: "100%", height: "100%", border: 0 }}
          sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
          title={installation.package?.name ?? "app"}
        />
      )}
    </Modal>
  );
}
