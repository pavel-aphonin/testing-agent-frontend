import { apiClient } from "@/api/client";
import type { BrandingRead } from "@/types";

/**
 * Current branding. Endpoint is public (no auth) so the login page can
 * render the custom logo + product name before a JWT exists.
 */
export async function getBranding(): Promise<BrandingRead> {
  const r = await apiClient.get("/api/branding");
  return r.data;
}

export async function patchBrandingNames(payload: {
  product_name?: string | null;
  short_name?: string | null;
}): Promise<BrandingRead> {
  const r = await apiClient.patch("/api/branding", payload);
  return r.data;
}

export async function patchBrandingTokens(
  tokens: import("@/types").ThemeTokens | null,
): Promise<BrandingRead> {
  const r = await apiClient.patch("/api/branding", { theme_tokens: tokens });
  return r.data;
}

export async function uploadBrandingLogo(file: File): Promise<BrandingRead> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await apiClient.post("/api/branding/logo", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data;
}

export async function uploadBrandingLogoBack(file: File): Promise<BrandingRead> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await apiClient.post("/api/branding/logo-back", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data;
}

export async function deleteBrandingLogo(): Promise<BrandingRead> {
  const r = await apiClient.delete("/api/branding/logo");
  return r.data;
}

export async function deleteBrandingLogoBack(): Promise<BrandingRead> {
  const r = await apiClient.delete("/api/branding/logo-back");
  return r.data;
}

export async function uploadBrandingFavicon(file: File): Promise<BrandingRead> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await apiClient.post("/api/branding/favicon", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data;
}

export async function deleteBrandingFavicon(): Promise<BrandingRead> {
  const r = await apiClient.delete("/api/branding/favicon");
  return r.data;
}

export async function resetBranding(): Promise<BrandingRead> {
  const r = await apiClient.delete("/api/branding");
  return r.data;
}

/** Resolve a stored ``logo_path`` into a full URL the browser can fetch. */
export function brandingAssetUrl(relPath: string | null | undefined): string | null {
  if (!relPath) return null;
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  // Files are stored as "branding/<name>" and mounted at /branding-assets/
  // which strips the "branding/" prefix.
  const clean = relPath.replace(/^branding\//, "");
  return `${base}/branding-assets/${clean}`;
}
