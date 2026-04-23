import { useEffect } from "react";

import { useBranding } from "@/hooks/useBranding";

/**
 * Side-effect-only component that keeps ``<title>`` and the favicon
 * in sync with the current system branding. Must be mounted exactly
 * once at the App root, outside any route — this way the sync runs on
 * every route including ``/login`` (which doesn't have the sidebar
 * chrome). Renders nothing.
 */
export function BrandingSync() {
  const branding = useBranding();

  useEffect(() => {
    document.title = branding.shortName;
  }, [branding.shortName]);

  useEffect(() => {
    // Built-in Markov favicon lives in ``public/markov.svg``. When admin
    // branding is reset we go back to it; otherwise we point the single
    // ``<link rel="icon">`` to the uploaded file.
    // Note the ``?v=`` query: Safari caches favicons by exact URL, and
    // bumping this string is the most reliable way to force a refetch.
    const DEFAULT_HREF = "/markov.svg?v=2";
    const DEFAULT_TYPE = "image/svg+xml";
    const link: HTMLLinkElement =
      document.querySelector("link[rel~='icon']") ??
      Object.assign(document.createElement("link"), { rel: "icon" });
    if (!link.isConnected) document.head.appendChild(link);

    if (branding.faviconUrl) {
      link.href = branding.faviconUrl;
      const ext = branding.faviconUrl.split(".").pop()?.toLowerCase();
      link.type =
        ext === "svg" ? "image/svg+xml" :
        ext === "png" ? "image/png" :
        ext === "ico" ? "image/x-icon" :
        ext === "webp" ? "image/webp" : "";
    } else {
      link.href = DEFAULT_HREF;
      link.type = DEFAULT_TYPE;
    }
  }, [branding.faviconUrl]);

  return null;
}
