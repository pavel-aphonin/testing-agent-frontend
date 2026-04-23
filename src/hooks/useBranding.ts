import { useQuery } from "@tanstack/react-query";

import { brandingAssetUrl, getBranding } from "@/api/branding";
import { getMySettings } from "@/api/settings";
import { useAuthStore } from "@/store/auth";
import type { BrandingRead, ThemeModeTokens, ThemeTokens } from "@/types";

/** Built-in Markov brand red. */
export const DEFAULT_PRIMARY = "#EE3424";

/**
 * Per-mode defaults — match Ant Design's defaults plus the Markov red
 * accent. Any gap in admin-supplied tokens is filled from here so the
 * UI always has a valid color.
 */
export const DEFAULTS: Record<"light" | "dark", Required<Omit<ThemeModeTokens, "sidebarBg" | "sidebarItemHoverBg" | "sidebarItemSelectedBg">>> = {
  light: {
    colorPrimary:     DEFAULT_PRIMARY,
    colorLink:        DEFAULT_PRIMARY,
    colorLinkHover:   "#c41d1a",
    colorBgContainer: "#ffffff",
    colorBgLayout:    "#f5f5f5",
  },
  dark: {
    colorPrimary:     DEFAULT_PRIMARY,
    colorLink:        "#ff5a4a",
    colorLinkHover:   "#ff7d70",
    colorBgContainer: "#1f1f1f",
    colorBgLayout:    "#141414",
  },
};

/** Sidebar chrome defaults — shared across both modes because the
 *  sidebar stays "always dark" unless the admin opts in. */
export const SIDEBAR_DEFAULTS = {
  sidebarBg:               "#0B0B0B",
  sidebarItemHoverBg:      "#1c1c1c",
  sidebarItemSelectedBg:   DEFAULT_PRIMARY,
};

export const DEFAULT_BRANDING = {
  productName: "Марков",
  shortName: "Марков",
  logoUrl: null as string | null,
  logoBackUrl: null as string | null,
  faviconUrl: null as string | null,
  systemTokens: null as ThemeTokens | null,
  loaded: false as boolean,
};

export type BrandingView = typeof DEFAULT_BRANDING;

export function useBranding(): BrandingView {
  const q = useQuery({
    queryKey: ["system-branding"],
    queryFn: getBranding,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  return toView(q.data, !!q.data);
}

export function toView(data: BrandingRead | undefined, loaded: boolean): BrandingView {
  if (!data) return { ...DEFAULT_BRANDING, loaded };
  return {
    productName: (data.product_name ?? "").trim() || DEFAULT_BRANDING.productName,
    shortName:
      (data.short_name ?? "").trim() ||
      (data.product_name ?? "").trim() ||
      DEFAULT_BRANDING.shortName,
    logoUrl: brandingAssetUrl(data.logo_path),
    logoBackUrl: brandingAssetUrl(data.logo_back_path),
    faviconUrl: brandingAssetUrl(data.favicon_path),
    systemTokens: data.theme_tokens,
    loaded,
  };
}

export function useUserThemeOverrides(): ThemeTokens | null {
  const isAuthed = useAuthStore((s) => Boolean(s.token));
  const q = useQuery({
    queryKey: ["my-settings"],
    queryFn: getMySettings,
    enabled: isAuthed,
    staleTime: 60_000,
  });
  return q.data?.theme_overrides ?? null;
}

/**
 * Compose the final token set shown to the user. Layering, top wins:
 *
 *   1. User personal overrides
 *   2. System branding tokens
 *   3. Markov defaults
 *
 * Returns a flat object ready for Ant Design's ConfigProvider + extra
 * keys the caller uses for the non-AntD sidebar (``sidebarBg`` etc.)
 */
export function composeTokens(
  mode: "light" | "dark",
  system: ThemeTokens | null | undefined,
  user: ThemeTokens | null | undefined,
): {
  antd: Record<string, unknown>;
  sidebar: {
    bg: string;
    itemHoverBg: string;
    itemSelectedBg: string;
  };
} {
  const base = DEFAULTS[mode];
  const sysMode = (system?.[mode] ?? {}) as ThemeModeTokens;
  const usrMode = (user?.[mode] ?? {}) as ThemeModeTokens;
  const pick = <K extends keyof ThemeModeTokens>(k: K, fallback: string): string =>
    (usrMode[k] || sysMode[k] || (base as any)[k] || fallback) as string;

  const borderRadius =
    typeof user?.borderRadius === "number"
      ? user.borderRadius
      : typeof system?.borderRadius === "number"
      ? system.borderRadius
      : 6;
  const fontFamily = user?.fontFamily || system?.fontFamily || undefined;
  const fontSize =
    typeof user?.fontSize === "number" && user.fontSize >= 12 && user.fontSize <= 18
      ? user.fontSize
      : typeof system?.fontSize === "number"
      ? system.fontSize
      : 14;

  return {
    antd: {
      colorPrimary:     pick("colorPrimary", DEFAULT_PRIMARY),
      colorError:       pick("colorPrimary", DEFAULT_PRIMARY),
      colorLink:        pick("colorLink", base.colorLink as string),
      colorLinkHover:   pick("colorLinkHover", base.colorLinkHover as string),
      colorBgContainer: pick("colorBgContainer", base.colorBgContainer as string),
      colorBgLayout:    pick("colorBgLayout", base.colorBgLayout as string),
      borderRadius,
      fontSize,
      ...(fontFamily ? { fontFamily } : {}),
    },
    sidebar: {
      bg:             pick("sidebarBg", SIDEBAR_DEFAULTS.sidebarBg),
      itemHoverBg:    pick("sidebarItemHoverBg", SIDEBAR_DEFAULTS.sidebarItemHoverBg),
      itemSelectedBg: pick("sidebarItemSelectedBg", SIDEBAR_DEFAULTS.sidebarItemSelectedBg),
    },
  };
}
